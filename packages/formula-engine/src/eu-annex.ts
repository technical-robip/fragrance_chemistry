import { activeGrams, totalBatchGrams } from './scale';
import type { ComplianceStatus, FormulaLine } from './types';
import { EU_ANNEX_III_FRAGRANCE, normalizeCas, type EuAnnexRule } from './eu-data';

export type EuAnnexHit = {
  name: string;
  inci: string;
  casNumber: string;
  restriction: EuAnnexRule['restriction'];
  maxPercent?: number;
  percentOfBatch: number;
  status: ComplianceStatus;
  note: string;
};

export type EuAnnexReport = {
  coverage: 'subset';
  hits: EuAnnexHit[];
};

function casKey(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

const RULES_BY_CAS = new Map<string, EuAnnexRule>();
for (const rule of EU_ANNEX_III_FRAGRANCE) {
  RULES_BY_CAS.set(casKey(rule.cas), rule);
  for (const alias of rule.casAliases) {
    RULES_BY_CAS.set(casKey(alias), rule);
  }
}

export function emptyEuAnnexReport(): EuAnnexReport {
  return { coverage: 'subset', hits: [] };
}

/**
 * Match formula lines to a curated fragrance Annex III subset by CAS.
 * Does not claim complete Annex III or SCCS coverage.
 */
export function evaluateEuAnnexRestrictions(lines: FormulaLine[]): EuAnnexReport {
  const batchTotal = totalBatchGrams(lines);
  const gramsByRule = new Map<EuAnnexRule, number>();

  for (const line of lines) {
    const cas = normalizeCas(line.casNumber ?? undefined);
    if (!cas) continue;
    const rule = RULES_BY_CAS.get(casKey(cas));
    if (!rule) continue;
    gramsByRule.set(rule, (gramsByRule.get(rule) ?? 0) + activeGrams(line));
  }

  const hits: EuAnnexHit[] = [];
  for (const [rule, grams] of gramsByRule) {
    const percentOfBatch = batchTotal > 0 ? (grams / batchTotal) * 100 : 0;
    let status: ComplianceStatus = 'green';
    if (rule.restriction === 'ban' && percentOfBatch > 0) status = 'red';
    else if (rule.restriction === 'max_percent' && rule.maxPercent != null) {
      if (percentOfBatch > rule.maxPercent) status = 'red';
      else if (percentOfBatch >= rule.maxPercent * 0.8) status = 'yellow';
    }
    hits.push({
      name: rule.name,
      inci: rule.inci,
      casNumber: rule.cas,
      restriction: rule.restriction,
      maxPercent: rule.maxPercent,
      percentOfBatch: Math.round(percentOfBatch * 10000) / 10000,
      status,
      note: rule.note,
    });
  }

  hits.sort((a, b) => a.name.localeCompare(b.name));
  return { coverage: 'subset', hits };
}
