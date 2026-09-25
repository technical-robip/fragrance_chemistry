import { activeGrams } from './scale';
import type { FormulaLine, PyramidNote } from './types';
import { pyramidPercents } from './pyramid';

/** Map tenacity (hours on blotter) to a pyramid band. */
export function noteFromTenacityHours(hours: number): PyramidNote {
  if (hours < 6) return 'top';
  if (hours <= 24) return 'middle';
  return 'base';
}

/**
 * Evaporation index 0–100 (higher = more volatile / topper).
 * Inverse of tenacity when only hours are known.
 */
export function evaporationIndexFromTenacity(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 50;
  // ~0h → 100, ~48h → ~4, asymptotic
  return Math.max(0, Math.min(100, 100 / (1 + hours / 6)));
}

export type VolatilityLine = FormulaLine & {
  tenacityHours?: number | null;
  evaporationIndex?: number | null;
};

/**
 * Pyramid percents weighted by active grams × evaporation weight.
 * Falls back to tagged pyramidNote (or middle) when volatility data is missing.
 */
export function pyramidPercentsFromVolatility(
  lines: VolatilityLine[],
): Record<PyramidNote | 'unassigned', number> & { source: 'volatility' | 'note' } {
  let usedVolatility = false;
  const weighted: FormulaLine[] = lines.map((line) => {
    let note: PyramidNote | undefined = line.pyramidNote;
    if (line.evaporationIndex != null && Number.isFinite(line.evaporationIndex)) {
      const idx = line.evaporationIndex;
      note = idx >= 66 ? 'top' : idx >= 33 ? 'middle' : 'base';
      usedVolatility = true;
    } else if (line.tenacityHours != null && Number.isFinite(line.tenacityHours)) {
      note = noteFromTenacityHours(Number(line.tenacityHours));
      usedVolatility = true;
    }
    return { ...line, pyramidNote: note };
  });

  const percents = pyramidPercents(weighted);
  return { ...percents, source: usedVolatility ? 'volatility' : 'note' };
}

/** Active-mass share of a line within the batch (0–100). */
export function lineActivePercent(line: FormulaLine, lines: FormulaLine[]): number {
  const total = lines.reduce((s, l) => s + activeGrams(l), 0);
  if (total <= 0) return 0;
  return (activeGrams(line) / total) * 100;
}
