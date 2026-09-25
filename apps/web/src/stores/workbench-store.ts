import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

export type WorkbenchLine = {
  id: string;
  materialCode: string;
  materialName: string;
  targetPct: number;
  actualG: number;
  lot?: string;
  pyramidNote?: 'top' | 'middle' | 'base' | 'modifier';
  olfactoryFamily?: string;
};

type WorkbenchState = {
  formulaId: string;
  formulaName: string;
  lines: WorkbenchLine[];
  lastSavedAt: number | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setFormulaName: (name: string) => void;
  updateLine: (id: string, patch: Partial<WorkbenchLine>) => void;
  addLine: () => void;
  removeLine: (id: string) => void;
  markSaving: () => void;
  markSaved: () => void;
  markError: () => void;
};

const STORAGE_KEY = 'fc.workbench.draft';

function loadDraft(): Pick<WorkbenchState, 'formulaId' | 'formulaName' | 'lines'> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Pick<WorkbenchState, 'formulaId' | 'formulaName' | 'lines'>;
  } catch {
    return null;
  }
}

const seedLines: WorkbenchLine[] = [
  {
    id: '1',
    materialCode: 'BENZYL-001',
    materialName: 'Benzyl acetate',
    targetPct: 12,
    actualG: 0,
    pyramidNote: 'middle',
    olfactoryFamily: 'Floral',
  },
  {
    id: '2',
    materialCode: 'ISO-E-SUP',
    materialName: 'Iso E Super',
    targetPct: 18,
    actualG: 0,
    pyramidNote: 'base',
    olfactoryFamily: 'Woody',
  },
  {
    id: '3',
    materialCode: 'BERG-OIL',
    materialName: 'Bergamot oil CP',
    targetPct: 8,
    actualG: 0,
    pyramidNote: 'top',
    olfactoryFamily: 'Fresh',
  },
];
const draft = loadDraft();

export const useWorkbenchStore = create<WorkbenchState>()(
  subscribeWithSelector((set, get) => ({
    formulaId: draft?.formulaId ?? 'draft-001',
    formulaName: draft?.formulaName ?? 'Nocturne accord v3',
    lines: draft?.lines ?? seedLines,
    lastSavedAt: null,
    saveStatus: 'idle',

    setFormulaName(name) {
      set({ formulaName: name });
    },

    updateLine(id, patch) {
      set({
        lines: get().lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
      });
    },

    addLine() {
      const id = crypto.randomUUID();
      set({
        lines: [
          ...get().lines,
          {
            id,
            materialCode: '',
            materialName: 'New material',
            targetPct: 0,
            actualG: 0,
          },
        ],
      });
    },

    removeLine(id) {
      set({ lines: get().lines.filter((line) => line.id !== id) });
    },

    markSaving() {
      set({ saveStatus: 'saving' });
    },

    markSaved() {
      set({ saveStatus: 'saved', lastSavedAt: Date.now() });
    },

    markError() {
      set({ saveStatus: 'error' });
    },
  })),
);

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

useWorkbenchStore.subscribe(
  (s) => ({
    formulaId: s.formulaId,
    formulaName: s.formulaName,
    lines: s.lines,
  }),
  (snapshot) => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    useWorkbenchStore.getState().markSaving();
    autosaveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      useWorkbenchStore.getState().markSaved();
    }, 600);
  },
  { equalityFn: shallow },
);
