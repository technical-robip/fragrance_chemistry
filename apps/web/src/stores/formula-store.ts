import { create } from 'zustand';

const FORMULA_KEY = 'fc.activeFormulaId';

type FormulaUiState = {
  activeFormulaId: string | null;
  hydrateFormula: () => void;
  setActiveFormulaId: (id: string | null) => void;
};

export const useFormulaStore = create<FormulaUiState>((set) => ({
  activeFormulaId: null,
  hydrateFormula: () => {
    if (typeof window === 'undefined') return;
    set({ activeFormulaId: window.localStorage.getItem(FORMULA_KEY) });
  },
  setActiveFormulaId: (id) => {
    if (typeof window !== 'undefined') {
      if (id) window.localStorage.setItem(FORMULA_KEY, id);
      else window.localStorage.removeItem(FORMULA_KEY);
    }
    set({ activeFormulaId: id });
  },
}));
