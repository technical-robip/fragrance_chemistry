import { describe, expect, it } from 'vitest';
import { forecastUsage } from './forecast';
import type { Formula } from './types';

const formula: Formula = {
  id: 'f1',
  name: 'Batch',
  batchSizeGrams: 100,
  lines: [
    {
      id: 'l1',
      materialId: 'm1',
      label: 'A',
      amountGrams: 40,
      concentrationKind: 'neat',
    },
    {
      id: 'l2',
      materialId: 'm2',
      label: 'B',
      amountGrams: 60,
      concentrationKind: 'dilution',
      activeFraction: 0.1,
    },
  ],
};

describe('forecastUsage', () => {
  it('multiplies ingredient needs by batch count', () => {
    const forecast = forecastUsage(formula, { batches: 5 });
    expect(forecast.batchSizeGrams).toBe(500);
    expect(forecast.ingredients).toHaveLength(2);

    const a = forecast.ingredients.find((i) => i.materialId === 'm1');
    const b = forecast.ingredients.find((i) => i.materialId === 'm2');
    expect(a?.totalGrams).toBe(200);
    expect(b?.totalGrams).toBe(300);
    expect(b?.totalActiveGrams).toBeCloseTo(30, 4);
  });
});
