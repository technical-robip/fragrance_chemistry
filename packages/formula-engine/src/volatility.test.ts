import { describe, expect, it } from 'vitest';
import {
  evaporationIndexFromTenacity,
  noteFromTenacityHours,
  pyramidPercentsFromVolatility,
} from './volatility';
import type { VolatilityLine } from './volatility';

function line(
  partial: Partial<VolatilityLine> & { id: string; amountGrams: number },
): VolatilityLine {
  return {
    materialId: partial.materialId ?? partial.id,
    label: partial.label ?? partial.id,
    concentrationKind: partial.concentrationKind ?? 'neat',
    activeFraction: partial.activeFraction ?? 1,
    ...partial,
  };
}

describe('volatility pyramid', () => {
  it('maps tenacity bands', () => {
    expect(noteFromTenacityHours(2)).toBe('top');
    expect(noteFromTenacityHours(12)).toBe('middle');
    expect(noteFromTenacityHours(48)).toBe('base');
  });

  it('weights by evaporation when tenacity present', () => {
    const result = pyramidPercentsFromVolatility([
      line({ id: 'a', amountGrams: 30, tenacityHours: 2 }),
      line({ id: 'b', amountGrams: 40, tenacityHours: 12 }),
      line({ id: 'c', amountGrams: 30, tenacityHours: 48 }),
    ]);
    expect(result.source).toBe('volatility');
    expect(result.top).toBeCloseTo(30, 5);
    expect(result.middle).toBeCloseTo(40, 5);
    expect(result.base).toBeCloseTo(30, 5);
  });

  it('falls back to note tags', () => {
    const result = pyramidPercentsFromVolatility([
      line({ id: 'a', amountGrams: 50, pyramidNote: 'top' }),
      line({ id: 'b', amountGrams: 50, pyramidNote: 'base' }),
    ]);
    expect(result.source).toBe('note');
    expect(result.top).toBeCloseTo(50, 5);
    expect(result.base).toBeCloseTo(50, 5);
  });

  it('derives evaporation index from tenacity', () => {
    expect(evaporationIndexFromTenacity(0.5)).toBeGreaterThan(evaporationIndexFromTenacity(24));
  });
});
