import { activeGrams } from './scale';
import type { Formula, IngredientForecastLine, UsageForecast } from './types';

export interface ForecastOptions {
  batches: number;
  /** Override formula batch size; defaults to sum of line amounts. */
  batchSizeGrams?: number;
}

export function forecastUsage(formula: Formula, options: ForecastOptions): UsageForecast {
  const batches = options.batches;
  if (batches < 0 || !Number.isFinite(batches)) {
    throw new Error('batches must be a non-negative finite number');
  }

  const singleBatchSize =
    options.batchSizeGrams ??
    formula.batchSizeGrams ??
    formula.lines.reduce((s, l) => s + l.amountGrams, 0);

  const scale = batches;

  const byMaterial = new Map<string, IngredientForecastLine>();

  for (const line of formula.lines) {
    const existing = byMaterial.get(line.materialId);
    const addGrams = line.amountGrams * scale;
    const addActive = activeGrams(line) * scale;

    if (existing) {
      existing.totalGrams += addGrams;
      existing.totalActiveGrams += addActive;
    } else {
      byMaterial.set(line.materialId, {
        materialId: line.materialId,
        label: line.label,
        totalGrams: addGrams,
        totalActiveGrams: addActive,
      });
    }
  }

  const ingredients = [...byMaterial.values()]
    .map((row) => ({
      ...row,
      totalGrams: roundGrams(row.totalGrams),
      totalActiveGrams: roundGrams(row.totalActiveGrams),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    batches,
    batchSizeGrams: roundGrams(singleBatchSize * batches),
    ingredients,
  };
}

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
