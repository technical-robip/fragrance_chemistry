import { linePercent, totalBatchGrams } from './scale';
import type { FormulaLine } from './types';

export interface RebalanceOptions {
  /** Line ids held fixed while others absorb the remainder to 100%. */
  fixedLineIds?: string[];
  /** Total batch mass to preserve when rebalancing by amount (grams). */
  batchSizeGrams?: number;
}

export interface RebalanceResult {
  lines: FormulaLine[];
  totalPercent: number;
  totalGrams: number;
}

const EPS = 1e-9;

/**
 * Proportionally scales non-fixed lines so stock amounts sum to batchSizeGrams (or current total).
 */
export function rebalanceFormula(
  lines: FormulaLine[],
  options: RebalanceOptions = {},
): RebalanceResult {
  const fixed = new Set(options.fixedLineIds ?? []);
  const currentTotal = totalBatchGrams(lines);
  const targetTotal = options.batchSizeGrams ?? currentTotal;

  if (targetTotal <= EPS || currentTotal <= EPS) {
    return { lines: [...lines], totalPercent: 0, totalGrams: currentTotal };
  }

  let fixedGrams = 0;
  let movableGrams = 0;

  for (const line of lines) {
    if (fixed.has(line.id)) fixedGrams += line.amountGrams;
    else movableGrams += line.amountGrams;
  }

  const remainder = targetTotal - fixedGrams;
  if (remainder < -EPS) {
    throw new Error('Fixed lines exceed target batch size');
  }

  if (movableGrams <= EPS) {
    const totalGrams = totalBatchGrams(lines);
    return {
      lines: [...lines],
      totalPercent: lines.reduce((s, l) => s + linePercent(l, totalGrams), 0),
      totalGrams,
    };
  }

  const scale = remainder / movableGrams;

  const rebalanced = lines.map((line) => {
    if (fixed.has(line.id)) return { ...line };
    return {
      ...line,
      amountGrams: roundGrams(line.amountGrams * scale),
    };
  });

  const totalGrams = totalBatchGrams(rebalanced);
  const totalPercent = rebalanced.reduce((s, l) => s + linePercent(l, totalGrams), 0);

  return {
    lines: rebalanced,
    totalPercent: roundPercent(totalPercent),
    totalGrams,
  };
}

/**
 * Adjusts line amounts so their share of the batch matches targetPercents (sum should be 100).
 */
export function rebalanceToPercents(
  lines: FormulaLine[],
  targetPercents: Record<string, number>,
  batchSizeGrams: number,
): RebalanceResult {
  const rebalanced = lines.map((line) => {
    const pct = targetPercents[line.id] ?? 0;
    return {
      ...line,
      amountGrams: roundGrams((pct / 100) * batchSizeGrams),
    };
  });

  const totalGrams = totalBatchGrams(rebalanced);
  const totalPercent = rebalanced.reduce((s, l) => s + linePercent(l, totalGrams), 0);

  return {
    lines: rebalanced,
    totalPercent: roundPercent(totalPercent),
    totalGrams,
  };
}

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}
