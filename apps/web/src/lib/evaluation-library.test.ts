import { describe, expect, it } from 'vitest';
import { filterEvaluations, groupByFormula, type EvaluationSummary } from './evaluation-library';

function row(
  over: Partial<EvaluationSummary> & Pick<EvaluationSummary, 'id' | 'formulaId'>,
): EvaluationSummary {
  return {
    formulaName: 'Formula',
    rating: 3,
    macerationDay: 7,
    notes: null,
    t0Notes: null,
    t30mNotes: null,
    t4hNotes: null,
    t24hNotes: null,
    clarity: 'clear',
    opalescence: 'none',
    solubility: 'complete',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const rows: EvaluationSummary[] = [
  row({
    id: 'a',
    formulaId: 'f1',
    formulaName: 'Classic Chypre',
    rating: 4,
    macerationDay: 7,
    t0Notes: 'bergamot lift',
  }),
  row({
    id: 'b',
    formulaId: 'f1',
    formulaName: 'Classic Chypre',
    rating: 2,
    macerationDay: 1,
    t0Notes: 'harsh alcohol',
  }),
  row({
    id: 'c',
    formulaId: 'f2',
    formulaName: 'Fresh Cologne',
    rating: 5,
    macerationDay: 14,
    t24hNotes: 'citrus fades',
  }),
];

describe('filterEvaluations', () => {
  it('returns all rows with no filter', () => {
    expect(filterEvaluations(rows)).toHaveLength(3);
  });

  it('filters by formula UUID, not by slug', () => {
    const out = filterEvaluations(rows, { formulaId: 'Classic Chypre' });
    expect(out).toHaveLength(0);
    expect(filterEvaluations(rows, { formulaId: 'f1' }).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('filters by maceration day', () => {
    const out = filterEvaluations(rows, { day: 14 });
    expect(out.map((r) => r.id)).toEqual(['c']);
  });

  it('treats null day as all days', () => {
    expect(filterEvaluations(rows, { day: null })).toHaveLength(3);
  });

  it('applies a minimum rating floor', () => {
    const out = filterEvaluations(rows, { minRating: 4 });
    expect(out.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('searches formula name and every note field, case-insensitively', () => {
    expect(filterEvaluations(rows, { q: 'CHYPRE' }).map((r) => r.id)).toEqual(['a', 'b']);
    expect(filterEvaluations(rows, { q: 'citrus' }).map((r) => r.id)).toEqual(['c']);
    expect(filterEvaluations(rows, { q: 'harsh' }).map((r) => r.id)).toEqual(['b']);
  });

  it('combines filters', () => {
    const out = filterEvaluations(rows, { formulaId: 'f1', minRating: 3 });
    expect(out.map((r) => r.id)).toEqual(['a']);
  });
});

describe('groupByFormula', () => {
  it('groups rows preserving order across and within groups', () => {
    const groups = groupByFormula(rows);
    expect(groups.map((g) => g.formulaId)).toEqual(['f1', 'f2']);
    expect(groups[0].formulaName).toBe('Classic Chypre');
    expect(groups[0].rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(groups[1].rows.map((r) => r.id)).toEqual(['c']);
  });
});
