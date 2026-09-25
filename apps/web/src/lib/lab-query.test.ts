import { describe, expect, it } from 'vitest';
import { withFormulaQuery, withLabQuery } from './lab-query';

describe('lab query helpers', () => {
  it('adds a formula query to a bare path', () => {
    expect(withFormulaQuery('/evaluation', 'coca-cola-0')).toBe('/evaluation?formula=coca-cola-0');
    expect(withFormulaQuery('/workbench', null)).toBe('/workbench');
  });

  it('carries formula and sitting id across the workbench hinge', () => {
    expect(withLabQuery('/workbench', { formula: 'coca-cola-0', evalId: 'e1' })).toBe(
      '/workbench?formula=coca-cola-0&eval=e1',
    );
    expect(withLabQuery('/evaluation', { formula: 'coca-cola-0', evalId: 'e1' })).toBe(
      '/evaluation?formula=coca-cola-0&eval=e1',
    );
  });

  it('preserves an existing formula query when attaching a sitting', () => {
    expect(withLabQuery('/evaluation?formula=f1', { evalId: 'e9' })).toBe(
      '/evaluation?formula=f1&eval=e9',
    );
  });
});
