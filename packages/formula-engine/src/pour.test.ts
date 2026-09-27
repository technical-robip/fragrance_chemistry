import { describe, expect, it } from 'vitest';
import { applyDiluentPour, applyPour, scaleOpenBatch, type SessionLine } from './pour';

function line(
  key: string,
  percent: number,
  batch: number,
  actual: number | null = null,
): SessionLine {
  return {
    key,
    materialId: key,
    percent,
    targetGrams: (percent / 100) * batch,
    actualGrams: actual,
  };
}

describe('applyPour keepRatios', () => {
  it('grows the batch on the first overshoot and keeps absolute percents', () => {
    const result = applyPour({
      lines: [line('a', 20, 5), line('b', 80, 5)],
      lineKey: 'a',
      actualGrams: 1.1,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: true,
      mode: 'keepRatios',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.adjusted).toBe(true);
    expect(result.batchGrams).toBeCloseTo(5.5, 4);
    expect(result.concentrationPct).toBe(20);
    expect(result.diluentGrams).toBeCloseTo(22, 4);
    expect(result.lines[0]).toMatchObject({ actualGrams: 1.1, percent: 20 });
    expect(result.lines[1]?.percent).toBe(80);
    expect(result.lines[1]?.targetGrams).toBeCloseTo(4.4, 4);
    expect(result.lines[1]?.actualGrams).toBeNull();
  });

  it('leaves already poured lines frozen and rewrites percents from the beaker', () => {
    const result = applyPour({
      lines: [line('a', 20, 5, 1), line('b', 40, 5), line('c', 40, 5)],
      lineKey: 'b',
      actualGrams: 2.2,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: true,
      mode: 'keepRatios',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines[0]?.actualGrams).toBe(1);
    expect(result.lines[0]?.targetGrams).toBeCloseTo(1, 4);
    expect(result.lines[1]?.actualGrams).toBe(2.2);
    expect(result.lines[2]?.targetGrams).toBeCloseTo(2.2, 4);
    expect(result.batchGrams).toBeCloseTo(5.4, 4);
    const percents = result.lines.map((entry) => entry.percent);
    expect(percents.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 2);
    expect(result.lines[0]?.percent).toBeCloseTo((1 / 5.4) * 100, 2);
    expect(result.diluentGrams).toBeCloseTo(22, 3);
    expect(result.concentrationPct).toBeLessThan(20);
  });

  it('does not rescale when the pour is under target', () => {
    const result = applyPour({
      lines: [line('a', 20, 5), line('b', 80, 5)],
      lineKey: 'a',
      actualGrams: 0.9,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: true,
      mode: 'keepRatios',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.adjusted).toBe(false);
    expect(result.batchGrams).toBe(5);
    expect(result.lines[0]?.actualGrams).toBe(0.9);
    expect(result.lines[0]?.percent).toBe(20);
    expect(result.lines[0]?.targetGrams).toBeCloseTo(1, 4);
    expect(result.lines[1]?.targetGrams).toBeCloseTo(4, 4);
    expect(result.diluentGrams).toBeCloseTo(20, 4);
  });

  it('records an overshoot without moving the rest when adjustment is off', () => {
    const result = applyPour({
      lines: [line('a', 20, 5), line('b', 80, 5)],
      lineKey: 'a',
      actualGrams: 1.1,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: false,
      mode: 'keepRatios',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.adjusted).toBe(false);
    expect(result.batchGrams).toBe(5);
    expect(result.lines[1]?.targetGrams).toBeCloseTo(4, 4);
    expect(result.lines[0]?.actualGrams).toBe(1.1);
    expect(result.lines[0]?.targetGrams).toBeCloseTo(1, 4);
  });
});

describe('applyPour keepBatch', () => {
  it('shrinks unpoured lines so the concentrate mass stays put', () => {
    const result = applyPour({
      lines: [line('a', 20, 10), line('b', 30, 10), line('c', 50, 10)],
      lineKey: 'a',
      actualGrams: 3,
      batchGrams: 10,
      concentrationPct: 20,
      adjust: true,
      mode: 'keepBatch',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.batchGrams).toBe(10);
    expect(result.diluentGrams).toBeCloseTo(40, 4);
    expect(result.lines[0]?.actualGrams).toBe(3);
    expect(result.lines[1]?.targetGrams).toBeCloseTo(2.625, 4);
    expect(result.lines[2]?.targetGrams).toBeCloseTo(4.375, 4);
    expect(result.lines.reduce((sum, entry) => sum + entry.targetGrams, 0)).toBeCloseTo(10, 3);
    expect(result.lines.reduce((sum, entry) => sum + entry.percent, 0)).toBeCloseTo(100, 2);
  });

  it('refuses when poured lines already exceed the batch', () => {
    const result = applyPour({
      lines: [line('a', 80, 5, 4), line('b', 20, 5)],
      lineKey: 'b',
      actualGrams: 2,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: true,
      mode: 'keepBatch',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('fixedExceedBatch');
    expect(result.lines[1]?.actualGrams).toBeNull();
    expect(result.batchGrams).toBe(5);
  });
});

describe('scaleOpenBatch', () => {
  it('doubles targets when the batch goes from 5 g to 10 g and leaves percents alone', () => {
    const result = scaleOpenBatch([line('a', 11.11, 5), line('b', 88.89, 5)], 10, 17);
    expect(result.lines[0]?.percent).toBe(11.11);
    expect(result.lines[0]?.targetGrams).toBeCloseTo(1.111, 3);
    expect(result.lines[1]?.targetGrams).toBeCloseTo(8.889, 3);
    expect(result.batchGrams).toBe(10);
    expect(result.diluentGrams).toBeGreaterThan(sessionDiluent(5, 17));
  });
});

describe('applyDiluentPour', () => {
  it('updates concentration only when an adjusted pour overshoots the alcohol', () => {
    const over = applyDiluentPour({
      actualGrams: 22,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: true,
    });
    expect(over.adjusted).toBe(true);
    expect(over.batchGrams).toBe(5);
    expect(over.concentrationPct).toBeLessThan(20);
    expect(over.diluentGrams).toBeCloseTo(22, 3);

    const under = applyDiluentPour({
      actualGrams: 18,
      batchGrams: 5,
      concentrationPct: 20,
      adjust: true,
    });
    expect(under.adjusted).toBe(false);
    expect(under.concentrationPct).toBe(20);
    expect(under.diluentGrams).toBeCloseTo(20, 4);
  });
});

function sessionDiluent(batch: number, concentration: number) {
  return batch / (concentration / 100) - batch;
}
