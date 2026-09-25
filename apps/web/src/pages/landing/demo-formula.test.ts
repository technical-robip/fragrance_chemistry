import { describe, expect, it } from 'vitest';
import {
  activeGrams,
  evaluateIfraCompliance,
  pyramidPercents,
  totalBatchGrams,
} from '@fc/formula-engine';
import {
  allergenSourceCount,
  DEMO_BATCH_GRAMS,
  DEMO_IFRA_CATEGORY,
  DEMO_LINES,
  ILLUSTRATIVE_LIMITS,
  SCALE_RESOLUTION_GRAMS,
} from './demo-formula';

/**
 * The landing page claims two things a visitor cannot check by eye: that
 * allergens are summed across every source, and that a target mass below scale
 * resolution is handled rather than rounded. Both are asserted here against the
 * real engine, so the page cannot keep claiming them if the example stops
 * demonstrating them.
 */
describe('worked example on the landing page', () => {
  it('totals the batch the page states', () => {
    expect(totalBatchGrams(DEMO_LINES)).toBeCloseTo(DEMO_BATCH_GRAMS, 6);
  });

  it('draws linalool from three separate sources', () => {
    expect(allergenSourceCount(DEMO_LINES, 'Linalool')).toBe(3);
  });

  it('sums linalool across those sources rather than reporting the largest', () => {
    const report = evaluateIfraCompliance(DEMO_LINES, DEMO_IFRA_CATEGORY, ILLUSTRATIVE_LIMITS);
    const linalool = report.allergens.find((a) => a.name === 'Linalool');
    expect(linalool).toBeDefined();

    const contributions = DEMO_LINES.filter((line) =>
      line.allergens?.some((a) => a.name === 'Linalool'),
    ).map((line) => {
      const fraction = line.allergens!.find((a) => a.name === 'Linalool')!.fraction;
      return activeGrams(line) * fraction;
    });

    const summed = contributions.reduce((total, grams) => total + grams, 0);
    expect(linalool!.gramsInBatch).toBeCloseTo(summed, 6);
    // Summing has to exceed the single biggest contributor, or the claim is empty.
    expect(linalool!.gramsInBatch).toBeGreaterThan(Math.max(...contributions));
  });

  it('contains a line no bench scale can weigh, expressed as a dilution', () => {
    const damascenone = DEMO_LINES.find((line) => line.id === 'damascenone');
    expect(damascenone).toBeDefined();
    expect(damascenone!.concentrationKind).toBe('dilution');

    const neat = activeGrams(damascenone!);
    expect(neat).toBeGreaterThan(0);
    expect(neat).toBeLessThan(SCALE_RESOLUTION_GRAMS);
    // The stock mass, by contrast, is weighable — that is the whole point.
    expect(damascenone!.amountGrams).toBeGreaterThan(SCALE_RESOLUTION_GRAMS);
  });

  it('spreads the pyramid across all three tiers', () => {
    const concentrate = DEMO_LINES.filter((line) => line.id !== 'carrier');
    const pyramid = pyramidPercents(concentrate);
    expect(pyramid.top).toBeGreaterThan(0);
    expect(pyramid.middle).toBeGreaterThan(0);
    expect(pyramid.base).toBeGreaterThan(0);
    expect(pyramid.top + pyramid.middle + pyramid.base).toBeCloseTo(100, 4);
  });
});
