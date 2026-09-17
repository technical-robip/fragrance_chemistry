import { activeGrams, totalBatchGrams } from './scale';
import type {
  AllergenAggregate,
  ComplianceStatus,
  FormulaLine,
  IfraCategory,
  IfraComplianceReport,
} from './types';

export type AllergenLimitsByCategory = Record<IfraCategory, Record<string, number>>;

export interface IfraEvaluationOptions {
  /** Percent of batch at which status becomes yellow (default 80% of limit). */
  yellowThresholdRatio?: number;
}

const DEFAULT_YELLOW_RATIO = 0.8;

export function aggregateAllergens(lines: FormulaLine[]): Map<string, number> {
  const totals = new Map<string, number>();
  const batchTotal = totalBatchGrams(lines);
  if (batchTotal <= 0) return totals;

  for (const line of lines) {
    if (!line.allergens?.length) continue;
    const neatInBatch = activeGrams(line);
    for (const allergen of line.allergens) {
      const grams = neatInBatch * allergen.fraction;
      totals.set(allergen.name, (totals.get(allergen.name) ?? 0) + grams);
    }
  }

  return totals;
}

export function complianceStatus(
  percentOfBatch: number,
  limitPercent: number | undefined,
  options: IfraEvaluationOptions = {},
): ComplianceStatus {
  if (limitPercent == null || limitPercent <= 0) return 'green';
  const yellowRatio = options.yellowThresholdRatio ?? DEFAULT_YELLOW_RATIO;
  if (percentOfBatch > limitPercent) return 'red';
  if (percentOfBatch >= limitPercent * yellowRatio) return 'yellow';
  return 'green';
}

export function evaluateIfraCompliance(
  lines: FormulaLine[],
  category: IfraCategory,
  limitsByCategory: AllergenLimitsByCategory,
  options?: IfraEvaluationOptions,
): IfraComplianceReport {
  const batchTotal = totalBatchGrams(lines);
  const aggregated = aggregateAllergens(lines);
  const limits = limitsByCategory[category] ?? {};

  const allergens: AllergenAggregate[] = [...aggregated.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, gramsInBatch]) => {
      const percentOfBatch = batchTotal > 0 ? (gramsInBatch / batchTotal) * 100 : 0;
      const limitPercent = limits[name];
      const status = complianceStatus(percentOfBatch, limitPercent, options);
      return {
        name,
        gramsInBatch: roundGrams(gramsInBatch),
        percentOfBatch: roundPercent(percentOfBatch),
        limitPercent,
        status,
      };
    });

  const overallStatus = worstStatus(allergens.map((a) => a.status));

  return {
    category,
    allergens,
    overallStatus,
  };
}

function worstStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPercent(value: number): number {
  return Math.round(value * 10000) / 10000;
}
