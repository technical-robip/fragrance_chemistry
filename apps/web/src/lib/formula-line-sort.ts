export const LINE_SORT_KEYS = [
  'alpha',
  'pyramid',
  'cost',
  'percentage',
  'category',
  'dateAdded',
  'weight',
  'dilution',
] as const;

export type LineSortKey = (typeof LINE_SORT_KEYS)[number];
export type SortDirection = 'asc' | 'desc';

export type LineSort = {
  key: LineSortKey;
  direction: SortDirection;
};

export const DEFAULT_LINE_SORT: LineSort = { key: 'dateAdded', direction: 'asc' };

export type SortableLine = {
  name: string;
  percent: number;
  grams: number;
  lineCost: number;
  pyramidNote?: string | null;
  olfactoryFamily?: string | null;
  /** Canonical formula order. Lines have no created-at timestamp. */
  order: number;
  stockConcentrationPct: number;
};

const PYRAMID_RANK: Record<string, number> = {
  top: 0,
  heart: 1,
  middle: 1,
  base: 2,
  modifier: 3,
};

export function defaultSortDirection(key: LineSortKey): SortDirection {
  if (key === 'cost' || key === 'percentage' || key === 'weight') return 'desc';
  return 'asc';
}

export function toggleLineSort(current: LineSort, key: LineSortKey): LineSort {
  if (current.key !== key) return { key, direction: defaultSortDirection(key) };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

function pyramidRank(note?: string | null): number {
  if (!note) return 4;
  return PYRAMID_RANK[note] ?? 4;
}

function categoryLabel(family?: string | null): string {
  return family?.trim() || '';
}

function compareSortable(a: SortableLine, b: SortableLine, sort: LineSort): number {
  const dir = sort.direction === 'asc' ? 1 : -1;
  let primary = 0;
  switch (sort.key) {
    case 'alpha':
      primary = a.name.localeCompare(b.name);
      break;
    case 'pyramid':
      primary = pyramidRank(a.pyramidNote) - pyramidRank(b.pyramidNote);
      break;
    case 'cost':
      primary = a.lineCost - b.lineCost;
      break;
    case 'percentage':
      primary = a.percent - b.percent;
      break;
    case 'category':
      primary = categoryLabel(a.olfactoryFamily).localeCompare(categoryLabel(b.olfactoryFamily));
      break;
    case 'dateAdded':
      primary = a.order - b.order;
      break;
    case 'weight':
      primary = a.grams - b.grams;
      break;
    case 'dilution':
      primary = a.stockConcentrationPct - b.stockConcentrationPct;
      break;
  }
  if (primary !== 0) return primary * dir;
  const name = a.name.localeCompare(b.name);
  if (name !== 0) return name;
  return a.order - b.order;
}

export function sortFormulaLines<T>(
  lines: readonly T[],
  sort: LineSort,
  toSortable: (line: T, index: number) => SortableLine,
): T[] {
  return lines
    .map((line, index) => ({ line, index, sortable: toSortable(line, index) }))
    .sort((a, b) => compareSortable(a.sortable, b.sortable, sort) || a.index - b.index)
    .map((row) => row.line);
}
