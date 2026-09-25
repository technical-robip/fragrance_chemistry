import { aggregateAllergens } from './ifra';
import { totalBatchGrams } from './scale';
import type { FormulaLine } from './types';
import {
  EU_LABEL_ALLERGENS,
  EU_LABEL_THRESHOLD_PERCENT,
  type EuLabelAllergenDef,
  type EuProductStay,
} from './eu-data';

export type { EuProductStay };

export type EuLabelHit = {
  inci: string;
  cas: string;
  percentOfBatch: number;
  thresholdPercent: number;
  declared: boolean;
};

export type EuLabelReport = {
  productStay: EuProductStay;
  thresholdPercent: number;
  coverage: 'subset';
  declared: EuLabelHit[];
  undeclared: EuLabelHit[];
};

const NAME_TO_DEF = new Map<string, EuLabelAllergenDef>();
for (const def of EU_LABEL_ALLERGENS) {
  NAME_TO_DEF.set(def.inci.toLowerCase(), def);
  for (const alias of def.aliases) {
    NAME_TO_DEF.set(alias.toLowerCase(), def);
  }
}

export function resolveEuLabelAllergen(name: string): EuLabelAllergenDef | undefined {
  return NAME_TO_DEF.get(name.trim().toLowerCase());
}

export function emptyEuLabelReport(productStay: EuProductStay = 'leave_on'): EuLabelReport {
  return {
    productStay,
    thresholdPercent: EU_LABEL_THRESHOLD_PERCENT[productStay],
    coverage: 'subset',
    declared: [],
    undeclared: [],
  };
}

/**
 * EU cosmetic label declaration (not IFRA category limits).
 * Leave-on 0.001% / rinse-off 0.01% of the evaluated mass.
 */
export function evaluateEuLabelAllergens(
  lines: FormulaLine[],
  productStay: EuProductStay = 'leave_on',
): EuLabelReport {
  const thresholdPercent = EU_LABEL_THRESHOLD_PERCENT[productStay];
  const batchTotal = totalBatchGrams(lines);
  const aggregated = aggregateAllergens(lines);
  const byInci = new Map<string, number>();

  for (const [name, grams] of aggregated) {
    const def = resolveEuLabelAllergen(name);
    if (!def) continue;
    byInci.set(def.inci, (byInci.get(def.inci) ?? 0) + grams);
  }

  const declared: EuLabelHit[] = [];
  const undeclared: EuLabelHit[] = [];
  for (const def of EU_LABEL_ALLERGENS) {
    const grams = byInci.get(def.inci);
    if (grams == null || grams <= 0) continue;
    const percentOfBatch = batchTotal > 0 ? (grams / batchTotal) * 100 : 0;
    const hit: EuLabelHit = {
      inci: def.inci,
      cas: def.cas,
      percentOfBatch: Math.round(percentOfBatch * 10000) / 10000,
      thresholdPercent,
      declared: percentOfBatch > thresholdPercent,
    };
    if (hit.declared) declared.push(hit);
    else undeclared.push(hit);
  }

  return {
    productStay,
    thresholdPercent,
    coverage: 'subset',
    declared,
    undeclared,
  };
}
