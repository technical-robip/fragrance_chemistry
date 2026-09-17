import { activeGrams } from './scale';
import type { FormulaLine, PyramidBreakdown, PyramidNote } from './types';

const NOTES: PyramidNote[] = ['top', 'middle', 'base', 'modifier'];

export function pyramidBreakdown(lines: FormulaLine[]): PyramidBreakdown {
  const breakdown: PyramidBreakdown = {
    top: 0,
    middle: 0,
    base: 0,
    modifier: 0,
    unassigned: 0,
    totalActiveGrams: 0,
  };

  for (const line of lines) {
    const active = activeGrams(line);
    breakdown.totalActiveGrams += active;
    if (!line.pyramidNote) {
      breakdown.unassigned += active;
      continue;
    }
    breakdown[line.pyramidNote] += active;
  }

  return breakdown;
}

export function pyramidPercents(lines: FormulaLine[]): Record<PyramidNote | 'unassigned', number> {
  const breakdown = pyramidBreakdown(lines);
  const total = breakdown.totalActiveGrams;
  if (total <= 0) {
    return { top: 0, middle: 0, base: 0, modifier: 0, unassigned: 0 };
  }

  return {
    top: (breakdown.top / total) * 100,
    middle: (breakdown.middle / total) * 100,
    base: (breakdown.base / total) * 100,
    modifier: (breakdown.modifier / total) * 100,
    unassigned: (breakdown.unassigned / total) * 100,
  };
}

export function dominantPyramidNote(lines: FormulaLine[]): PyramidNote | 'unassigned' {
  const breakdown = pyramidBreakdown(lines);
  let best: PyramidNote | 'unassigned' = 'unassigned';
  let bestValue = breakdown.unassigned;

  for (const note of NOTES) {
    if (breakdown[note] > bestValue) {
      bestValue = breakdown[note];
      best = note;
    }
  }

  return best;
}
