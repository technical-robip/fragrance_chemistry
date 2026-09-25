import { Injectable } from '@nestjs/common';
import { formulaCost, scaleFormula } from '@fc/formula-engine';
import type { FormulaLine } from '@fc/formula-engine';
import type { CostingEstimateQuery } from '@fc/shared';
import { JwtPayload } from '../auth/auth.types';
import { FormulasService, type FormulaDetail } from '../formulas/formulas.service';

export type CostingQuery = CostingEstimateQuery;

export type LoadedCostLine = {
  materialId: string;
  percent: number | string;
  costPerGram?: number | string | null;
  materialName: string;
  manufacturer?: string | null;
  slug?: string | null;
  stockConcentrationPct?: number | string | null;
  solvent?: string | null;
  childFormulaId?: string | null;
};

type FormulaLineRow = FormulaDetail['lines'][number];

@Injectable()
export class CostingService {
  constructor(private readonly formulas: FormulasService) {}

  async estimateFormulaCost(user: JwtPayload, formulaId: string, query: CostingQuery = {}) {
    const formula = await this.formulas.get(user, formulaId);
    const lines = await this.flattenLines(user, formula.lines);
    const batchDefault = Number(formula.batchTargetGrams ?? 100);
    return this.estimateFromLines(
      {
        id: formula.id,
        name: formula.name,
        concentrationPct: formula.concentrationPct,
      },
      lines,
      {
        ...query,
        batchGrams:
          query.batchGrams ??
          (Number.isFinite(batchDefault) && batchDefault > 0 ? batchDefault : 100),
      },
    );
  }

  estimateFromLines(
    formula: {
      id: string;
      name: string;
      concentrationPct: number | string | null | undefined;
    },
    lines: LoadedCostLine[],
    query: CostingQuery = {},
  ) {
    const batchGrams = query.batchGrams ?? 100;
    const wastePct = query.wastePct ?? 3;
    const marginPct = query.marginPct ?? 28;
    const bottleMl = query.bottleMl ?? 50;
    const packagingCost = query.packagingCost ?? 1.2;
    const concentrationPct = Number(formula.concentrationPct ?? 20);
    const concentrateBatch = batchGrams;

    const engineLines: FormulaLine[] = lines.map((l, idx) => ({
      id: String(idx),
      materialId: l.materialId,
      label: l.materialName,
      amountGrams: (Number(l.percent) / 100) * concentrateBatch,
      concentrationKind: 'neat',
      costPerGram: Number(l.costPerGram ?? 0),
    }));

    const scaled = scaleFormula(
      {
        id: formula.id,
        name: formula.name,
        lines: engineLines,
        batchSizeGrams: concentrateBatch,
      },
      concentrateBatch,
    );
    const summary = formulaCost(scaled);

    const lineRows = scaled.lines.map((line, idx) => {
      const source = lines[idx]!;
      const stockPct = Number(source.stockConcentrationPct ?? 100);
      return {
        materialId: line.materialId,
        materialName: source.materialName,
        manufacturer: source.manufacturer ?? null,
        slug: source.slug ?? null,
        stockConcentrationPct: Number.isFinite(stockPct) ? stockPct : 100,
        solvent: source.solvent ?? null,
        percent: Number(source.percent),
        grams: line.amountGrams,
        costPerGram: Number(source.costPerGram ?? 0),
        lineCost: line.amountGrams * Number(source.costPerGram ?? 0),
      };
    });

    const materialCost = summary.totalCost;
    const wasteCost = materialCost * (wastePct / 100);
    const concentrateSubtotal = materialCost + wasteCost;
    const concentrateWithMargin = concentrateSubtotal * (1 + marginPct / 100);

    const dilutedBatchGrams = concentrateBatch / (concentrationPct / 100);
    const dilutedCostPerGram = concentrateWithMargin / dilutedBatchGrams;
    const dilutedBatchCost = dilutedCostPerGram * dilutedBatchGrams;

    const unitGrams = bottleMl * 0.9;
    const unitJuiceCost = dilutedCostPerGram * unitGrams;
    const unitTotal = unitJuiceCost + packagingCost;
    const wholesale = unitTotal;
    const rrp = wholesale * (1 + marginPct / 100);

    return {
      formulaId: formula.id,
      formulaName: formula.name,
      concentrationPct,
      batchGrams: concentrateBatch,
      wastePct,
      marginPct,
      bottleMl,
      packagingCost,
      currency: 'USD' as const,
      lines: lineRows,
      concentrate: {
        batchGrams: concentrateBatch,
        materialCost,
        wasteCost,
        subtotal: concentrateSubtotal,
        withMargin: concentrateWithMargin,
        costPerGram: concentrateWithMargin / concentrateBatch,
      },
      diluted: {
        batchGrams: dilutedBatchGrams,
        costPerGram: dilutedCostPerGram,
        batchCost: dilutedBatchCost,
      },
      unit: {
        bottleMl,
        juiceCost: unitJuiceCost,
        packagingCost,
        wholesale,
        rrp,
        breakEvenUnits:
          packagingCost > 0 ? Math.ceil(concentrateWithMargin / (rrp - packagingCost || 1)) : null,
      },
    };
  }

  private async flattenLines(
    user: JwtPayload,
    lines: FormulaLineRow[],
    scale = 1,
    visited = new Set<string>(),
  ): Promise<LoadedCostLine[]> {
    const out: LoadedCostLine[] = [];
    for (const line of lines) {
      const childId = line.childFormulaId ?? null;
      if (childId && !visited.has(childId)) {
        visited.add(childId);
        try {
          const child = await this.formulas.get(user, childId);
          const nestedScale = (Number(line.percent) / 100) * scale;
          const nested = await this.flattenLines(user, child.lines, nestedScale, visited);
          out.push(...nested);
          continue;
        } catch {
          // Fall through and cost the accord row as a catalog material.
        }
      }
      out.push({
        materialId: line.materialId,
        percent: Number(line.percent) * scale,
        costPerGram: line.costPerGram,
        materialName: line.materialName,
        manufacturer: line.manufacturer,
        slug: line.slug ?? null,
        stockConcentrationPct: line.stockConcentrationPct,
        solvent: line.solvent ?? null,
        childFormulaId: childId,
      });
    }
    return out;
  }
}
