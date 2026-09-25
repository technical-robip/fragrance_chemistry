import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  FORMULA_LINES_COLUMNS,
  formulaWorkbookChecksum,
  type FormulaWorkbookPayload,
} from '@fc/shared';
import { buildFormulaXlsxBuffer } from './formula-xlsx.builder';

function samplePayload(overrides?: Partial<FormulaWorkbookPayload>): FormulaWorkbookPayload {
  const lines = [
    {
      lineId: 'l1',
      materialIdOrSlug: 'hedione',
      materialName: 'Hedione',
      casNumber: '24851-98-7',
      notePosition: 'middle',
      percentConcentrate: 40,
      grams: 4,
      materialDilutionPct: 100,
      materialSolvent: '',
      supplier: 'Firmenich',
      supplierSku: '',
      costPerKg: 120,
      costContribution: 0.48,
      odorDescriptors: ['floral'],
      allergenFlags: ['Linalool'],
      ifraLimitPct: 20,
      ifraUsagePct: 8,
      ifraStatus: 'ok' as const,
      lineNotes: '',
    },
  ];
  return {
    header: {
      formulaId: 'f1',
      slug: 'rose-oud',
      name: 'Rose Oud',
      version: '1',
      status: 'draft',
      productType: 'parfum',
      batchTargetGrams: 10,
      stockConcentrationPct: 20,
      solvent: '',
      ifraCategory: '4',
      pyramidSummary: { top: '', middle: 'Hedione', base: '' },
      description: '',
      tags: [],
      createdBy: 'a@b.co',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
    lines,
    ifraCompliance: [
      {
        materialName: 'Hedione',
        casNumber: '24851-98-7',
        ifraCategory: '4',
        limitPct: 20,
        usagePct: 8,
        marginPct: 12,
        status: 'ok',
      },
    ],
    materialsReference: [
      {
        materialId: 'm1',
        slug: 'hedione',
        name: 'Hedione',
        casNumber: '24851-98-7',
        isPrivate: false,
        defaultDilutionPct: 100,
        defaultSolvent: '',
        odorFamily: 'floral',
      },
    ],
    meta: {
      schemaVersion: '1.0',
      exportedAt: '2026-01-03T00:00:00.000Z',
      exportedBy: 'a@b.co',
      sourceFormulaId: 'f1',
      sourceInstance: 'http://localhost:5173',
      checksum: 'abc',
      formulaFieldKeys: [],
      formulaLinesColumnKeys: FORMULA_LINES_COLUMNS.map((c) => c.key),
    },
    ...overrides,
  };
}

async function readWorkbook(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe('buildFormulaXlsxBuffer', () => {
  it('writes five sheets and hides _meta', async () => {
    const buffer = await buildFormulaXlsxBuffer(samplePayload(), 'enterprise');
    const wb = await readWorkbook(buffer);
    expect(wb.worksheets.map((ws) => ws.name)).toEqual([
      'Formula',
      'Formula_Lines',
      'IFRA_Compliance',
      'Materials_Reference',
      '_meta',
    ]);
    expect(wb.getWorksheet('_meta')?.state).toBe('hidden');
    expect(wb.getWorksheet('IFRA_Compliance')?.state).toBe('visible');
    expect(wb.getWorksheet('Materials_Reference')?.state).toBe('visible');
  });

  it('hides IFRA and materials sheets plus enterprise columns on free', async () => {
    const buffer = await buildFormulaXlsxBuffer(samplePayload(), 'free');
    const wb = await readWorkbook(buffer);
    expect(wb.getWorksheet('IFRA_Compliance')?.state).toBe('hidden');
    expect(wb.getWorksheet('Materials_Reference')?.state).toBe('hidden');
    const lines = wb.getWorksheet('Formula_Lines');
    const casIdx = FORMULA_LINES_COLUMNS.findIndex((c) => c.key === 'casNumber') + 1;
    const skuIdx = FORMULA_LINES_COLUMNS.findIndex((c) => c.key === 'supplierSku') + 1;
    const pctIdx = FORMULA_LINES_COLUMNS.findIndex((c) => c.key === 'percentConcentrate') + 1;
    expect(lines?.getColumn(casIdx).hidden).toBe(true);
    expect(lines?.getColumn(skuIdx).hidden).toBe(true);
    expect(lines?.getColumn(pctIdx).hidden).toBeFalsy();
  });

  it('stores percent as canonical and grams as a derived formula', async () => {
    const buffer = await buildFormulaXlsxBuffer(samplePayload(), 'pro');
    const wb = await readWorkbook(buffer);
    const lines = wb.getWorksheet('Formula_Lines');
    const pctIdx = FORMULA_LINES_COLUMNS.findIndex((c) => c.key === 'percentConcentrate') + 1;
    const gramsIdx = FORMULA_LINES_COLUMNS.findIndex((c) => c.key === 'grams') + 1;
    const pctCell = lines?.getRow(2).getCell(pctIdx);
    const gramsCell = lines?.getRow(2).getCell(gramsIdx);
    expect(pctCell?.value).toBe(40);
    expect(gramsCell?.value).toMatchObject({
      formula: expect.stringContaining('/100*Formula!$B$'),
      result: 4,
    });
  });

  it('does not bake derived grams into the checksum payload', async () => {
    const base = samplePayload();
    const shifted = samplePayload({
      lines: [{ ...base.lines[0]!, grams: 999, costContribution: 50 }],
    });
    expect(await formulaWorkbookChecksum(base.lines)).toBe(
      await formulaWorkbookChecksum(shifted.lines),
    );
  });
});
