import { describe, expect, it } from 'vitest';
import { rebalanceFormula, rebalanceToPercents } from './rebalance';
import type { FormulaLine } from './types';

const lines: FormulaLine[] = [
  {
    id: 'fixed',
    materialId: 'm1',
    label: 'Fixative',
    amountGrams: 10,
    concentrationKind: 'neat',
  },
  {
    id: 'a',
    materialId: 'm2',
    label: 'Note A',
    amountGrams: 30,
    concentrationKind: 'neat',
  },
  {
    id: 'b',
    materialId: 'm3',
    label: 'Note B',
    amountGrams: 50,
    concentrationKind: 'neat',
  },
];

describe('rebalanceFormula', () => {
  it('keeps fixed lines and scales others to fill batch', () => {
    const result = rebalanceFormula(lines, {
      fixedLineIds: ['fixed'],
      batchSizeGrams: 100,
    });

    const fixed = result.lines.find((l) => l.id === 'fixed');
    expect(fixed?.amountGrams).toBe(10);
    expect(result.totalGrams).toBeCloseTo(100, 4);
    expect(result.totalPercent).toBeCloseTo(100, 2);
  });
});

describe('rebalanceToPercents', () => {
  it('sets amounts from target percents', () => {
    const result = rebalanceToPercents(lines, { a: 25, b: 75, fixed: 0 }, 100);
    const a = result.lines.find((l) => l.id === 'a');
    const b = result.lines.find((l) => l.id === 'b');
    expect(a?.amountGrams).toBe(25);
    expect(b?.amountGrams).toBe(75);
  });
});
