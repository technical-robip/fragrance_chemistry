import type { Formula, FormulaLine, ScaledFormula } from './types';

const EPS = 1e-9;

export function activeGrams(line: FormulaLine): number {
  const fraction = line.concentrationKind === 'neat' ? 1 : (line.activeFraction ?? 0);
  return line.amountGrams * fraction;
}

export function totalBatchGrams(lines: FormulaLine[]): number {
  return lines.reduce((sum, line) => sum + line.amountGrams, 0);
}

export function linePercent(line: FormulaLine, totalGrams: number): number {
  if (totalGrams <= EPS) return 0;
  return (line.amountGrams / totalGrams) * 100;
}

export function scaleFormula(formula: Formula, targetBatchSizeGrams: number): ScaledFormula {
  const currentTotal = totalBatchGrams(formula.lines);
  if (currentTotal <= EPS) {
    return {
      ...formula,
      batchSizeGrams: targetBatchSizeGrams,
      scaleFactor: 1,
      totalGrams: 0,
      lines: formula.lines.map((line) => ({ ...line, amountGrams: 0 })),
    };
  }

  const scaleFactor = targetBatchSizeGrams / currentTotal;
  const lines = formula.lines.map((line) => ({
    ...line,
    amountGrams: roundGrams(line.amountGrams * scaleFactor),
  }));

  const totalGrams = totalBatchGrams(lines);

  return {
    ...formula,
    batchSizeGrams: targetBatchSizeGrams,
    scaleFactor,
    totalGrams,
    lines,
  };
}

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
