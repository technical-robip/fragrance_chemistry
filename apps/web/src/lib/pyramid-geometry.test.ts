import { describe, expect, it } from 'vitest';
import { pctFromPointer, pyramidSlices } from './pyramid-geometry';

describe('pyramidSlices', () => {
  it('sizes heights proportional to percent and sums to height (minus gaps)', () => {
    const slices = pyramidSlices(
      [
        { id: 'top', percent: 30 },
        { id: 'middle', percent: 40 },
        { id: 'base', percent: 30 },
      ],
      { height: 100, apexY: 0, gap: 0, halfWidth: 50 },
    );
    expect(slices).toHaveLength(3);
    expect(slices[0]!.height).toBeCloseTo(30, 5);
    expect(slices[1]!.height).toBeCloseTo(40, 5);
    expect(slices[2]!.height).toBeCloseTo(30, 5);
    const sum = slices.reduce((s, x) => s + x.height, 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it('skips zero-percent tiers', () => {
    const slices = pyramidSlices([
      { id: 'top', percent: 0 },
      { id: 'middle', percent: 50 },
      { id: 'base', percent: 50 },
    ]);
    expect(slices.map((s) => s.id)).toEqual(['middle', 'base']);
  });

  it('widens monotonically toward the base', () => {
    const slices = pyramidSlices(
      [
        { id: 'top', percent: 25 },
        { id: 'middle', percent: 25 },
        { id: 'base', percent: 50 },
      ],
      { height: 100, apexY: 0, gap: 0 },
    );
    expect(slices[0]!.halfTop).toBeLessThan(slices[0]!.halfBottom);
    expect(slices[0]!.halfBottom).toBeLessThanOrEqual(slices[1]!.halfTop + 0.01);
    expect(slices[1]!.halfBottom).toBeLessThan(slices[2]!.halfBottom);
  });

  it('hides labels on very short slices', () => {
    const slices = pyramidSlices(
      [
        { id: 'top', percent: 1 },
        { id: 'middle', percent: 1 },
        { id: 'base', percent: 98 },
      ],
      { height: 100, gap: 0 },
    );
    expect(slices[0]!.showLabel).toBe(false);
    expect(slices[2]!.showLabel).toBe(true);
  });
});

describe('pctFromPointer', () => {
  const rect = { top: 100, height: 100 };

  it('maps bottom to min and top to max', () => {
    expect(pctFromPointer(200, rect, { min: 1, max: 100, step: 1 })).toBe(1);
    expect(pctFromPointer(100, rect, { min: 1, max: 100, step: 1 })).toBe(100);
  });

  it('clamps and snaps to step', () => {
    expect(pctFromPointer(50, rect, { min: 1, max: 100, step: 0.5 })).toBe(100);
    expect(pctFromPointer(150, rect, { min: 1, max: 100, step: 0.5 })).toBe(50);
    expect(pctFromPointer(149, rect, { min: 1, max: 100, step: 0.5 })).toBe(51);
  });
});
