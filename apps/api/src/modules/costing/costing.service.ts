import { Injectable, NotFoundException } from '@nestjs/common';
import { formulaCost } from '@fc/formula-engine';
import type { FormulaLine } from '@fc/formula-engine';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { formulaLines, formulas, materials } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';

@Injectable()
export class CostingService {
  constructor(private readonly db: DatabaseService) {}

  async estimateFormulaCost(user: JwtPayload, formulaId: string, batchGrams = 100) {
    const [formula] = await this.db
      .client()
      .select()
      .from(formulas)
      .where(eq(formulas.id, formulaId))
      .limit(1);
    if (!formula) throw new NotFoundException('Formula not found');

    const lines = await this.db
      .client()
      .select({
        materialId: formulaLines.materialId,
        percent: formulaLines.percent,
        costPerGram: materials.costPerGram,
      })
      .from(formulaLines)
      .innerJoin(materials, eq(formulaLines.materialId, materials.id))
      .where(eq(formulaLines.formulaId, formulaId));

    const engineLines: FormulaLine[] = lines.map((l, idx) => ({
      id: String(idx),
      materialId: l.materialId,
      label: l.materialId,
      amountGrams: (Number(l.percent) / 100) * batchGrams,
      concentrationKind: 'neat',
      costPerGram: Number(l.costPerGram ?? 0),
    }));

    const summary = formulaCost({
      id: formulaId,
      name: formula.name,
      lines: engineLines,
      batchSizeGrams: batchGrams,
    });
    return {
      formulaId,
      ownerId: user.sub,
      batchGrams,
      totalCost: summary.totalCost,
      costPerGramBatch: summary.costPerGramBatch,
      currency: 'USD',
    };
  }
}
