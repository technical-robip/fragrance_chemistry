import ExcelJS from 'exceljs';
import {
  collapseIfraExcelCode,
  mostRestrictiveLimit,
  parseIfraLimitCell,
  planIfraLimitUpserts,
  type CatalogIdentity,
  type IfraLimitExisting,
  type IfraLimitIncoming,
  type IfraLimitPlanRow,
  type IfraProductCategoryCode,
} from '@fc/shared';

function cellValues(row: { values: unknown }): unknown[] {
  const raw = row.values;
  if (Array.isArray(raw)) return raw.slice(1);
  return [];
}

function headerToken(value: unknown): string {
  return String(value ?? '').trim();
}

export function parseIfraOverviewRows(header: unknown[], rows: unknown[][]): IfraLimitIncoming[] {
  let casIdx = header.findIndex((h) => /cas/i.test(headerToken(h)));
  let nameIdx = header.findIndex((h) => /name|title|ingredient/i.test(headerToken(h)));
  if (casIdx < 0) casIdx = 0;
  if (nameIdx < 0) nameIdx = 1;

  const categoryCols: Array<{ index: number; code: IfraProductCategoryCode }> = [];
  header.forEach((h, index) => {
    const code = collapseIfraExcelCode(headerToken(h));
    if (code) categoryCols.push({ index, code });
  });

  const incoming: IfraLimitIncoming[] = [];
  for (const row of rows) {
    const casNumber = String(row[casIdx] ?? '').trim();
    if (!casNumber) continue;
    const materialName = String(row[nameIdx] ?? '').trim() || undefined;
    const grouped = new Map<IfraProductCategoryCode, Array<number | null>>();
    for (const col of categoryCols) {
      const list = grouped.get(col.code) ?? [];
      list.push(parseIfraLimitCell(row[col.index]));
      grouped.set(col.code, list);
    }
    for (const [categoryCode, values] of grouped) {
      const maxPercent = mostRestrictiveLimit(values);
      if (maxPercent == null) continue;
      incoming.push({ casNumber, materialName, categoryCode, maxPercent });
    }
  }
  return incoming;
}

export async function parseIfraOverviewWorkbook(buffer: Buffer): Promise<IfraLimitIncoming[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const header = cellValues(sheet.getRow(1));
  const rows: unknown[][] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    rows.push(cellValues(sheet.getRow(r)));
  }
  return parseIfraOverviewRows(header, rows);
}

export function planIfraImport(
  incoming: IfraLimitIncoming[],
  catalog: CatalogIdentity[],
  existing: IfraLimitExisting[],
): IfraLimitPlanRow[] {
  return planIfraLimitUpserts(incoming, catalog, existing);
}
