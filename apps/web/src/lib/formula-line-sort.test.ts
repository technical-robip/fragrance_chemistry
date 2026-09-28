import { describe, expect, it } from 'vitest';
import {
  sortFormulaLines,
  toggleLineSort,
  type LineSort,
  type SortableLine,
} from './formula-line-sort';

function line(partial: Partial<SortableLine> & Pick<SortableLine, 'name'>): SortableLine {
  return {
    percent: 0,
    grams: 0,
    lineCost: 0,
    pyramidNote: null,
    olfactoryFamily: null,
    order: 0,
    stockConcentrationPct: 100,
    ...partial,
  };
}

function names(sort: LineSort, rows: SortableLine[]) {
  return sortFormulaLines(rows, sort, (row) => row).map((row) => row.name);
}

describe('sortFormulaLines', () => {
  const rows = [
    line({
      name: 'Cedar',
      percent: 25,
      grams: 2.5,
      lineCost: 1,
      pyramidNote: 'base',
      olfactoryFamily: 'Woody',
      order: 2,
      stockConcentrationPct: 100,
    }),
    line({
      name: 'Bergamot',
      percent: 5,
      grams: 0.5,
      lineCost: 4,
      pyramidNote: 'top',
      olfactoryFamily: 'Citrus',
      order: 0,
      stockConcentrationPct: 10,
    }),
    line({
      name: 'Rose',
      percent: 25,
      grams: 2.5,
      lineCost: 2,
      pyramidNote: 'middle',
      olfactoryFamily: 'Floral',
      order: 1,
      stockConcentrationPct: 50,
    }),
  ];

  it('sorts alphabetically and reverses on the second pass', () => {
    expect(names({ key: 'alpha', direction: 'asc' }, rows)).toEqual(['Bergamot', 'Cedar', 'Rose']);
    expect(names({ key: 'alpha', direction: 'desc' }, rows)).toEqual(['Rose', 'Cedar', 'Bergamot']);
  });

  it('sorts pyramid from top to base', () => {
    expect(names({ key: 'pyramid', direction: 'asc' }, rows)).toEqual([
      'Bergamot',
      'Rose',
      'Cedar',
    ]);
    expect(names({ key: 'pyramid', direction: 'desc' }, rows)).toEqual([
      'Cedar',
      'Rose',
      'Bergamot',
    ]);
  });

  it('sorts cost with the most expensive line first by default direction', () => {
    expect(names({ key: 'cost', direction: 'desc' }, rows)).toEqual(['Bergamot', 'Rose', 'Cedar']);
  });

  it('sorts percentage and breaks ties by name', () => {
    expect(names({ key: 'percentage', direction: 'desc' }, rows)).toEqual([
      'Cedar',
      'Rose',
      'Bergamot',
    ]);
    expect(names({ key: 'percentage', direction: 'asc' }, rows)).toEqual([
      'Bergamot',
      'Cedar',
      'Rose',
    ]);
  });

  it('sorts category by olfactory family', () => {
    expect(names({ key: 'category', direction: 'asc' }, rows)).toEqual([
      'Bergamot',
      'Rose',
      'Cedar',
    ]);
  });

  it('sorts date added by formula order', () => {
    expect(names({ key: 'dateAdded', direction: 'asc' }, rows)).toEqual([
      'Bergamot',
      'Rose',
      'Cedar',
    ]);
    expect(names({ key: 'dateAdded', direction: 'desc' }, rows)).toEqual([
      'Cedar',
      'Rose',
      'Bergamot',
    ]);
  });

  it('sorts weight with the heaviest line first by default direction', () => {
    expect(names({ key: 'weight', direction: 'desc' }, rows)).toEqual([
      'Cedar',
      'Rose',
      'Bergamot',
    ]);
  });

  it('sorts dilution with the most diluted stock first', () => {
    expect(names({ key: 'dilution', direction: 'asc' }, rows)).toEqual([
      'Bergamot',
      'Rose',
      'Cedar',
    ]);
    expect(names({ key: 'dilution', direction: 'desc' }, rows)).toEqual([
      'Cedar',
      'Rose',
      'Bergamot',
    ]);
  });

  it('does not mutate the source list', () => {
    const copy = [...rows];
    sortFormulaLines(rows, { key: 'alpha', direction: 'asc' }, (row) => row);
    expect(rows.map((row) => row.name)).toEqual(copy.map((row) => row.name));
  });
});

describe('toggleLineSort', () => {
  it('uses the natural direction on a new key and flips the active key', () => {
    const start = { key: 'dateAdded' as const, direction: 'asc' as const };
    const cost = toggleLineSort(start, 'cost');
    expect(cost).toEqual({ key: 'cost', direction: 'desc' });
    expect(toggleLineSort(cost, 'cost')).toEqual({ key: 'cost', direction: 'asc' });
    expect(toggleLineSort(cost, 'alpha')).toEqual({ key: 'alpha', direction: 'asc' });
  });
});
