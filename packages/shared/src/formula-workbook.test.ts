import { describe, expect, it } from 'vitest';
import {
  ifraLineStatus,
  columnsVisibleForTier,
  exportFormulasBodySchema,
  formulaWorkbookChecksum,
  FORMULA_LINES_COLUMNS,
  FORMULA_WORKBOOK_SCHEMA_VERSION,
  isSheetHiddenForTier,
  isSupportedWorkbookSchemaVersion,
  FORMULA_WORKBOOK_SHEETS,
  productTypeFromConcentration,
  toWorkbookLineRow,
  workbookTierFromEntitlements,
} from './formula-workbook';

const line = toWorkbookLineRow(
  {
    id: 'l1',
    materialId: '11111111-1111-1111-1111-111111111111',
    materialSlug: 'hedione',
    materialName: 'Hedione',
    percent: 40,
    stockConcentrationPct: 100,
    costPerGram: 0.12,
    olfactoryFamily: 'floral',
    allergenProfile: { Linalool: 2 },
    ifraLimitPct: 20,
  },
  10,
  20,
);

describe('ifra line status', () => {
  it('marks a used prohibited material as exceeded', () => {
    expect(ifraLineStatus(1.2, 0)).toBe('exceeded');
    expect(ifraLineStatus(0, 0)).toBe('n/a');
    expect(ifraLineStatus(1, null)).toBe('n/a');
  });
});

describe('formula workbook schema', () => {
  it('hides pro+ and enterprise columns on free', () => {
    const visible = columnsVisibleForTier(FORMULA_LINES_COLUMNS, 'free').map((c) => c.key);
    expect(visible).toContain('percentConcentrate');
    expect(visible).toContain('grams');
    expect(visible).not.toContain('casNumber');
    expect(visible).not.toContain('costPerKg');
    expect(visible).not.toContain('supplierSku');
  });

  it('shows pro+ columns on pro and enterprise columns only on enterprise', () => {
    const pro = columnsVisibleForTier(FORMULA_LINES_COLUMNS, 'pro').map((c) => c.key);
    const ent = columnsVisibleForTier(FORMULA_LINES_COLUMNS, 'enterprise').map((c) => c.key);
    expect(pro).toContain('casNumber');
    expect(pro).not.toContain('supplierSku');
    expect(ent).toContain('supplierSku');
    expect(ent).toContain('costContribution');
  });

  it('hides IFRA sheet on free and materials reference below enterprise', () => {
    const ifra = FORMULA_WORKBOOK_SHEETS.find((s) => s.name === 'IFRA_Compliance')!;
    const mats = FORMULA_WORKBOOK_SHEETS.find((s) => s.name === 'Materials_Reference')!;
    const meta = FORMULA_WORKBOOK_SHEETS.find((s) => s.name === '_meta')!;
    expect(isSheetHiddenForTier(ifra, 'free')).toBe(true);
    expect(isSheetHiddenForTier(ifra, 'pro')).toBe(false);
    expect(isSheetHiddenForTier(mats, 'pro')).toBe(true);
    expect(isSheetHiddenForTier(mats, 'enterprise')).toBe(false);
    expect(isSheetHiddenForTier(meta, 'enterprise')).toBe(true);
  });

  it('maps plan slug and feature fallbacks to workbook tier', () => {
    expect(workbookTierFromEntitlements('free', ['workbench'])).toBe('free');
    expect(workbookTierFromEntitlements('pro', [])).toBe('pro');
    expect(workbookTierFromEntitlements('studio', ['costing'])).toBe('pro');
    expect(workbookTierFromEntitlements('studio', ['sponsored_listings'])).toBe('enterprise');
  });

  it('maps juice class to product type without inventing extra kinds', () => {
    expect(productTypeFromConcentration(12)).toBe('edt');
    expect(productTypeFromConcentration(18)).toBe('edp');
    expect(productTypeFromConcentration(22)).toBe('parfum');
  });

  it('keeps checksum stable when derived grams/IFRA change', async () => {
    const shifted = {
      ...line,
      grams: 999,
      costContribution: 50,
      ifraUsagePct: 99,
      ifraStatus: 'exceeded' as const,
    };
    expect(await formulaWorkbookChecksum([line])).toBe(await formulaWorkbookChecksum([shifted]));
  });

  it('changes checksum when canonical percent changes', async () => {
    const edited = { ...line, percentConcentrate: 41 };
    expect(await formulaWorkbookChecksum([line])).not.toBe(await formulaWorkbookChecksum([edited]));
  });

  it('accepts current and older 1.x schema versions and rejects future ones', () => {
    expect(isSupportedWorkbookSchemaVersion(FORMULA_WORKBOOK_SCHEMA_VERSION)).toBe(true);
    expect(isSupportedWorkbookSchemaVersion('1.0')).toBe(true);
    expect(isSupportedWorkbookSchemaVersion('2.0')).toBe(false);
    expect(isSupportedWorkbookSchemaVersion('1.99')).toBe(false);
    expect(isSupportedWorkbookSchemaVersion('nope')).toBe(false);
  });

  it('requires formulaIds or all on the export body', () => {
    expect(() => exportFormulasBodySchema.parse({})).toThrow();
    expect(exportFormulasBodySchema.parse({ all: true }).all).toBe(true);
    expect(
      exportFormulasBodySchema.parse({ formulaIds: ['11111111-1111-1111-1111-111111111111'] })
        .formulaIds,
    ).toHaveLength(1);
  });

  it('derives grams from percent and batch, never from a stored gram field', () => {
    expect(line.grams).toBe(4);
    expect(line.percentConcentrate).toBe(40);
    expect(line.costPerKg).toBe(120);
    expect(line.ifraStatus).toBe('ok');
  });
});
