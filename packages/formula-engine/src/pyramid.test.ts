import { describe, expect, it } from 'vitest';
import { dominantPyramidNote, pyramidBreakdown, pyramidPercents } from './pyramid';
import type { FormulaLine } from './types';

const lines: FormulaLine[] = [
  {
    id: '1',
    materialId: 'a',
    label: 'Bergamot',
    amountGrams: 10,
    concentrationKind: 'neat',
    pyramidNote: 'top',
  },
  {
    id: '2',
    materialId: 'b',
    label: 'Linalool',
    amountGrams: 20,
    concentrationKind: 'neat',
    pyramidNote: 'middle',
  },
  {
    id: '3',
    materialId: 'c',
    label: 'Ambrox',
    amountGrams: 5,
    concentrationKind: 'dilution',
    activeFraction: 0.1,
    pyramidNote: 'base',
  },
  {
    id: '4',
    materialId: 'd',
    label: 'Mystery',
    amountGrams: 2,
    concentrationKind: 'neat',
  },
];

describe('pyramid', () => {
  it('sums active grams by note', () => {
    const b = pyramidBreakdown(lines);
    expect(b.top).toBe(10);
    expect(b.middle).toBe(20);
    expect(b.base).toBeCloseTo(0.5);
    expect(b.unassigned).toBe(2);
    expect(b.totalActiveGrams).toBeCloseTo(32.5);
  });

  it('returns zero percents for empty batch', () => {
    expect(pyramidPercents([])).toEqual({
      top: 0,
      middle: 0,
      base: 0,
      modifier: 0,
      unassigned: 0,
    });
  });

  it('computes percents and dominant note', () => {
    const pct = pyramidPercents(lines);
    expect(pct.middle).toBeGreaterThan(pct.top);
    expect(dominantPyramidNote(lines)).toBe('middle');
  });

  it('dominant falls back to unassigned', () => {
    expect(
      dominantPyramidNote([
        {
          id: 'x',
          materialId: 'x',
          label: 'x',
          amountGrams: 3,
          concentrationKind: 'neat',
        },
      ]),
    ).toBe('unassigned');
  });
});
