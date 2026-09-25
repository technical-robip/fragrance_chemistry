import { describe, expect, it } from 'vitest';
import { buildCatalogQuery } from './catalog-query';

describe('catalog-query', () => {
  it('returns empty string when no filters', () => {
    expect(buildCatalogQuery({})).toBe('');
  });

  it('encodes multi-select filters as CSV', () => {
    const qs = buildCatalogQuery({
      notes: ['top', 'middle'],
      families: ['Floral'],
      manufacturers: ['Firmenich', 'IFF'],
    });
    expect(qs).toContain('note=top%2Cmiddle');
    expect(qs).toContain('family=Floral');
    expect(qs).toContain('manufacturer=Firmenich%2CIFF');
  });

  it('flags private materials for picker queries', () => {
    expect(buildCatalogQuery({ includePrivate: true, limit: 500 })).toBe(
      '?includePrivate=1&limit=500',
    );
    expect(buildCatalogQuery({ includePrivate: false })).toBe('');
  });
});
