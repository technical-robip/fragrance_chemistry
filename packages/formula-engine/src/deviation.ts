import { linePercent, totalBatchGrams } from './scale';
import type { DeviationReport, FormulaLine, LineDeviation } from './types';

export type TargetPercents = Record<string, number>;

export function deviationFromTargets(
  lines: FormulaLine[],
  targetPercents: TargetPercents,
): DeviationReport {
  const totalGrams = totalBatchGrams(lines);
  const lineDeviations: LineDeviation[] = lines.map((line) => {
    const actualPercent = linePercent(line, totalGrams);
    const targetPercent = targetPercents[line.id] ?? 0;
    return {
      lineId: line.id,
      label: line.label,
      actualPercent: roundPercent(actualPercent),
      targetPercent: roundPercent(targetPercent),
      deltaPercent: roundPercent(actualPercent - targetPercent),
    };
  });

  const totalActualPercent = roundPercent(lineDeviations.reduce((s, l) => s + l.actualPercent, 0));
  const totalTargetPercent = roundPercent(Object.values(targetPercents).reduce((s, p) => s + p, 0));

  return {
    lines: lineDeviations,
    totalActualPercent,
    totalTargetPercent,
  };
}

export function maxAbsoluteDeviation(report: DeviationReport): number {
  if (report.lines.length === 0) return 0;
  return Math.max(...report.lines.map((l) => Math.abs(l.deltaPercent)));
}

function roundPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}
