import { describe, expect, it } from 'vitest';
import { openFormulaView, type PublishedSnapshot } from './publication-view';

const snapshot: PublishedSnapshot = {
  name: 'Rose study',
  description: 'A public sketch',
  lines: [
    {
      materialId: '33333333-3333-4333-8333-333333333333',
      materialName: 'Rose absolute',
      percent: 40,
      pyramidNote: 'middle',
      solvent: null,
      stockConcentrationPct: 100,
      sortOrder: 0,
    },
  ],
};

describe('open formula view', () => {
  it('returns the recipe while the formula is published', () => {
    const view = openFormulaView(
      {
        token: 'tok',
        status: 'published',
        snapshot,
        publishedAt: '2026-01-01T00:00:00.000Z',
        authorName: 'Ada',
        stale: false,
      },
      false,
    );
    expect(view.state).toBe('published');
    if (view.state === 'published') expect(view.lines).toEqual(snapshot.lines);
  });

  it('drops the recipe when the link is withdrawn and keeps a republish flag for the author', () => {
    const view = openFormulaView(
      {
        token: 'tok',
        status: 'withdrawn',
        snapshot: null,
        publishedAt: null,
        authorName: null,
        stale: false,
      },
      true,
    );
    expect(view).toEqual({ state: 'withdrawn', canRepublish: true });
  });
});
