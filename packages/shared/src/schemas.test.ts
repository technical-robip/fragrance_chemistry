import { describe, expect, it } from 'vitest';
import {
  adjustInventoryBodySchema,
  createEvaluationBodySchema,
  createFormulaBodySchema,
  createMaterialBodySchema,
  createSupplierPriceBodySchema,
  createPostBodySchema,
  costingEstimateQuerySchema,
  dashboardBriefingQuerySchema,
  juiceClassFromConcentration,
  patchInventoryBodySchema,
  listEvaluationsQuerySchema,
  updateEvaluationBodySchema,
  listMaterialsQuerySchema,
  filterCatalogIndex,
  adminAssignSubscriptionBodySchema,
  adminCreatePlanBodySchema,
  changePasswordBodySchema,
  loginBodySchema,
  mergeQuotaMaps,
  PLAN_FEATURE_PRESETS,
  refreshBodySchema,
  registerBodySchema,
  updateAccountBodySchema,
  replaceFormulaLinesBodySchema,
  updateFormulaBodySchema,
  upsertInventoryBodySchema,
} from './index';

const uuid = '11111111-1111-1111-1111-111111111111';

describe('@fc/shared schemas', () => {
  it('validates auth bodies', () => {
    expect(
      registerBodySchema.parse({ email: 'a@b.co', password: 'password1', displayName: 'A' }),
    ).toBeTruthy();
    expect(() =>
      registerBodySchema.parse({ email: 'bad', password: 'x', displayName: '' }),
    ).toThrow();
    expect(loginBodySchema.parse({ email: 'a@b.co', password: 'x' })).toBeTruthy();
    expect(refreshBodySchema.parse({ refreshToken: 'tok' })).toBeTruthy();
    expect(
      updateAccountBodySchema.parse({ displayName: 'Ada', defaultIfraCategory: 4 }).displayName,
    ).toBe('Ada');
    expect(() => updateAccountBodySchema.parse({})).toThrow();
    expect(
      changePasswordBodySchema.parse({ currentPassword: 'oldpass1', newPassword: 'newpass12' }),
    ).toBeTruthy();
    expect(adminCreatePlanBodySchema.parse({ slug: 'Studio-Plus', name: 'Studio+' }).slug).toBe(
      'studio-plus',
    );
    expect(
      adminAssignSubscriptionBodySchema.parse({
        planId: uuid,
        quotaOverrides: { maxFormulas: 10 },
      }).status,
    ).toBe('active');
    expect(mergeQuotaMaps({ maxFormulas: 3 }, { maxFormulas: 10 }).maxFormulas).toBe(10);
    expect(PLAN_FEATURE_PRESETS.free).toContain('workbench');
  });

  it('validates catalog query defaults', () => {
    const q = listMaterialsQuerySchema.parse({});
    expect(q.limit).toBe(100);
    expect(q.offset).toBe(0);
    expect(q.includePrivate).toBe(false);
    expect(
      createMaterialBodySchema.parse({
        name: 'Linalool',
        category: 'aromachemical',
        origin: 'synthetic',
        pyramidNote: 'middle',
      }),
    ).toMatchObject({
      name: 'Linalool',
      stockConcentrationPct: 100,
      costPerGram: 0,
    });
    expect(
      createSupplierPriceBodySchema.parse({
        supplierId: uuid,
        materialId: uuid,
        pricePerGram: 1.5,
        sponsored: true,
      }).sponsored,
    ).toBe(true);
  });

  it('requires solvent when a custom material is diluted', () => {
    expect(() =>
      createMaterialBodySchema.parse({
        name: 'Rose dilution',
        category: 'absolute',
        origin: 'natural',
        pyramidNote: 'middle',
        stockConcentrationPct: 10,
      }),
    ).toThrow();
    expect(
      createMaterialBodySchema.parse({
        name: 'Rose dilution',
        category: 'absolute',
        origin: 'natural',
        pyramidNote: 'middle',
        stockConcentrationPct: 10,
        solvent: 'DPG',
      }).solvent,
    ).toBe('DPG');
  });

  it('parses multi-select catalog CSV filters', () => {
    const q = listMaterialsQuerySchema.parse({
      note: 'top,middle',
      family: 'Floral,Woody',
      manufacturer: 'Firmenich,IFF',
    });
    expect(q.notes).toEqual(['top', 'middle']);
    expect(q.families).toEqual(['Floral', 'Woody']);
    expect(q.manufacturers).toEqual(['Firmenich', 'IFF']);
    expect(listMaterialsQuerySchema.parse({ includePrivate: '1' }).includePrivate).toBe(true);
  });

  it('filters catalog index in memory', () => {
    const items = [
      {
        id: '1',
        name: 'Bergamot EO',
        casNumber: '8007-75-8',
        category: 'essential_oil',
        origin: 'natural',
        olfactoryFamily: 'Fresh',
        pyramidNote: 'top',
        manufacturer: 'Firmenich',
        costPerGram: '0.12',
        slug: 'bergamot-eo',
        imageUrl: null,
        searchText: 'bergamot eo fresh top',
        isPrivate: false,
      },
      {
        id: '2',
        name: 'My Accord',
        casNumber: null,
        category: 'accord',
        origin: 'blend',
        olfactoryFamily: 'Woody',
        pyramidNote: 'base',
        manufacturer: null,
        costPerGram: '0',
        slug: null,
        imageUrl: null,
        searchText: 'my accord woody base',
        isPrivate: true,
      },
    ];
    expect(filterCatalogIndex(items, { q: 'accord' }).map((m) => m.id)).toEqual(['2']);
    expect(filterCatalogIndex(items, { notes: ['top'] }).map((m) => m.id)).toEqual(['1']);
    expect(filterCatalogIndex(items, { families: ['Woody'] }).map((m) => m.id)).toEqual(['2']);
  });

  it('validates formulas inventory evaluations community', () => {
    expect(
      createFormulaBodySchema.parse({
        name: 'F1',
        lines: [{ materialId: uuid, percent: 10 }],
      }).lines,
    ).toHaveLength(1);
    expect(createFormulaBodySchema.parse({ name: 'F1' }).lines).toEqual([]);
    expect(updateFormulaBodySchema.parse({ name: 'Renamed', status: 'ready' }).status).toBe(
      'ready',
    );
    expect(
      replaceFormulaLinesBodySchema.parse({
        lines: [{ materialId: uuid, percent: 100 }],
      }).lines,
    ).toHaveLength(1);
    expect(
      upsertInventoryBodySchema.parse({
        materialId: uuid,
        quantityGrams: 12.5,
        kind: 'consumable',
        minQuantityGrams: 5,
      }).kind,
    ).toBe('consumable');
    expect(adjustInventoryBodySchema.parse({ deltaGrams: -10 }).deltaGrams).toBe(-10);
    expect(patchInventoryBodySchema.parse({ minQuantityGrams: 8 }).minQuantityGrams).toBe(8);
    expect(() => patchInventoryBodySchema.parse({})).toThrow();
    expect(costingEstimateQuerySchema.parse({ batchGrams: '50' }).batchGrams).toBe(50);
    expect(costingEstimateQuerySchema.parse({}).wastePct).toBeUndefined();
    expect(
      createEvaluationBodySchema.parse({
        formulaId: uuid,
        rating: 4,
        macerationDay: 7,
        clarity: 'clear',
      }).macerationDay,
    ).toBe(7);
    expect(() => createEvaluationBodySchema.parse({ formulaId: uuid, rating: 9 })).toThrow();
    expect(listEvaluationsQuerySchema.parse({ formulaId: uuid }).formulaId).toBe(uuid);
    expect(
      updateEvaluationBodySchema.parse({
        t30mNotes: 'drydown',
        lineMarks: [{ materialId: uuid, mark: 'weak' }],
      }).t30mNotes,
    ).toBe('drydown');
    expect(() => updateEvaluationBodySchema.parse({})).toThrow();
    expect(createPostBodySchema.parse({ title: 'Hi', body: 'World' }).title).toBe('Hi');
  });

  it('validates dashboard briefing query and juice class', () => {
    expect(dashboardBriefingQuerySchema.parse({ formulaId: uuid }).formulaId).toBe(uuid);
    expect(() => dashboardBriefingQuerySchema.parse({ formulaId: 'bad' })).toThrow();
    expect(juiceClassFromConcentration(12)).toBe('edt');
    expect(juiceClassFromConcentration(15)).toBe('edp');
    expect(juiceClassFromConcentration(19.9)).toBe('edp');
    expect(juiceClassFromConcentration(20)).toBe('extrait');
  });
});
