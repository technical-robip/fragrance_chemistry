import {
  IFRA_LIMIT_CATEGORY_CODES,
  IFRA_PRODUCT_CATEGORIES,
  collapseIfraExcelCode,
  parseIfraDecimal,
  type IfraLimitCategoryCode,
  type IfraProductCategoryCode,
} from './ifra-categories';
import { normalizeCas, normalizeMaterialName, type MaterialAlias } from './material-identity';

export type IfraStandardType =
  'RESTRICTION' | 'PROHIBITION' | 'SPECIFICATION' | 'RESTRICTION_SPECIFICATION';

export type IfraCategoryLimit = {
  categoryCode: IfraLimitCategoryCode;
  maxPercent: number | null;
  unrestricted: boolean;
};

export type IfraStandardDraft = {
  code: string;
  name: string;
  amendment: number | null;
  publicationYears: string | null;
  lastPublicationYear: number | null;
  deadlineExisting: string | null;
  deadlineNew: string | null;
  standardType: IfraStandardType;
  riskDrivers: string | null;
  flavorNote: string | null;
  phototoxicityNote: string | null;
  restrictionNote: string | null;
  specificationNote: string | null;
  otherSources: string | null;
  otherSourcesNote: string | null;
  casComment: string | null;
  synonyms: string[];
  casNumbers: string[];
  limits: IfraCategoryLimit[];
};

export type IfraCatalogRow = {
  name: string;
  casNumber?: string | null;
};

export type IfraAssociation =
  | {
      action: 'link';
      matchKind: 'cas' | 'name';
      standardCode: string;
      materialName: string;
    }
  | {
      action: 'fill-cas';
      standardCode: string;
      materialName: string;
      casNumber: string;
    }
  | {
      action: 'conflict-cas';
      standardCode: string;
      materialName: string;
      existingCas: string;
      standardCas: string;
    }
  | {
      action: 'create';
      standardCode: string;
      name: string;
      casNumber: string | null;
      category: 'IFRA restriction' | 'IFRA prohibition';
    };

const CAS_RE = /\d{2,7}-\d{2}-\d/g;

export function parseIfraStandardType(raw: string): IfraStandardType | null {
  const token = raw.toUpperCase().replace(/[\s-]+/g, '_');
  if (token.includes('RESTRICTION') && token.includes('SPECIFICATION')) {
    return 'RESTRICTION_SPECIFICATION';
  }
  if (token.includes('PROHIBIT')) return 'PROHIBITION';
  if (token.includes('SPECIFICATION')) return 'SPECIFICATION';
  if (token.includes('RESTRICTION')) return 'RESTRICTION';
  return null;
}

export function isUnrestrictedLimitText(raw: string): boolean {
  return /NO\s+RESTRICTION/i.test(raw.trim());
}

/** One overview limit cell: percent, explicit no-restriction, or absent. */
export function parseIfraCategoryCell(value: unknown): {
  maxPercent: number | null;
  unrestricted: boolean;
} {
  if (value == null) return { maxPercent: null, unrestricted: false };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { maxPercent: null, unrestricted: false };
    return { maxPercent: value < 0 ? 0 : value, unrestricted: false };
  }
  const text = String(value).trim();
  if (!text || /^(NS|N\/S|NA|N\/A|-|—|–)$/i.test(text)) {
    return { maxPercent: null, unrestricted: false };
  }
  if (isUnrestrictedLimitText(text)) return { maxPercent: null, unrestricted: true };
  if (/(PROHIBIT|BANNED|NOT PERMITTED|NOT TO BE USED)/i.test(text)) {
    return { maxPercent: 0, unrestricted: false };
  }
  const numeric = parseIfraDecimal(text);
  if (numeric == null) return { maxPercent: null, unrestricted: false };
  return { maxPercent: numeric < 0 ? 0 : numeric, unrestricted: false };
}

export function limitsFromCategoryCells(cells: ReadonlyArray<unknown>): IfraCategoryLimit[] {
  return IFRA_LIMIT_CATEGORY_CODES.map((categoryCode, index) => {
    const parsed = parseIfraCategoryCell(cells[index]);
    return { categoryCode, ...parsed };
  });
}

/** Lowest numeric subcategory limit for each product code 1–12. */
export function collapseStandardLimits(
  limits: readonly IfraCategoryLimit[],
): Array<{ categoryCode: IfraProductCategoryCode; maxPercent: number }> {
  const grouped = new Map<IfraProductCategoryCode, number[]>();
  for (const limit of limits) {
    if (limit.unrestricted || limit.maxPercent == null) continue;
    const product = collapseIfraExcelCode(limit.categoryCode);
    if (!product) continue;
    const list = grouped.get(product) ?? [];
    list.push(limit.maxPercent);
    grouped.set(product, list);
  }
  return IFRA_PRODUCT_CATEGORIES.flatMap((category) => {
    const values = grouped.get(category.code);
    if (!values?.length) return [];
    return [{ categoryCode: category.code, maxPercent: Math.min(...values) }];
  });
}

export function prohibitionProductLimits(): Array<{
  categoryCode: IfraProductCategoryCode;
  maxPercent: number;
}> {
  return IFRA_PRODUCT_CATEGORIES.map((category) => ({
    categoryCode: category.code,
    maxPercent: 0,
  }));
}

export function materialCategoryForStandard(
  standardType: IfraStandardType,
): 'IFRA restriction' | 'IFRA prohibition' {
  return standardType === 'PROHIBITION' ? 'IFRA prohibition' : 'IFRA restriction';
}

function casSet(values: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    const cas = normalizeCas(value);
    if (cas) set.add(cas);
  }
  return set;
}

function nameKeys(standard: IfraStandardDraft, aliases: readonly MaterialAlias[]): Set<string> {
  const keys = new Set<string>();
  const add = (value: string | null | undefined) => {
    const key = value ? normalizeMaterialName(value) : '';
    if (key) keys.add(key);
  };
  add(standard.name);
  for (const synonym of standard.synonyms) add(synonym.replace(/\s*\(commercial name\)\s*/gi, ''));
  const standardCas = casSet(standard.casNumbers);
  for (const alias of aliases) {
    const aliasCas = alias.casNumber ? normalizeCas(alias.casNumber) : null;
    const aliasName = alias.catalogName ? normalizeMaterialName(alias.catalogName) : '';
    const pointsHere =
      (aliasCas != null && standardCas.has(aliasCas)) || (aliasName !== '' && keys.has(aliasName));
    if (pointsHere) add(alias.alias);
  }
  return keys;
}

/**
 * Link every catalog row that is the restricted substance. Create a catalog
 * material only when nothing matches. Name match is exact after normalization.
 */
export function planIfraAssociations(
  standards: readonly IfraStandardDraft[],
  catalog: readonly IfraCatalogRow[],
  aliases: readonly MaterialAlias[] = [],
): IfraAssociation[] {
  const actions: IfraAssociation[] = [];

  for (const standard of standards) {
    const standardCas = casSet(standard.casNumbers);
    const keys = nameKeys(standard, aliases);
    const casHits = catalog.filter((row) => {
      const cas = normalizeCas(row.casNumber);
      return cas != null && standardCas.has(cas);
    });
    const nameHits = catalog.filter((row) => keys.has(normalizeMaterialName(row.name)));
    const linked = new Set<string>();

    for (const row of casHits) {
      const key = row.name.toLowerCase();
      if (linked.has(key)) continue;
      linked.add(key);
      actions.push({
        action: 'link',
        matchKind: 'cas',
        standardCode: standard.code,
        materialName: row.name,
      });
    }

    for (const row of nameHits) {
      const key = row.name.toLowerCase();
      if (linked.has(key)) continue;
      linked.add(key);
      const existing = normalizeCas(row.casNumber);
      const onlyCas =
        standard.casNumbers.length === 1 ? normalizeCas(standard.casNumbers[0]) : null;
      if (
        !existing &&
        onlyCas &&
        !catalog.some((other) => normalizeCas(other.casNumber) === onlyCas)
      ) {
        actions.push({
          action: 'fill-cas',
          standardCode: standard.code,
          materialName: row.name,
          casNumber: onlyCas,
        });
      } else if (existing && onlyCas && existing !== onlyCas) {
        actions.push({
          action: 'conflict-cas',
          standardCode: standard.code,
          materialName: row.name,
          existingCas: existing,
          standardCas: onlyCas,
        });
      }
      actions.push({
        action: 'link',
        matchKind: 'name',
        standardCode: standard.code,
        materialName: row.name,
      });
    }

    if (linked.size === 0) {
      actions.push({
        action: 'create',
        standardCode: standard.code,
        name: standard.name,
        casNumber: standard.casNumbers[0] ? normalizeCas(standard.casNumbers[0]) : null,
        category: materialCategoryForStandard(standard.standardType),
      });
    }
  }

  return actions;
}

function collapseSpace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function draftFromOverviewFields(
  fields: Record<string, string | null | undefined>,
): IfraStandardDraft | null {
  const rawCode = collapseSpace(fields.code);
  const code = rawCode.match(/IFRA_STD_\d+/)?.[0] ?? (rawCode.startsWith('IFRA_') ? rawCode : '');
  const name = collapseSpace(fields.name);
  const typeToken = collapseSpace(fields.type).replace(/\s+/g, '');
  const standardType = parseIfraStandardType(typeToken);
  if (!code || !name || !standardType) return null;

  const casNumbers = extractCasNumbers(`${fields.cas ?? ''}\n${fields.casComment ?? ''}`);
  const synonyms = (fields.synonyms ?? '')
    .split(/\n+/)
    .map((line) => collapseSpace(line))
    .filter((line) => line.length > 1 && !/scope of this standard/i.test(line));

  const amendment = Number(collapseSpace(fields.amendment).match(/\d{2}/)?.[0]);
  const lastYear = Number(collapseSpace(fields.lastYear).match(/\d{4}/)?.[0]);
  const limitCells = IFRA_LIMIT_CATEGORY_CODES.map((category) => fields[`limit:${category}`] ?? '');

  return {
    code,
    name,
    amendment: Number.isFinite(amendment) ? amendment : null,
    publicationYears: collapseSpace(fields.publicationYears) || null,
    lastPublicationYear: Number.isFinite(lastYear) ? lastYear : null,
    deadlineExisting: collapseSpace(fields.deadlineExisting) || null,
    deadlineNew: collapseSpace(fields.deadlineNew) || null,
    standardType,
    riskDrivers: collapseSpace(fields.risk) || null,
    flavorNote: collapseSpace(fields.flavor) || null,
    phototoxicityNote: collapseSpace(fields.phototoxicity) || null,
    restrictionNote: collapseSpace(fields.restriction) || null,
    specificationNote: collapseSpace(fields.specification) || null,
    otherSources: collapseSpace(fields.otherSources) || null,
    otherSourcesNote: collapseSpace(fields.otherSourcesNote) || null,
    casComment: collapseSpace(fields.casComment) || null,
    synonyms,
    casNumbers,
    limits: standardType === 'PROHIBITION' ? [] : limitsFromCategoryCells(limitCells),
  };
}

export function extractCasNumbers(text: string): string[] {
  const found = text.match(CAS_RE) ?? [];
  const unique: string[] = [];
  for (const cas of found) {
    if (!unique.includes(cas)) unique.push(cas);
  }
  return unique;
}
