import { describe, expect, it } from 'vitest';
import { displayToGrams, formatAmount, gramsToDisplay, lineGrams } from './batch-units';

describe('batch units', () => {
  it('scales line grams with the batch and leaves the percent as the stored value', () => {
    expect(lineGrams(11.11, 5)).toBeCloseTo(0.5555, 4);
    expect(lineGrams(11.11, 10)).toBeCloseTo(1.111, 3);
  });

  it('converts ml and drops for display without changing the stored grams', () => {
    const stored = displayToGrams(5, 'grams');
    expect(displayToGrams(Number(gramsToDisplay(stored, 'ml')), 'ml')).toBeCloseTo(stored, 6);
    expect(displayToGrams(Number(gramsToDisplay(stored, 'drops')), 'drops')).toBeCloseTo(stored, 6);
    expect(displayToGrams(10, 'ml')).toBe(10);
    expect(displayToGrams(200, 'drops')).toBe(10);
    expect(gramsToDisplay(5, 'drops')).toBe('100');
    expect(formatAmount(1, 'drops')).toBe('20.0');
  });
});
