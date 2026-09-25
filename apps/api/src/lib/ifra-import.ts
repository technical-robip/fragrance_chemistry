import ExcelJS from 'exceljs';
import {
  IFRA_LIMIT_CATEGORY_CODES,
  collapseIfraExcelCode,
  draftFromOverviewFields,
  mostRestrictiveLimit,
  parseIfraLimitCell,
  planIfraLimitUpserts,
  type CatalogIdentity,
  type IfraLimitExisting,
  type IfraLimitIncoming,
  type IfraLimitPlanRow,
  type IfraProductCategoryCode,
  type IfraStandardDraft,
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

function excelLimitKey(header: string): string | null {
  const token = header
    .trim()
    .toUpperCase()
    .replace(/CATEGORY/g, '')
    .replace(/CAT\.?/g, '')
    .replace(/[^0-9A-Z]/g, '');
  if ((IFRA_LIMIT_CATEGORY_CODES as readonly string[]).includes(token)) return `limit:${token}`;
  const collapsed = collapseIfraExcelCode(header);
  return collapsed ? `limit:${collapsed}` : null;
}

function fieldKey(header: string): string | null {
  const text = header.trim().toLowerCase();
  if (!text) return null;
  if (/^ifra_std|standard\s*code|key$/.test(text)) return 'code';
  if (/amendment/.test(text)) return 'amendment';
  if (/previous/.test(text)) return 'publicationYears';
  if (/last/.test(text) && /year|publication/.test(text)) return 'lastYear';
  if (/existing/.test(text)) return 'deadlineExisting';
  if (/new creation|deadline for new/.test(text)) return 'deadlineNew';
  if (/synonym/.test(text)) return 'synonyms';
  if (/cas/.test(text) && /comment/.test(text)) return 'casComment';
  if (/^cas|cas number/.test(text)) return 'cas';
  if (/standard type|^type$/.test(text)) return 'type';
  if (/intrinsic|risk/.test(text)) return 'risk';
  if (/flavor/.test(text)) return 'flavor';
  if (/phototox/.test(text)) return 'phototoxicity';
  if (/specification/.test(text)) return 'specification';
  if (/prohibited/.test(text)) return 'prohibitedNotes';
  if (/restricted ingredient/.test(text)) return 'restriction';
  if (/other source/.test(text) && /note/.test(text)) return 'otherSourcesNote';
  if (/other source/.test(text)) return 'otherSources';
  if (/name|title|ingredient/.test(text)) return 'name';
  return excelLimitKey(header);
}

export function parseIfraStandardRows(header: unknown[], rows: unknown[][]): IfraStandardDraft[] {
  const keys = header.map((cell) => fieldKey(headerToken(cell)));
  const drafts: IfraStandardDraft[] = [];
  for (const row of rows) {
    const fields: Record<string, string> = {};
    keys.forEach((key, index) => {
      if (!key) return;
      const value = String(row[index] ?? '').trim();
      if (!value) return;
      fields[key] = fields[key] ? `${fields[key]}\n${value}` : value;
    });
    if (!fields.code && fields.cas) fields.code = `IFRA_CAS_${fields.cas.split(/[\s,]+/)[0]}`;
    if (!fields.type) fields.type = 'RESTRICTION';
    const draft = draftFromOverviewFields(fields);
    if (draft) drafts.push(draft);
  }
  return drafts;
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

export async function parseIfraStandardWorkbook(buffer: Buffer): Promise<IfraStandardDraft[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const header = cellValues(sheet.getRow(1));
  const rows: unknown[][] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    rows.push(cellValues(sheet.getRow(r)));
  }
  return parseIfraStandardRows(header, rows);
}

export function planIfraImport(
  incoming: IfraLimitIncoming[],
  catalog: CatalogIdentity[],
  existing: IfraLimitExisting[],
): IfraLimitPlanRow[] {
  return planIfraLimitUpserts(incoming, catalog, existing);
}
