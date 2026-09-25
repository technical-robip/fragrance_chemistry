import { describe, expect, it } from 'vitest';
import {
  autoConvertTinyDoses,
  convertLinesTinyDoses,
  dilutionStockForNeatTarget,
  neatAmountFromDilution,
} from './dilution';
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

  it('skips already diluted lines', () => {
    const line: FormulaLine = {
      id: 'l1',
      materialId: 'm1',
      label: 'X',
      amountGrams: 0.0001,
      concentrationKind: 'dilution',
      activeFraction: 0.01,
    };
    expect(autoConvertTinyDoses(line).applied).toBe(false);
  });

  it('throws on invalid dilution fraction', () => {
    const line: FormulaLine = {
      id: 'l1',
      materialId: 'm1',
      label: 'X',
      amountGrams: 0.0001,
      concentrationKind: 'neat',
    };
    expect(() =>
      autoConvertTinyDoses(line, { dilution: { activeFraction: 0, carrierLabel: 'DPG' } }),
    ).toThrow();
  });

  it('helpers convert between neat and stock', () => {
    expect(neatAmountFromDilution(10, 0.1)).toBe(1);
    expect(dilutionStockForNeatTarget(0.0003, 0.01)).toBeCloseTo(0.03);
    expect(() => dilutionStockForNeatTarget(1, 0)).toThrow();
    const converted = convertLinesTinyDoses([
      {
        id: '1',
        materialId: 'm',
        label: 'Tiny',
        amountGrams: 0.0002,
        concentrationKind: 'neat',
      },
    ]);
    expect(converted[0]?.concentrationKind).toBe('dilution');
  });
});
