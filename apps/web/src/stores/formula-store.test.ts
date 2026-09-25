import { beforeEach, describe, expect, it } from 'vitest';
import { useFormulaStore } from './formula-store';

describe('formula-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useFormulaStore.setState({ activeFormulaId: null });
  });

  it('persists active formula id', () => {
    useFormulaStore.getState().setActiveFormulaId('abc-1');
    expect(localStorage.getItem('fc.activeFormulaId')).toBe('abc-1');
    expect(useFormulaStore.getState().activeFormulaId).toBe('abc-1');
    useFormulaStore.getState().setActiveFormulaId(null);
    expect(localStorage.getItem('fc.activeFormulaId')).toBeNull();
  });

  it('hydrates from localStorage', () => {
    localStorage.setItem('fc.activeFormulaId', 'persisted');
    useFormulaStore.getState().hydrateFormula();
    expect(useFormulaStore.getState().activeFormulaId).toBe('persisted');
  });
});
