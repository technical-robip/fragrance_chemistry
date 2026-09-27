import { formatAmount, type AmountUnit } from './batch-units';
import { resolvedFamily } from './formula-viz';

/** Catalog family order, matching the hue tokens used on the dashboard and workbench. */
const FAMILY_ORDER = [
  'Citrus',
  'Fresh',
  'Green',
  'Floral',
  'Amber',
  'Oriental',
  'Woody',
  'Gourmand',
  'Animalic',
  'Special',
];

export function formatWeighAmount(grams: number, unit: AmountUnit): string {
  const suffix = unit === 'ml' ? 'ml' : unit === 'drops' ? 'drops' : 'g';
  return `${formatAmount(grams, unit)} ${suffix}`;
}

export function groupWeighLines<
  T extends { materialName: string; olfactoryFamily?: string | null },
>(lines: T[], query: string): Array<{ family: string; items: Array<{ line: T; index: number }> }> {
  const needle = query.trim().toLowerCase();
  const buckets = new Map<string, Array<{ line: T; index: number }>>();
  lines.forEach((line, index) => {
    if (needle && !line.materialName.toLowerCase().includes(needle)) return;
    const family = resolvedFamily(line.olfactoryFamily);
    const bucket = buckets.get(family) ?? [];
    bucket.push({ line, index });
    buckets.set(family, bucket);
  });
  return [...buckets.keys()]
    .sort((a, b) => {
      const ia = FAMILY_ORDER.indexOf(a);
      const ib = FAMILY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map((family) => ({ family, items: buckets.get(family) ?? [] }));
}

/** A stored 0 is an empty weighed cell, not a finished pour. */
export function acceptedPourGrams(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function isPoured(grams: number | null | undefined): boolean {
  return grams != null && grams > 0;
}

export function lineTargetGrams(percent: number, batchGrams: number): number {
  return (percent / 100) * batchGrams;
}

/** Index of the first unpoured line, or `lineCount` when only the diluent remains, or past that when the session is done. */
export function nextOpenStep(
  actuals: Array<number | null | undefined>,
  diluentStillOpen: boolean,
): number {
  const open = actuals.findIndex((grams) => !isPoured(grams));
  if (open >= 0) return open;
  return diluentStillOpen ? actuals.length : actuals.length + 1;
}

export function formatWeighGrams(grams: number): string {
  return `${grams.toFixed(3)} g`;
}
