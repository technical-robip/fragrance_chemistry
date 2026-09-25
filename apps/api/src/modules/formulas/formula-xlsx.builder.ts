import ExcelJS from 'exceljs';
import {
  FORMULA_HEADER_FIELDS,
  FORMULA_LINES_COLUMNS,
  FORMULA_WORKBOOK_SHEETS,
  IFRA_COMPLIANCE_COLUMNS,
  MATERIALS_REFERENCE_COLUMNS,
  META_FIELDS,
  formatWorkbookScalar,
  isFieldHiddenForTier,
  isSheetHiddenForTier,
  type FormulaWorkbookPayload,
  type WorkbookFieldDef,
  type WorkbookSheetDef,
  type WorkbookTier,
} from '@fc/shared';

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F3D3A' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFF4EFE4' } };

function columnLetter(index0: number): string {
  let n = index0 + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle' };
}

function addKeyValueSheet(
  wb: ExcelJS.Workbook,
  sheet: WorkbookSheetDef,
  fields: readonly WorkbookFieldDef[],
  values: Record<string, unknown>,
  tier: WorkbookTier,
) {
  const ws = wb.addWorksheet(sheet.name);
  ws.state = isSheetHiddenForTier(sheet, tier) ? 'hidden' : 'visible';
  const header = ws.addRow(['Field', 'Value']);
  styleHeaderRow(header);
  ws.getColumn(1).width = 36;
  ws.getColumn(2).width = 48;

  for (const field of fields) {
    const row = ws.addRow([field.label, formatWorkbookScalar(values[field.key])]);
    if (isFieldHiddenForTier(field, tier)) row.hidden = true;
  }
}

function addTableSheet(
  wb: ExcelJS.Workbook,
  sheet: WorkbookSheetDef,
  columns: readonly WorkbookFieldDef[],
  rows: Array<Record<string, unknown>>,
  tier: WorkbookTier,
  options?: { gramsFormula?: { batchRow: number } },
) {
  const ws = wb.addWorksheet(sheet.name);
  ws.state = isSheetHiddenForTier(sheet, tier) ? 'hidden' : 'visible';
  const header = ws.addRow(columns.map((col) => col.label));
  styleHeaderRow(header);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const pctIdx = columns.findIndex((col) => col.key === 'percentConcentrate');
  const pctCol = pctIdx >= 0 ? columnLetter(pctIdx) : null;

  for (const [rowOffset, data] of rows.entries()) {
    const excelRow = rowOffset + 2;
    const values = columns.map((col) => {
      if (options?.gramsFormula && col.key === 'grams' && pctCol) {
        return {
          formula: `${pctCol}${excelRow}/100*Formula!$B$${options.gramsFormula.batchRow}`,
          result: Number(data.grams) || 0,
        };
      }
      if (col.type === 'number') {
        const raw = data[col.key];
        return raw === '' || raw == null ? '' : Number(raw);
      }
      if (col.type === 'boolean') return Boolean(data[col.key]);
      return formatWorkbookScalar(data[col.key]);
    });
    ws.addRow(values);
  }

  columns.forEach((col, idx) => {
    const column = ws.getColumn(idx + 1);
    column.width = Math.min(36, Math.max(12, col.label.length + 4));
    column.hidden = isFieldHiddenForTier(col, tier);
    if (col.type === 'number') column.numFmt = '0.0000';
  });
}

export async function buildFormulaXlsxBuffer(
  payload: FormulaWorkbookPayload,
  tier: WorkbookTier,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Fragrance Chemistry';
  wb.created = new Date(payload.meta.exportedAt);

  const formulaSheet = FORMULA_WORKBOOK_SHEETS[0]!;
  const linesSheet = FORMULA_WORKBOOK_SHEETS[1]!;
  const ifraSheet = FORMULA_WORKBOOK_SHEETS[2]!;
  const materialsSheet = FORMULA_WORKBOOK_SHEETS[3]!;
  const metaSheet = FORMULA_WORKBOOK_SHEETS[4]!;

  addKeyValueSheet(wb, formulaSheet, FORMULA_HEADER_FIELDS, payload.header, tier);

  const batchRow = FORMULA_HEADER_FIELDS.findIndex((field) => field.key === 'batchTargetGrams') + 2;
  addTableSheet(wb, linesSheet, FORMULA_LINES_COLUMNS, payload.lines, tier, {
    gramsFormula: { batchRow },
  });
  addTableSheet(wb, ifraSheet, IFRA_COMPLIANCE_COLUMNS, payload.ifraCompliance, tier);
  addTableSheet(wb, materialsSheet, MATERIALS_REFERENCE_COLUMNS, payload.materialsReference, tier);
  addKeyValueSheet(wb, metaSheet, META_FIELDS, payload.meta, tier);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export { columnLetter };
