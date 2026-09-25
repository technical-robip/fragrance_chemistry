export const CATALOG_NOTE_FILTERS = [
  { id: 'top', labelKey: 'catalog.top' },
  { id: 'middle', labelKey: 'catalog.heart' },
  { id: 'base', labelKey: 'catalog.base' },
  { id: 'modifier', labelKey: 'catalog.other' },
] as const;

export const CATALOG_FAMILIES = [
  'Floral',
  'Fresh',
  'Green',
  'Animalic',
  'Woody',
  'Gourmand',
  'Special',
  'Amber',
  'Oriental',
] as const;

export const CATALOG_MANUFACTURERS = [
  'Firmenich',
  'Givaudan',
  'Symrise',
  'Synarome',
  'IFF',
] as const;

export function toggleCatalogFilter(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function catalogNoteLabel(note: string | null | undefined, t: (key: string) => string) {
  if (note === 'middle') return t('catalog.heart');
  if (note === 'top') return t('catalog.top');
  if (note === 'base') return t('catalog.base');
  if (note === 'modifier') return t('catalog.other');
  return note ?? '—';
}
