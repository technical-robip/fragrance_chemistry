import { describe, expect, it } from 'vitest';
import { formulaCost, lineCost } from './cost';
import type { Formula, FormulaLine } from './types';

describe('cost', () => {
  it('returns null when cost missing', () => {
    const line: FormulaLine = {
      id: '1',
      materialId: 'm',
      label: 'x',
      amountGrams: 10,
      concentrationKind: 'neat',
    };
    expect(lineCost(line)).toBeNull();
  });

  it('computes line and formula costs', () => {
    const lines: FormulaLine[] = [
      {
        id: '1',
        materialId: 'm1',
        label: 'A',
        amountGrams: 10,
        concentrationKind: 'neat',
        costPerGram: 2,
      },
      {
        id: '2',
        materialId: 'm2',
        label: 'B',
        amountGrams: 5,
        concentrationKind: 'neat',
        costPerGram: 4,
      },
      {
        id: '3',
        materialId: 'm3',
        label: 'C',
        amountGrams: 1,
        concentrationKind: 'neat',
      },
    ];
    expect(lineCost(lines[0]!)?.lineCost).toBe(20);
    const formula: Formula = { id: 'f', name: 'F', lines, batchSizeGrams: 16 };
    const summary = formulaCost(formula);
    expect(summary.totalCost).toBe(40);
    expect(summary.costPerGramBatch).toBe(2.5);
    expect(summary.batchSizeGrams).toBe(16);
  });

  it('derives batch size from lines when omitted', () => {
    const formula: Formula = {
      id: 'f',
      name: 'F',
      lines: [
        {
          id: '1',
          materialId: 'm',
          label: 'A',
          amountGrams: 8,
          concentrationKind: 'neat',
          costPerGram: 1,
        },
      ],
    };
    expect(formulaCost(formula).batchSizeGrams).toBe(8);
  });
});
