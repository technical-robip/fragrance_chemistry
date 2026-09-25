/** UI / engine product categories (1–12). Excel 51st-amendment subcodes collapse into these. */
export const IFRA_PRODUCT_CATEGORIES = [
  { code: '1', label: 'Lip products' },
  { code: '2', label: 'Deodorants / antiperspirants' },
  { code: '3', label: 'Hydroalcoholic, shaved skin' },
  { code: '4', label: 'Fine fragrance' },
  { code: '5', label: 'Body / face leave-on' },
  { code: '6', label: 'Oral care' },
  { code: '7', label: 'Hair products' },
  { code: '8', label: 'Intimate wipes' },
  { code: '9', label: 'Rinse-off body' },
  { code: '10', label: 'Household / air care' },
  { code: '11', label: 'Incense and similar' },
  { code: '12', label: 'Candles (non-skin)' },
] as const;

export type IfraProductCategoryCode = (typeof IFRA_PRODUCT_CATEGORIES)[number]['code'];

const EXCEL_TO_PRODUCT: Record<string, IfraProductCategoryCode> = {
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '5A': '5',
  '5B': '5',
  '5C': '5',
  '5D': '5',
  '6': '6',
  '7': '7',
  '7A': '7',
  '7B': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  '10A': '10',
  '10B': '10',
  '11': '11',
  '11A': '11',
  '11B': '11',
  '12': '12',
};

/** Map an IFRA Excel column (5A, 10A, Cat 4…) onto the 1–12 product code. */
export function collapseIfraExcelCode(raw: string): IfraProductCategoryCode | null {
  const token = raw
    .trim()
    .toUpperCase()
    .replace(/CATEGORY/g, '')
    .replace(/CAT\.?/g, '')
    .replace(/[^0-9A-Z]/g, '');
  return EXCEL_TO_PRODUCT[token] ?? null;
}

/**
 * Parse a limit cell: numbers, percents, prohibited/banned → 0, NS/blank → null (no row).
 */
export function parseIfraLimitCell(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value < 0 ? 0 : value;
  }
  const text = String(value).trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (/^(NS|N\/S|NA|N\/A|-|—|–)$/.test(upper)) return null;
  if (/(PROHIBIT|BANNED|NOT PERMITTED|NOT TO BE USED)/.test(upper)) return 0;
  const numeric = Number(text.replace(/%/g, '').replace(/,/g, '').trim());
  if (!Number.isFinite(numeric)) return null;
  return numeric < 0 ? 0 : numeric;
}

/** Most restrictive (lowest) limit among subcategory columns that map to one product code. */
export function mostRestrictiveLimit(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return Math.min(...present);
}
