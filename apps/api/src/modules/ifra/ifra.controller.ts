import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { evaluateIfraCompliance } from '@fc/formula-engine';
import type { FormulaLine, IfraCategory } from '@fc/formula-engine';
import { IfraService } from './ifra.service';

@Controller('ifra')
export class IfraController {
  constructor(private readonly ifra: IfraService) {}

  @Get('categories')
  categories() {
    return this.ifra.listCategories();
  }

  @Get('materials/:materialId/limits')
  limits(@Param('materialId') materialId: string) {
    return this.ifra.limitsForMaterial(materialId);
  }

  /** Analyze a formula payload with the shared formula-engine (client-parity). */
  @Post('analyze')
  analyze(
    @Body()
    body: {
      category?: number;
      lines: Array<{
        id: string;
        materialId: string;
        label: string;
        amountGrams: number;
        allergens?: Array<{ name: string; fraction: number }>;
      }>;
      limits?: Record<string, number>;
    },
  ) {
    const category = (body.category ?? 4) as IfraCategory;
    const lines: FormulaLine[] = body.lines.map((l) => ({
      id: l.id,
      materialId: l.materialId,
      label: l.label,
      amountGrams: l.amountGrams,
      concentrationKind: 'neat' as const,
      allergens: l.allergens,
    }));
    const limitsByCategory = {
      [category]: body.limits ?? { Linalool: 20, Limonene: 100 },
    } as Record<IfraCategory, Record<string, number>>;
    return evaluateIfraCompliance(lines, category, limitsByCategory);
  }
}
