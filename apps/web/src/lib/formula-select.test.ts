import { describe, expect, it } from 'vitest';
import { formulaOptionLabel, nextFormulaAfterDelete } from './formula-select';

const formulas = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

describe('formulaOptionLabel', () => {
  it('includes name and status', () => {
    expect(formulaOptionLabel({ id: '1', name: 'Brief: Demo', status: 'draft' })).toBe(
      'Brief: Demo (draft)',
    );
  });
});

describe('nextFormulaAfterDelete', () => {
  it('keeps the current selection when another row is deleted', () => {
    expect(nextFormulaAfterDelete(formulas, 'b', 'a')).toBe('a');
  });

  it('selects the next formula when the current one is deleted', () => {
    expect(nextFormulaAfterDelete(formulas, 'b', 'b')).toBe('c');
  });

  it('selects the previous formula when the last one is deleted', () => {
    expect(nextFormulaAfterDelete(formulas, 'c', 'c')).toBe('b');
  });

  it('selects the following formula when the first one is deleted', () => {
    expect(nextFormulaAfterDelete(formulas, 'a', 'a')).toBe('b');
  });

  it('returns null when the last remaining formula is deleted', () => {
    expect(nextFormulaAfterDelete([{ id: 'only' }], 'only', 'only')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(nextFormulaAfterDelete([], 'x', 'x')).toBeNull();
  });

  it('falls back to the first remaining formula when selection is missing', () => {
    expect(nextFormulaAfterDelete(formulas, 'a', null)).toBe('b');
    expect(nextFormulaAfterDelete(formulas, 'missing', 'b')).toBe('b');
  });
});
