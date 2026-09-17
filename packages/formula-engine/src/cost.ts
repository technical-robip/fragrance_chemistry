import { totalBatchGrams } from './scale';
import type { Formula, FormulaCostSummary, FormulaLine, LineCost } from './types';

export function lineCost(line: FormulaLine): LineCost | null {
  if (line.costPerGram == null) return null;
  const lineCostValue = line.amountGrams * line.costPerGram;
  return {
    lineId: line.id,
    amountGrams: line.amountGrams,
    costPerGram: line.costPerGram,
    lineCost: roundMoney(lineCostValue),
  };
}

export function formulaCost(formula: Formula): FormulaCostSummary {
  const batchSizeGrams = formula.batchSizeGrams ?? totalBatchGrams(formula.lines);

  const lines: LineCost[] = [];
  let totalCost = 0;

  for (const line of formula.lines) {
    const entry = lineCost(line);
    if (entry) {
      lines.push(entry);
      totalCost += entry.lineCost;
    }
  }

  totalCost = roundMoney(totalCost);
  const costPerGramBatch = batchSizeGrams > 0 ? roundMoney(totalCost / batchSizeGrams) : 0;

  return {
    lines,
    totalCost,
    costPerGramBatch,
    batchSizeGrams,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
