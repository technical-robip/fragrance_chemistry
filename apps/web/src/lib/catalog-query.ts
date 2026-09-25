export type CatalogQueryInput = {
  q?: string;
  notes?: string[];
  families?: string[];
  manufacturers?: string[];
  /** @deprecated use notes */
  note?: string;
  /** @deprecated use families */
  family?: string;
  /** @deprecated use manufacturers */
  manufacturer?: string;
  includePrivate?: boolean;
  limit?: number;
  offset?: number;
};

export function buildCatalogQuery(input: CatalogQueryInput): string {
  const params = new URLSearchParams();
  if (input.q?.trim()) params.set('q', input.q.trim());

  const notes = input.notes?.length ? input.notes : input.note ? [input.note] : undefined;
  const families = input.families?.length
    ? input.families
    : input.family
      ? [input.family]
      : undefined;
  const manufacturers = input.manufacturers?.length
    ? input.manufacturers
    : input.manufacturer
      ? [input.manufacturer]
      : undefined;

  if (notes?.length) params.set('note', notes.join(','));
  if (families?.length) params.set('family', families.join(','));
  if (manufacturers?.length) params.set('manufacturer', manufacturers.join(','));
  if (input.includePrivate) params.set('includePrivate', '1');
  if (input.limit != null) params.set('limit', String(input.limit));
  if (input.offset != null) params.set('offset', String(input.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
