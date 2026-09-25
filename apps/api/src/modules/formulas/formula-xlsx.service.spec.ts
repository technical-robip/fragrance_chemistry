import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assembleFormulaWorkbookPayload } from './formula-xlsx.mapper';
import { FormulaXlsxService, XLSX_MIME, ZIP_MIME } from './formula-xlsx.service';
import type { FormulaDetail } from './formulas.service';

const user = { sub: 'u1', email: 'a@b.co' };

function formula(id: string, slug: string): FormulaDetail {
  return {
    id,
    ownerId: 'u1',
    name: slug,
    slug,
    description: null,
    version: 1,
    batchTargetGrams: '10',
    concentrationPct: '20',
    status: 'draft',
    isLibraryAccord: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    lines: [
      {
        id: `${id}-l1`,
        formulaId: id,
        materialId: 'm1',
        percent: '40',
        targetGrams: null,
        weighedGrams: null,
        stockConcentrationPct: '100',
        solvent: null,
        pyramidNote: 'middle',
        sortOrder: 0,
        childFormulaId: null,
        materialName: 'Hedione',
        manufacturer: 'Firmenich',
        olfactoryFamily: 'floral',
        materialPyramidNote: 'middle',
        materialSlug: 'hedione',
        materialImageUrl: null,
        costPerGram: '0.12',
        casNumber: '24851-98-7',
        allergenProfile: { Linalool: 2 },
        tenacityHours: null,
        slug: 'hedione',
        imageUrl: null,
      },
    ],
  } as unknown as FormulaDetail;
}

function selectChain(rows: unknown[], withLimit = false) {
  const whereResult = withLimit ? { limit: async () => rows } : Promise.resolve(rows);
  return {
    from: () => ({
      where: () => whereResult,
      innerJoin: () => ({
        where: async () => rows,
      }),
    }),
  };
}

describe('assembleFormulaWorkbookPayload', () => {
  it('maps concentrationPct onto header stockConcentrationPct and derives grams', async () => {
    const payload = await assembleFormulaWorkbookPayload(formula('f1', 'rose-oud'), {
      createdBy: 'a@b.co',
      sourceInstance: 'lab',
      ifraCategory: 4,
      ifraLimitsByMaterialId: new Map([['m1', 20]]),
      ifraLimitsByName: new Map([['Hedione', 20]]),
      materialsById: new Map([
        [
          'm1',
          {
            id: 'm1',
            slug: 'hedione',
            name: 'Hedione',
            casNumber: '24851-98-7',
            ownerId: null,
            stockConcentrationPct: '100',
            solvent: null,
            olfactoryFamily: 'floral',
          },
        ],
      ]),
      exportedAt: new Date('2026-01-03T00:00:00Z'),
    });
    expect(payload.header.stockConcentrationPct).toBe(20);
    expect(payload.header.productType).toBe('parfum');
    expect(payload.lines[0]?.grams).toBe(4);
    expect(payload.lines[0]?.percentConcentrate).toBe(40);
    expect(payload.materialsReference[0]?.isPrivate).toBe(false);
    expect(payload.meta.schemaVersion).toBe('1.0');
    expect(payload.ifraCompliance.length).toBeGreaterThan(0);
  });
});

describe('FormulaXlsxService', () => {
  let svc: FormulaXlsxService;
  let client: { select: ReturnType<typeof vi.fn> };
  let formulas: { list: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = { select: vi.fn() };
    formulas = {
      list: vi.fn(),
      get: vi.fn(),
    };
    svc = new FormulaXlsxService(
      { client: () => client } as any,
      formulas as any,
      {
        resolve: vi.fn(async () => ({
          plan: { slug: 'pro' },
          features: ['workbench', 'costing', 'pdf_export'],
        })),
      } as any,
    );
  });

  function mockLookups() {
    client.select
      .mockReturnValueOnce(selectChain([{ defaultIfraCategory: 4, email: 'a@b.co' }], true))
      .mockReturnValueOnce(selectChain([], true))
      .mockReturnValueOnce(selectChain([]));
  }

  it('returns a single xlsx for one formula', async () => {
    formulas.get.mockResolvedValue(formula('f1', 'rose-oud'));
    mockLookups();
    const file = await svc.exportWorkbook(user, {
      formulaIds: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(file.mime).toBe(XLSX_MIME);
    expect(file.filename).toBe('rose-oud.xlsx');
    expect(file.buffer.length).toBeGreaterThan(100);
  });

  it('zips multiple formulas', async () => {
    formulas.get
      .mockResolvedValueOnce(formula('f1', 'rose-oud'))
      .mockResolvedValueOnce(formula('f2', 'citrus-splash'));
    mockLookups();
    const file = await svc.exportWorkbook(user, {
      formulaIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
    });
    expect(file.mime).toBe(ZIP_MIME);
    expect(file.filename).toBe('formulas-export.zip');
  });

  it('rejects empty portfolios', async () => {
    formulas.list.mockResolvedValue([]);
    await expect(svc.exportWorkbook(user, { all: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
