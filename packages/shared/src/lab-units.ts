/** Lab unit conversions. Formula `percent` (0–100 of concentrate) is canonical. */

export function percentToPpt(percent: number): number {
  return percent * 10;
}

export function pptToPercent(ppt: number): number {
  return ppt / 10;
}

export function percentToGrams(percent: number, batchTargetGrams: number): number {
  return (percent / 100) * batchTargetGrams;
}

export function gramsToPercent(grams: number, batchTargetGrams: number): number {
  if (batchTargetGrams <= 0) return 0;
  return (grams / batchTargetGrams) * 100;
}

/** Neat (pure) share of concentrate when the line is a dilution stock. */
export function neatPercent(percent: number, stockConcentrationPct: number = 100): number {
  const stock = Number.isFinite(stockConcentrationPct) ? stockConcentrationPct : 100;
  return percent * (stock / 100);
}

export function neatGrams(
  percent: number,
  batchTargetGrams: number,
  stockConcentrationPct: number = 100,
): number {
  return percentToGrams(neatPercent(percent, stockConcentrationPct), batchTargetGrams);
}

/**
 * Finished juice mass when `concentrateGrams` is the oil/concentrate portion
 * at `concentrationPct` of the finished product.
 */
export function finishedJuiceGrams(concentrateGrams: number, concentrationPct: number): number {
  if (concentrationPct <= 0) return concentrateGrams;
  return concentrateGrams / (concentrationPct / 100);
}

export function diluentGrams(concentrateGrams: number, concentrationPct: number): number {
  return Math.max(0, finishedJuiceGrams(concentrateGrams, concentrationPct) - concentrateGrams);
}

export type LabUnitMode = 'percent' | 'ppt' | 'grams';
