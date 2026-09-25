import { describe, expect, it } from 'vitest';
import {
  collapseIfraExcelCode,
  IFRA_PRODUCT_CATEGORIES,
  mostRestrictiveLimit,
  parseIfraLimitCell,
} from './ifra-categories';
import {
  coverageReport,
  decideMaterialMerge,
  duplicateCasReport,
  matchCatalog,
  normalizeCas,
  planCasEnrichment,
  planIfraLimitUpserts,
  stripDilution,
  type CatalogIdentity,
  type MaterialAlias,
} from './material-identity';

const catalog: CatalogIdentity[] = [
  { name: 'Hedione', casNumber: '24851-98-7', manufacturer: 'Firmenich' },
  { name: 'DPG', casNumber: '25265-71-8' },
  { name: 'Bergamot EO', casNumber: '8007-75-8' },
  { name: 'Verdox', casNumber: '88-41-5' },
  { name: 'Ionone Beta', casNumber: '14901-07-6' },
  { name: 'Oakmoss Absolute', casNumber: '9000-50-4' },
  { name: 'Galaxolide', casNumber: '1222-05-5' },
  { name: 'Linalool', casNumber: '78-70-6' },
  { name: 'Linalool Isolate', casNumber: '78-70-6' },
];

const aliases: MaterialAlias[] = [
  { alias: 'Methyl Dihydrojasmonate', catalogName: 'Hedione', casNumber: '24851-98-7' },
  { alias: 'Dipropylene Glycol (DPG)', catalogName: 'DPG', casNumber: '25265-71-8' },
  { alias: 'Bergamot FCF', catalogName: 'Bergamot EO', casNumber: '8007-75-8' },
  { alias: 'Beta Ionone', catalogName: 'Ionone Beta', casNumber: '14901-07-6' },
  { alias: 'Oakmoss Abs', catalogName: 'Oakmoss Absolute' },
  { alias: 'Lilial', casNumber: '80-54-6', prohibited: true },
];

describe('material identity', () => {
  it('strips dilution suffixes instead of treating them as new materials', () => {
    const parsed = stripDilution('Beta Damascone 10% in DPG');
    expect(parsed.neatName).toBe('Beta Damascone');
    expect(parsed.concentrationPct).toBe(10);
    expect(parsed.solvent).toBe('DPG');
    expect(stripDilution('Galaxolide 50% in IPM').concentrationPct).toBe(50);
    expect(stripDilution('Hedione').concentrationPct).toBe(100);
  });

  it('normalizes CAS and matches Hedione via trade-name alias CAS', () => {
    expect(normalizeCas(' 24851-98-7 ')).toBe('24851-98-7');
    const hit = matchCatalog('Methyl Dihydrojasmonate', catalog, aliases);
    expect(hit.kind).toBe('cas');
    expect(hit.catalogName).toBe('Hedione');
  });

  it('matches diluted Galaxolide to the neat catalog row', () => {
    const hit = matchCatalog('Galaxolide 50% in IPM', catalog, aliases);
    expect(hit.kind).toBe('name');
    expect(hit.catalogName).toBe('Galaxolide');
    expect(hit.dilution.concentrationPct).toBe(50);
    expect(hit.dilution.solvent).toBe('IPM');
  });

  it('reports coverage cas/alias/name/miss without ingesting', () => {
    const report = coverageReport(
      ['Hedione', 'Bergamot FCF', 'Beta Ionone', 'Prunella', 'Lilial'],
      catalog,
      aliases,
    );
    expect(report.total).toBe(5);
    expect(report.cas).toBeGreaterThanOrEqual(1);
    expect(report.alias + report.cas).toBeGreaterThanOrEqual(2);
    expect(report.miss).toBeGreaterThanOrEqual(1);
    expect(report.matches.find((m) => m.query === 'Prunella')?.kind).toBe('miss');
    expect(report.matches.find((m) => m.query === 'Lilial')?.prohibited).toBe(true);
  });

  it('merges on CAS and never inserts when the CAS already exists', () => {
    const update = decideMaterialMerge(
      { name: 'Methyl dihydrojasmonate', casNumber: '24851-98-7' },
      catalog,
    );
    expect(update.action).toBe('update');
    const dup = decideMaterialMerge({ name: 'Linalool extra', casNumber: '78-70-6' }, catalog);
    expect(dup.action).toBe('skip-duplicate');
    const review = decideMaterialMerge({ name: 'Prunella' }, catalog, { allowInsert: false });
    expect(review.action).toBe('review');
    const insert = decideMaterialMerge({ name: 'Prunella' }, catalog, { allowInsert: true });
    expect(insert.action).toBe('insert');
  });

  it('lists duplicate CAS rows for merge reports', () => {
    const dups = duplicateCasReport(catalog);
    expect(dups.some((row) => row.cas === '78-70-6' && row.names.length === 2)).toBe(true);
  });

  it('plans idempotent IFRA upserts by CAS', () => {
    const first = planIfraLimitUpserts(
      [{ casNumber: '78-70-6', categoryCode: '4', maxPercent: 20 }],
      catalog,
      [],
    );
    expect(first[0]?.action).toBe('create');
    const again = planIfraLimitUpserts(
      [{ casNumber: '78-70-6', categoryCode: '4', maxPercent: 20 }],
      catalog,
      [{ casNumber: '78-70-6', materialName: 'Linalool', categoryCode: '4', maxPercent: 20 }],
    );
    expect(again[0]?.action).toBe('unchanged');
    const unmatched = planIfraLimitUpserts(
      [{ casNumber: '80-54-6', categoryCode: '4', maxPercent: 0 }],
      catalog,
      [],
    );
    expect(unmatched[0]?.action).toBe('unmatched');
    const byName = planIfraLimitUpserts(
      [{ casNumber: '', materialName: 'Hedione', categoryCode: '4', maxPercent: 12 }],
      catalog,
      [],
    );
    expect(byName[0]?.action).toBe('create');
    const changed = planIfraLimitUpserts(
      [{ casNumber: '78-70-6', categoryCode: '4', maxPercent: 15 }],
      catalog,
      [{ casNumber: '78-70-6', materialName: 'Linalool', categoryCode: '4', maxPercent: 20 }],
    );
    expect(changed[0]?.action).toBe('update');
  });

  it('collapses IFRA Excel 5A/10A into the 12 product categories', () => {
    expect(IFRA_PRODUCT_CATEGORIES).toHaveLength(12);
    expect(collapseIfraExcelCode('Cat 5A')).toBe('5');
    expect(collapseIfraExcelCode('10A')).toBe('10');
    expect(collapseIfraExcelCode('12')).toBe('12');
    expect(collapseIfraExcelCode('nope')).toBeNull();
    expect(parseIfraLimitCell(null)).toBeNull();
    expect(parseIfraLimitCell(20)).toBe(20);
    expect(parseIfraLimitCell(-1)).toBe(0);
    expect(parseIfraLimitCell(Number.NaN)).toBeNull();
    expect(parseIfraLimitCell('Prohibited')).toBe(0);
    expect(parseIfraLimitCell('NS')).toBeNull();
    expect(parseIfraLimitCell('0.21%')).toBe(0.21);
    expect(parseIfraLimitCell('-2')).toBe(0);
    expect(parseIfraLimitCell('nope')).toBeNull();
    expect(mostRestrictiveLimit([0.7, 0.2, null])).toBe(0.2);
    expect(mostRestrictiveLimit([null])).toBeNull();
  });

  it('fills null CAS on existing rows via alias and skips colliding CAS', async () => {
    const sparse: CatalogIdentity[] = [
      { name: 'Hedione', casNumber: null },
      { name: 'Mystery', casNumber: null },
    ];
    const plan = await planCasEnrichment(sparse, aliases, async (name) =>
      name === 'Mystery' ? { casNumber: '24851-98-7', iupac: 'x' } : null,
    );
    const hedione = plan.find((row) => row.name === 'Hedione');
    expect(hedione?.action).toBe('update');
    expect(hedione?.casNumber).toBe('24851-98-7');
    const dupPlan = await planCasEnrichment(
      [
        { name: 'Hedione', casNumber: '24851-98-7' },
        { name: 'Hedione HC', casNumber: null },
      ],
      [{ alias: 'Hedione HC', casNumber: '24851-98-7' }],
    );
    expect(dupPlan.find((row) => row.name === 'Hedione HC')?.action).toBe('skip-duplicate');
  });
});
