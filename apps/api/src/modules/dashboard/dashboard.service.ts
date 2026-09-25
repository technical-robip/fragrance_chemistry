import { Injectable } from '@nestjs/common';
import {
  diluentGrams,
  finishedJuiceGrams,
  ifraLineStatus,
  ifraUsageInFinishedPct,
  juiceClassFromConcentration,
  neatPercent,
  percentToGrams,
  percentToPpt,
  describeOpenSitting,
} from '@fc/shared';
import {
  emptyEuAnnexReport,
  emptyEuLabelReport,
  evaluateEuAnnexRestrictions,
  evaluateEuLabelAllergens,
  pyramidPercents,
  pyramidPercentsFromVolatility,
  type FormulaLine,
  type IfraCategory,
  type PyramidNote,
  type VolatilityLine,
} from '@fc/formula-engine';
import { count, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  evaluations,
  formulas,
  inventoryItems,
  materials,
  weighingSessions,
} from '../../database/schema';
import { DASHBOARD_BRIEFING_CACHE_TTL_SEC, RedisService } from '../../redis/redis.service';
import { JwtPayload } from '../auth/auth.types';
import { CostingService } from '../costing/costing.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { FormulasService } from '../formulas/formulas.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseAllergens(profile: unknown): Array<{ name: string; fraction: number }> | undefined {
  if (!profile || typeof profile !== 'object') return undefined;
  const entries = Object.entries(profile as Record<string, unknown>)
    .map(([name, raw]) => {
      const fraction = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(fraction) || fraction <= 0) return null;
      // Accept 0–1 fractions or 0–100 percents
      return { name, fraction: fraction > 1 ? fraction / 100 : fraction };
    })
    .filter(Boolean) as Array<{ name: string; fraction: number }>;
  return entries.length ? entries : undefined;
}

function toEngineNote(note: string | null | undefined): PyramidNote | undefined {
  if (note === 'heart') return 'middle';
  if (note === 'top' || note === 'middle' || note === 'base' || note === 'modifier') return note;
  return undefined;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly formulas: FormulasService,
    private readonly costing: CostingService,
    private readonly evaluationsSvc: EvaluationsService,
    private readonly redis: RedisService,
  ) {}

  async stats(user: JwtPayload) {
    const db = this.db.client();

    const [formulaRows, materialRows, evalRows, lowStockRows, weighRows] = await Promise.all([
      db.select({ value: count() }).from(formulas).where(eq(formulas.ownerId, user.sub)),
      db.select({ value: count() }).from(materials).where(isNull(materials.ownerId)),
      db.select({ value: count() }).from(evaluations).where(eq(evaluations.ownerId, user.sub)),
      db
        .select({
          value: sql<number>`count(*)::int`,
        })
        .from(inventoryItems)
        .where(
          sql`${inventoryItems.ownerId} = ${user.sub}::uuid
            AND ${inventoryItems.quantityGrams}::numeric
                <= coalesce(${inventoryItems.minQuantityGrams}::numeric, 0)`,
        ),
      db
        .select({ value: count() })
        .from(weighingSessions)
        .where(eq(weighingSessions.ownerId, user.sub)),
    ]);

    return {
      formulaCount: Number(formulaRows[0]?.value ?? 0),
      catalogSize: Number(materialRows[0]?.value ?? 0),
      evaluationCount: Number(evalRows[0]?.value ?? 0),
      lowStockItems: Number(lowStockRows[0]?.value ?? 0),
      weighingSessionCount: Number(weighRows[0]?.value ?? 0),
    };
  }

  async briefing(user: JwtPayload, formulaId: string) {
    const resolvedId = UUID_RE.test(formulaId) ? formulaId : null;
    if (resolvedId) {
      const cached = await this.redis.cacheGet(
        this.redis.dashboardBriefingKey(user.sub, resolvedId),
      );
      if (cached) return cached;
    }

    const formula = await this.formulas.get(user, formulaId);
    const cacheKey = this.redis.dashboardBriefingKey(user.sub, formula.id);
    if (formula.id !== resolvedId) {
      const cached = await this.redis.cacheGet(cacheKey);
      if (cached) return cached;
    }

    const batchTargetGrams = Number(formula.batchTargetGrams ?? 100);
    const concentrationPct = Number(formula.concentrationPct ?? 20);

    const engineLines: VolatilityLine[] = formula.lines.map((line, idx) => {
      const stockPct = Number(line.stockConcentrationPct ?? 100);
      const activeFraction = Math.min(1, Math.max(0, stockPct / 100));
      const amountGrams = percentToGrams(Number(line.percent), batchTargetGrams);
      return {
        id: line.id ?? String(idx),
        materialId: line.materialId,
        label: line.materialName,
        amountGrams,
        concentrationKind: activeFraction < 0.999 ? 'dilution' : 'neat',
        activeFraction,
        pyramidNote: toEngineNote(line.pyramidNote),
        costPerGram: Number(line.costPerGram ?? 0),
        allergens: parseAllergens(line.allergenProfile),
        tenacityHours: line.tenacityHours != null ? Number(line.tenacityHours) : null,
        casNumber: line.casNumber ?? null,
      };
    });

    const notePyramid = pyramidPercents(engineLines);
    const volPyramid = pyramidPercentsFromVolatility(engineLines);

    const costP = Promise.resolve().then(() => {
      if (formula.lines.length === 0) {
        return { costPer50ml: null as number | null, currency: 'USD' };
      }
      try {
        const cost = this.costing.estimateFromLines(
          {
            id: formula.id,
            name: formula.name,
            concentrationPct,
          },
          formula.lines,
          { bottleMl: 50 },
        );
        return { costPer50ml: cost.unit.wholesale as number | null, currency: cost.currency };
      } catch {
        return { costPer50ml: null as number | null, currency: 'USD' };
      }
    });
    const evalsP = this.evaluationsSvc.list(user, formula.id);
    const linesP = Promise.all(
      formula.lines.map(async (line, idx) => {
        const note = toEngineNote(line.pyramidNote) ?? null;
        const percent = Number(line.percent);
        const stockPct = Number(line.stockConcentrationPct ?? 100);
        const costPerGram = Number(line.costPerGram ?? 0);
        const grams = percentToGrams(percent, batchTargetGrams);
        const neatPct = neatPercent(percent, stockPct);
        const childFormulaId = line.childFormulaId ?? null;
        let children: Array<Record<string, unknown>> | undefined;
        let displayName = line.materialName;
        if (childFormulaId) {
          try {
            const child = await this.formulas.get(user, childFormulaId);
            displayName = child.name || displayName;
            children = child.lines.map((c, cIdx) => {
              const cPercent = (Number(c.percent) / 100) * percent;
              const cStock = Number(c.stockConcentrationPct ?? 100);
              return {
                id: c.id ?? `${idx}-${cIdx}`,
                materialId: c.materialId,
                slug: c.slug ?? null,
                name: c.materialName,
                percent: cPercent,
                ppt: percentToPpt(cPercent),
                grams: percentToGrams(cPercent, batchTargetGrams),
                neatPercent: neatPercent(cPercent, cStock),
                stockConcentrationPct: cStock,
                pyramidNote: toEngineNote(c.pyramidNote) ?? null,
                olfactoryFamily: c.olfactoryFamily?.trim() || null,
                imageUrl: c.imageUrl ?? null,
              };
            });
          } catch {
            children = undefined;
          }
        }
        return {
          id: line.id ?? String(idx),
          materialId: line.materialId,
          slug: line.slug ?? null,
          name: displayName,
          percent,
          ppt: percentToPpt(percent),
          grams,
          neatPercent: neatPct,
          neatPpt: percentToPpt(neatPct),
          neatGrams: percentToGrams(neatPct, batchTargetGrams),
          stockConcentrationPct: stockPct,
          solvent: line.solvent ?? null,
          dilutionLabel:
            stockPct < 99.9
              ? `${stockPct.toFixed(0)}%${line.solvent ? ` ${line.solvent}` : ''}`
              : null,
          lineCost: grams * costPerGram,
          costPerGram,
          pyramidNote: note,
          olfactoryFamily: line.olfactoryFamily?.trim() || null,
          imageUrl: line.imageUrl ?? null,
          tenacityHours: line.tenacityHours != null ? Number(line.tenacityHours) : null,
          childFormulaId,
          children,
        };
      }),
    );

    const ifraCategory = 4 as IfraCategory;
    const [costResult, evals, compliance, lines] = await Promise.all([
      costP,
      evalsP,
      this.buildCompliance(formula.lines, concentrationPct, engineLines).catch(() => ({
        category: ifraCategory,
        categoryLabel: 'Fine fragrance',
        overallStatus: 'green' as const,
        allergens: [] as Array<{
          name: string;
          gramsInBatch: number;
          percentOfBatch: number;
          limitPercent?: number;
          status: 'green' | 'yellow' | 'red';
        }>,
        labelAllergens: [] as string[],
        euLabel: emptyEuLabelReport('leave_on'),
        euAnnex: emptyEuAnnexReport(),
      })),
      linesP,
    ]);

    const familyMap = new Map<string, number>();
    for (const line of lines) {
      if (!line.olfactoryFamily) continue;
      familyMap.set(
        line.olfactoryFamily,
        (familyMap.get(line.olfactoryFamily) ?? 0) + line.neatPercent,
      );
    }
    const familyTotal = [...familyMap.values()].reduce((s, v) => s + v, 0) || 1;
    const families = [...familyMap.entries()]
      .map(([name, value]) => ({ name, percent: (value / familyTotal) * 100 }))
      .sort((a, b) => b.percent - a.percent);

    const { costPer50ml, currency } = costResult;
    const latest = evals[0];
    const lastEvaluation = latest
      ? {
          rating: latest.rating,
          macerationDay: latest.macerationDay,
          createdAt: latest.createdAt,
        }
      : null;
    const openSitting = describeOpenSitting(latest);

    const concentrateGrams = batchTargetGrams;
    const juiceGrams = finishedJuiceGrams(concentrateGrams, concentrationPct);
    const alcoholGrams = diluentGrams(concentrateGrams, concentrationPct);

    const payload = {
      formula: {
        id: formula.id,
        name: formula.name,
        status: formula.status,
        concentrationPct,
        batchTargetGrams,
      },
      pyramid: {
        ...notePyramid,
        source: 'note' as const,
      },
      pyramidVolatility: {
        top: volPyramid.top,
        middle: volPyramid.middle,
        base: volPyramid.base,
        modifier: volPyramid.modifier,
        unassigned: volPyramid.unassigned,
        source: volPyramid.source,
      },
      families,
      lines,
      product: {
        concentrationPct,
        juiceClass: juiceClassFromConcentration(concentrationPct),
        costPer50ml,
        currency,
        concentrateGrams,
        finishedJuiceGrams: juiceGrams,
        diluentGrams: alcoholGrams,
      },
      compliance,
      lastEvaluation,
      openSitting,
    };
    await this.redis.cacheSet(cacheKey, payload, DASHBOARD_BRIEFING_CACHE_TTL_SEC);
    return payload;
  }

  private async buildCompliance(
    formulaLines: Array<{
      materialName: string;
      percent: string | number;
      stockConcentrationPct?: string | number | null;
      ifraCat4MaxPercent?: string | number | null;
    }>,
    concentrationPct: number,
    engineLines: FormulaLine[],
  ) {
    const category = 4 as IfraCategory;
    const allergens = formulaLines.flatMap((line) => {
      if (line.ifraCat4MaxPercent == null || line.ifraCat4MaxPercent === '') return [];
      const limitPercent = Number(line.ifraCat4MaxPercent);
      if (!Number.isFinite(limitPercent)) return [];
      const usage = ifraUsageInFinishedPct(
        Number(line.percent),
        concentrationPct,
        Number(line.stockConcentrationPct ?? 100),
      );
      const lineStatus = ifraLineStatus(usage, limitPercent);
      if (lineStatus === 'n/a') return [];
      const status =
        lineStatus === 'exceeded' ? 'red' : lineStatus === 'warning' ? 'yellow' : 'green';
      return [
        {
          name: line.materialName,
          gramsInBatch: 0,
          percentOfBatch: usage,
          limitPercent,
          status: status as 'green' | 'yellow' | 'red',
        },
      ];
    });
    const overallStatus = allergens.some((row) => row.status === 'red')
      ? 'red'
      : allergens.some((row) => row.status === 'yellow')
        ? 'yellow'
        : 'green';
    const euLabel = evaluateEuLabelAllergens(engineLines, 'leave_on');
    const euAnnex = evaluateEuAnnexRestrictions(engineLines);

    return {
      category,
      categoryLabel: 'Fine fragrance',
      overallStatus,
      allergens,
      labelAllergens: euLabel.declared.map((hit) => hit.inci),
      euLabel,
      euAnnex,
    };
  }
}
