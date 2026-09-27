export type AmountUnit = 'grams' | 'drops' | 'ml';

/** Batch entry treats 1 ml as 1 g. Density is only used for the bottled-juice estimate. */
export const ML_PER_GRAM = 1;
/** One gram is twenty drops, for every material. */
export const DROPS_PER_ML = 20;

export function lineGrams(percent: number, batchGrams: number): number {
  return (percent / 100) * batchGrams;
}

export function formatAmount(grams: number, unit: AmountUnit): string {
  if (unit === 'ml') return (grams * ML_PER_GRAM).toFixed(3);
  if (unit === 'drops') return (grams * ML_PER_GRAM * DROPS_PER_ML).toFixed(1);
  return grams.toFixed(3);
}

export function gramsToDisplay(grams: number, unit: AmountUnit): string {
  if (unit === 'ml') return String(grams * ML_PER_GRAM);
  if (unit === 'drops') return String(grams * ML_PER_GRAM * DROPS_PER_ML);
  return String(grams);
}

export function displayToGrams(value: number, unit: AmountUnit): number {
  if (unit === 'ml') return value / ML_PER_GRAM;
  if (unit === 'drops') return value / (ML_PER_GRAM * DROPS_PER_ML);
  return value;
}
