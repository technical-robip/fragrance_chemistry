export type DilutionParse = {
  neatName: string;
  concentrationPct: number;
  solvent: string | null;
};

export type MaterialAlias = {
  alias: string;
  catalogName?: string;
  casNumber?: string;
  iupac?: string;
  prohibited?: boolean;
};

export type CatalogIdentity = {
  name: string;
  casNumber?: string | null;
  manufacturer?: string | null;
  iupac?: string | null;
};

export type MatchKind = 'cas' | 'alias' | 'name' | 'miss';

export type CatalogMatch = {
  query: string;
  neatName: string;
  kind: MatchKind;
  catalogName?: string;
  casNumber?: string | null;
  prohibited?: boolean;
  dilution: DilutionParse;
};

export type CoverageReport = {
  total: number;
  cas: number;
  alias: number;
  name: number;
  miss: number;
  matches: CatalogMatch[];
};

export type MergeAction = 'update' | 'skip-duplicate' | 'insert' | 'review';

export type MaterialMergeDecision = {
  action: MergeAction;
  reason: string;
  existingName?: string;
  casNumber?: string | null;
};

export type IfraLimitIncoming = {
  casNumber: string;
  materialName?: string;
  categoryCode: string;
  maxPercent: number;
};

export type IfraLimitExisting = {
  casNumber: string | null;
  materialName: string;
  categoryCode: string;
  maxPercent: number;
};

export type IfraLimitPlanRow = {
  action: 'create' | 'update' | 'unchanged' | 'unmatched';
  casNumber: string;
  categoryCode: string;
  maxPercent: number;
  materialName?: string;
};

const DILUTION_RE = /^(?<neat>.+?)\s+(?<pct>\d+(?:\.\d+)?)\s*%\s*(?:in|w\/w|wt)\s+(?<solvent>.+)$/i;

export function normalizeCas(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, '');
  if (!/^\d{2,7}-\d{2}-\d$/.test(compact)) return compact.toLowerCase();
  return compact;
}

export function stripDilution(rawName: string): DilutionParse {
  const trimmed = rawName.trim().replace(/\s+/g, ' ');
  const match = trimmed.match(DILUTION_RE);
  if (!match?.groups) {
    return { neatName: trimmed, concentrationPct: 100, solvent: null };
  }
  const pct = Number(match.groups.pct);
  return {
    neatName: (match.groups.neat ?? trimmed).trim(),
    concentrationPct: Number.isFinite(pct) ? pct : 100,
    solvent: (match.groups.solvent ?? '').trim() || null,
  };
}

export function normalizeMaterialName(raw: string): string {
  const neat = stripDilution(raw).neatName;
  return neat
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\b(dpg|ipm|etoh|pea|empg|fcf|eo|abs|md)\b/g, ' ')
    .replace(/\b(essential oil|absolute|resinoid|oil|complete|extra|dark|rectified)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function aliasKey(value: string): string {
  return normalizeMaterialName(value);
}

export function indexAliases(aliases: readonly MaterialAlias[]): Map<string, MaterialAlias> {
  const map = new Map<string, MaterialAlias>();
  for (const row of aliases) {
    map.set(aliasKey(row.alias), row);
    if (row.catalogName) map.set(aliasKey(row.catalogName), row);
  }
  return map;
}

function byNormalizedName(rows: readonly CatalogIdentity[]): Map<string, CatalogIdentity[]> {
  const map = new Map<string, CatalogIdentity[]>();
  for (const row of rows) {
    const key = normalizeMaterialName(row.name);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function byCas(rows: readonly CatalogIdentity[]): Map<string, CatalogIdentity[]> {
  const map = new Map<string, CatalogIdentity[]>();
  for (const row of rows) {
    const cas = normalizeCas(row.casNumber);
    if (!cas) continue;
    const list = map.get(cas) ?? [];
    list.push(row);
    map.set(cas, list);
  }
  return map;
}

export function matchCatalog(
  query: string,
  catalog: readonly CatalogIdentity[],
  aliases: readonly MaterialAlias[] = [],
): CatalogMatch {
  const dilution = stripDilution(query);
  const aliasMap = indexAliases(aliases);
  const names = byNormalizedName(catalog);
  const cases = byCas(catalog);
  const alias = aliasMap.get(aliasKey(dilution.neatName));

  const hit = (
    kind: MatchKind,
    row?: CatalogIdentity,
    extra?: Partial<CatalogMatch>,
  ): CatalogMatch => ({
    query,
    neatName: dilution.neatName,
    kind,
    catalogName: row?.name,
    casNumber: row?.casNumber ?? alias?.casNumber ?? null,
    prohibited: alias?.prohibited,
    dilution,
    ...extra,
  });

  if (alias?.casNumber) {
    const casHits = cases.get(normalizeCas(alias.casNumber) ?? '') ?? [];
    if (casHits[0]) return hit('cas', casHits[0], { prohibited: alias.prohibited });
  }
  if (alias?.catalogName) {
    const named = names.get(normalizeMaterialName(alias.catalogName)) ?? [];
    if (named[0]) return hit('alias', named[0], { prohibited: alias.prohibited });
  }

  const direct = names.get(normalizeMaterialName(dilution.neatName)) ?? [];
  if (direct[0]) return hit('name', direct[0]);

  return hit('miss');
}

export function coverageReport(
  queries: readonly string[],
  catalog: readonly CatalogIdentity[],
  aliases: readonly MaterialAlias[] = [],
): CoverageReport {
  const matches = queries.map((query) => matchCatalog(query, catalog, aliases));
  return {
    total: matches.length,
    cas: matches.filter((m) => m.kind === 'cas').length,
    alias: matches.filter((m) => m.kind === 'alias').length,
    name: matches.filter((m) => m.kind === 'name').length,
    miss: matches.filter((m) => m.kind === 'miss').length,
    matches,
  };
}

export function decideMaterialMerge(
  incoming: CatalogIdentity,
  existing: readonly CatalogIdentity[],
  options: { allowInsert?: boolean } = {},
): MaterialMergeDecision {
  const cas = normalizeCas(incoming.casNumber);
  if (cas) {
    const casHits = existing.filter((row) => normalizeCas(row.casNumber) === cas);
    if (casHits.length > 1) {
      return {
        action: 'skip-duplicate',
        reason: `CAS ${cas} already has ${casHits.length} catalog rows`,
        casNumber: cas,
        existingName: casHits.map((r) => r.name).join(', '),
      };
    }
    if (casHits[0]) {
      return {
        action: 'update',
        reason: 'CAS match — fill missing fields, never insert',
        casNumber: cas,
        existingName: casHits[0].name,
      };
    }
  }

  const nameHits = existing.filter(
    (row) =>
      normalizeMaterialName(row.name) === normalizeMaterialName(incoming.name) &&
      (incoming.manufacturer == null ||
        (row.manufacturer ?? null) === (incoming.manufacturer ?? null)),
  );
  if (nameHits[0]) {
    return {
      action: 'update',
      reason: 'Name match — fill missing fields, never insert',
      casNumber: cas,
      existingName: nameHits[0].name,
    };
  }

  if (options.allowInsert) {
    return { action: 'insert', reason: 'No CAS or name match', casNumber: cas };
  }
  return {
    action: 'review',
    reason: 'Unmatched — queue for review, do not auto-insert',
    casNumber: cas,
  };
}

export function planIfraLimitUpserts(
  incoming: readonly IfraLimitIncoming[],
  catalog: readonly CatalogIdentity[],
  existingLimits: readonly IfraLimitExisting[],
): IfraLimitPlanRow[] {
  const cases = byCas(catalog);
  const names = byNormalizedName(catalog);
  return incoming.map((row) => {
    const cas = normalizeCas(row.casNumber);
    const material =
      (cas ? cases.get(cas)?.[0] : undefined) ??
      (row.materialName ? names.get(normalizeMaterialName(row.materialName))?.[0] : undefined);
    if (!material) {
      return {
        action: 'unmatched',
        casNumber: cas ?? row.casNumber,
        categoryCode: row.categoryCode,
        maxPercent: row.maxPercent,
        materialName: row.materialName,
      };
    }
    const current = existingLimits.find(
      (lim) =>
        lim.categoryCode === row.categoryCode &&
        (normalizeCas(lim.casNumber) === cas ||
          normalizeMaterialName(lim.materialName) === normalizeMaterialName(material.name)),
    );
    if (!current) {
      return {
        action: 'create',
        casNumber: cas ?? row.casNumber,
        categoryCode: row.categoryCode,
        maxPercent: row.maxPercent,
        materialName: material.name,
      };
    }
    const same = Number(current.maxPercent) === Number(row.maxPercent);
    return {
      action: same ? 'unchanged' : 'update',
      casNumber: cas ?? row.casNumber,
      categoryCode: row.categoryCode,
      maxPercent: row.maxPercent,
      materialName: material.name,
    };
  });
}

export type ChemistryLookup = (
  name: string,
) => Promise<{ casNumber?: string; iupac?: string } | null>;

export type CasEnrichPlanRow = {
  name: string;
  action: MergeAction;
  casNumber?: string | null;
  iupac?: string | null;
  reason: string;
};

export async function planCasEnrichment(
  catalog: readonly CatalogIdentity[],
  aliases: readonly MaterialAlias[],
  lookup?: ChemistryLookup,
): Promise<CasEnrichPlanRow[]> {
  const aliasMap = indexAliases(aliases);
  const cases = byCas(catalog);
  const out: CasEnrichPlanRow[] = [];

  for (const row of catalog) {
    if (normalizeCas(row.casNumber) && row.iupac) continue;
    const alias = aliasMap.get(aliasKey(row.name));
    let cas = normalizeCas(row.casNumber) ?? normalizeCas(alias?.casNumber);
    let iupac = row.iupac ?? alias?.iupac ?? null;
    if ((!cas || !iupac) && lookup) {
      const found = await lookup(row.name);
      cas = cas ?? normalizeCas(found?.casNumber);
      iupac = iupac ?? found?.iupac ?? null;
    }
    if (!cas && !iupac) continue;
    if (cas) {
      const others = (cases.get(cas) ?? []).filter((hit) => hit.name !== row.name);
      if (others.length > 0) {
        out.push({
          name: row.name,
          action: 'skip-duplicate',
          casNumber: cas,
          iupac,
          reason: `CAS ${cas} already on ${others.map((o) => o.name).join(', ')}`,
        });
        continue;
      }
    }
    out.push({
      name: row.name,
      action: 'update',
      casNumber: cas,
      iupac,
      reason: 'Fill null CAS/IUPAC on existing row',
    });
  }
  return out;
}

export function duplicateCasReport(
  catalog: readonly CatalogIdentity[],
): Array<{ cas: string; names: string[] }> {
  const grouped = byCas(catalog);
  return [...grouped.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([cas, rows]) => ({ cas, names: rows.map((r) => r.name) }));
}
