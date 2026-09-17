import { describe, expect, it } from 'vitest';
import { autoConvertTinyDoses } from './dilution';
import type { FormulaLine } from './types';

describe('autoConvertTinyDoses', () => {
  it('converts Damascenone 0.0003 g neat to 0.03 g of 1% in DPG', () => {
    const line: FormulaLine = {
      id: 'l-dam',
      materialId: 'damascenone',
      label: 'Damascenone',
      amountGrams: 0.0003,
      concentrationKind: 'neat',
    };

    const result = autoConvertTinyDoses(line);

    expect(result.applied).toBe(true);
    expect(result.converted.amountGrams).toBeCloseTo(0.03, 6);
    expect(result.converted.concentrationKind).toBe('dilution');
    expect(result.converted.activeFraction).toBe(0.01);
    expect(result.converted.label).toContain('DPG');
  });

  it('does not convert amounts at or above threshold', () => {
    const line: FormulaLine = {
      id: 'l1',
      materialId: 'm1',
      label: 'Linalool',
      amountGrams: 0.5,
      concentrationKind: 'neat',
    };

    const result = autoConvertTinyDoses(line);
    expect(result.applied).toBe(false);
    expect(result.converted).toEqual(line);
  });
});
