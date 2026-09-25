import { describe, expect, it } from 'vitest';
import { easeInOutCubic, pourGramsAt, WEIGH_ACTUAL_GRAMS } from './use-pour-grams';

describe('pour grams', () => {
  it('starts at zero and ends at the final overshoot mass', () => {
    expect(pourGramsAt(0)).toBe(0);
    expect(pourGramsAt(1)).toBeCloseTo(WEIGH_ACTUAL_GRAMS, 6);
  });

  it('eases through the middle so the pour stays readable', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
    expect(pourGramsAt(0.25)).toBeLessThan(WEIGH_ACTUAL_GRAMS * 0.35);
    expect(pourGramsAt(0.75)).toBeGreaterThan(WEIGH_ACTUAL_GRAMS * 0.65);
  });
});
