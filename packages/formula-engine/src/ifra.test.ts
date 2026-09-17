import { describe, expect, it } from 'vitest';
import { aggregateAllergens, evaluateIfraCompliance, type AllergenLimitsByCategory } from './ifra';
import type { FormulaLine } from './types';

const limits: AllergenLimitsByCategory = {
  1: { Linalool: 0.7, Limonene: 0.5 },
  2: {},
  3: {},
  4: {},
  5: {},
  6: {},
  7: {},
  8: {},
  9: {},
  10: {},
  11: {},
  12: {},
};

const lines: FormulaLine[] = [
  {
    id: 'l1',
    materialId: 'mat-linalool',
    label: 'Linalool',
    amountGrams: 50,
    concentrationKind: 'neat',
    allergens: [{ name: 'Linalool', fraction: 1 }],
  },
  {
    id: 'l2',
    materialId: 'mat-citrus',
    label: 'Citrus oil',
    amountGrams: 50,
    concentrationKind: 'neat',
    allergens: [{ name: 'Limonene', fraction: 0.9 }],
  },
];

describe('aggregateAllergens', () => {
  it('sums allergen grams across lines', () => {
    const map = aggregateAllergens(lines);
    expect(map.get('Linalool')).toBeCloseTo(50, 4);
    expect(map.get('Limonene')).toBeCloseTo(45, 4);
  });
});

describe('evaluateIfraCompliance', () => {
  it('marks over-limit allergens red and near-limit yellow', () => {
    const highLinalool: FormulaLine[] = [
      {
        id: 'l1',
        materialId: 'mat-linalool',
        label: 'Linalool',
        amountGrams: 80,
        concentrationKind: 'neat',
        allergens: [{ name: 'Linalool', fraction: 1 }],
      },
      {
        id: 'l2',
        materialId: 'mat-eth',
        label: 'Ethanol',
        amountGrams: 20,
        concentrationKind: 'neat',
      },
    ];

    const report = evaluateIfraCompliance(highLinalool, 1, limits);
    const linalool = report.allergens.find((a) => a.name === 'Linalool');
    expect(linalool?.percentOfBatch).toBeCloseTo(80, 2);
    expect(linalool?.status).toBe('red');
    expect(report.overallStatus).toBe('red');
  });

  it('returns green when all allergens are below yellow threshold', () => {
    const mild: FormulaLine[] = [
      {
        id: 'l1',
        materialId: 'mat-linalool',
        label: 'Linalool',
        amountGrams: 0.3,
        concentrationKind: 'neat',
        allergens: [{ name: 'Linalool', fraction: 1 }],
      },
      {
        id: 'l2',
        materialId: 'mat-eth',
        label: 'Ethanol',
        amountGrams: 99.7,
        concentrationKind: 'neat',
      },
    ];

    const report = evaluateIfraCompliance(mild, 1, limits);
    expect(report.overallStatus).toBe('green');
  });
});
