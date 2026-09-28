import { parseNonNegativeDecimal } from '@/components/DecimalCell';

export function clampCostingValue(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Empty or a trailing separator: the user is still typing. */
export function isIncompleteDecimalDraft(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  return trimmed.endsWith('.') || trimmed.endsWith(',');
}

/**
 * Commit a finished draft while the field is focused.
 * Incomplete and unparseable text returns null so the field is left as typed.
 */
export function liveCostingDecimal(raw: string, min: number, max: number): number | null {
  if (isIncompleteDecimalDraft(raw)) return null;
  const parsed = parseNonNegativeDecimal(raw);
  if (parsed == null) return null;
  return clampCostingValue(parsed, min, max);
}

/**
 * Commit on blur or Enter. A single trailing separator is dropped (`1.` → 1).
 * Empty or garbage returns null so the caller can restore the last good value.
 */
export function finalizeCostingDecimal(raw: string, min: number, max: number): number | null {
  let trimmed = raw.trim();
  if (trimmed.endsWith('.') || trimmed.endsWith(',')) trimmed = trimmed.slice(0, -1).trim();
  if (!trimmed) return null;
  const parsed = parseNonNegativeDecimal(trimmed);
  if (parsed == null) return null;
  return clampCostingValue(parsed, min, max);
}
