import { describe, expect, it } from 'vitest';
import { deviationFromTargets, maxAbsoluteDeviation } from './deviation';
import type { FormulaLine } from './types';

const lines: FormulaLine[] = [
  {
    id: 'a',
    materialId: '1',
    label: 'A',
    amountGrams: 50,
    concentrationKind: 'neat',
  },
  {
    id: 'b',
    materialId: '2',
    label: 'B',
    amountGrams: 50,
    concentrationKind: 'neat',
  },
];

describe('deviation', () => {
  it('compares actual vs target percents', () => {
    const report = deviationFromTargets(lines, { a: 40, b: 60 });
    expect(report.lines).toHaveLength(2);
    expect(report.totalActualPercent).toBeCloseTo(100);
    expect(report.totalTargetPercent).toBeCloseTo(100);
    expect(report.lines[0]!.deltaPercent).toBeCloseTo(10);
  });

  it('defaults missing targets to 0', () => {
    const report = deviationFromTargets(lines, {});
    expect(report.lines[0]!.targetPercent).toBe(0);
  });

  it('maxAbsoluteDeviation handles empty', () => {
    expect(maxAbsoluteDeviation({ lines: [], totalActualPercent: 0, totalTargetPercent: 0 })).toBe(
      0,
    );
    const report = deviationFromTargets(lines, { a: 40, b: 60 });
    expect(maxAbsoluteDeviation(report)).toBeGreaterThan(0);
  });
});
