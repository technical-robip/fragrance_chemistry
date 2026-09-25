import { describe, expect, it } from 'vitest';
import { linePercent, scaleFormula, totalBatchGrams } from './scale';
import type { Formula } from './types';

const baseFormula: Formula = {
  id: 'f1',
  name: 'Test',
  lines: [
    {
      id: 'l1',
      materialId: 'm1',
      label: 'Material A',
      amountGrams: 30,
      concentrationKind: 'neat',
    },
    {
      id: 'l2',
      materialId: 'm2',
      label: 'Material B',
      amountGrams: 70,
      concentrationKind: 'neat',
    },
  ],
};

describe('scaleFormula', () => {
  it('scales all lines to target batch size', () => {
    const scaled = scaleFormula(baseFormula, 200);
    expect(totalBatchGrams(scaled.lines)).toBeCloseTo(200, 4);
    expect(scaled.lines[0]?.amountGrams).toBeCloseTo(60, 4);
    expect(scaled.lines[1]?.amountGrams).toBeCloseTo(140, 4);
    expect(scaled.scaleFactor).toBeCloseTo(2, 6);
  });

  it('handles empty formula totals', () => {
    const empty = scaleFormula({ id: 'e', name: 'e', lines: [] }, 100);
    expect(empty.totalGrams).toBe(0);
    expect(empty.scaleFactor).toBe(1);
    expect(linePercent(baseFormula.lines[0]!, 0)).toBe(0);
  });
});
