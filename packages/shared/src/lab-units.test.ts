import { describe, expect, it } from 'vitest';
import {
  diluentGrams,
  finishedJuiceGrams,
  neatPercent,
  percentToGrams,
  percentToPpt,
  pptToPercent,
} from './lab-units';

describe('lab-units', () => {
  it('converts percent ↔ ppt', () => {
    expect(percentToPpt(20)).toBe(200);
    expect(pptToPercent(150)).toBe(15);
  });

  it('converts percent to grams', () => {
    expect(percentToGrams(25, 100)).toBe(25);
  });

  it('computes neat share of diluted stock', () => {
    expect(neatPercent(20, 10)).toBeCloseTo(2);
  });

  it('computes diluent for juice concentration', () => {
    expect(finishedJuiceGrams(100, 20)).toBeCloseTo(500);
    expect(diluentGrams(100, 20)).toBeCloseTo(400);
    expect(diluentGrams(100, 100)).toBeCloseTo(0);
  });
});
