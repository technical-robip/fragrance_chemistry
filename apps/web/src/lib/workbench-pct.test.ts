import { describe, expect, it } from 'vitest';
import { fromDisplayPct, roundPct, toDisplayPct } from './workbench-pct';

describe('workbench percent display', () => {
  it('scales 5 and 25 absolute percents to relative shares that sum to 100', () => {
    const top = toDisplayPct(5, 30, 'rel');
    const heart = toDisplayPct(25, 30, 'rel');
    expect(roundPct(top, 2)).toBe(16.67);
    expect(roundPct(heart, 2)).toBe(83.33);
    expect(roundPct(top + heart, 2)).toBe(100);
  });

  it('converts a relative edit of 20 on a 5% line back to absolute 6', () => {
    expect(roundPct(fromDisplayPct(20, 30, 'rel'), 4)).toBe(6);
  });

  it('treats a zero total as absolute so it does not divide', () => {
    expect(toDisplayPct(5, 0, 'rel')).toBe(5);
    expect(fromDisplayPct(5, 0, 'rel')).toBe(5);
  });

  it('round-trips one line from absolute through relative and back', () => {
    const display = toDisplayPct(5, 30, 'rel');
    expect(fromDisplayPct(display, 30, 'rel')).toBeCloseTo(5, 10);
  });

  it('leaves absolute mode unchanged', () => {
    expect(toDisplayPct(5, 30, 'abs')).toBe(5);
    expect(fromDisplayPct(8, 30, 'abs')).toBe(8);
  });
});
