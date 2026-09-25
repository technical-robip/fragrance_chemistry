import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkbenchStore } from './workbench-store';

describe('workbench-store', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkbenchStore.setState({
      formulaId: 'draft-001',
      formulaName: 'Test',
      lines: [
        {
          id: '1',
          materialCode: 'X',
          materialName: 'X',
          targetPct: 10,
          actualG: 0,
        },
      ],
      lastSavedAt: null,
      saveStatus: 'idle',
    });
  });

  it('updates name and lines', () => {
    useWorkbenchStore.getState().setFormulaName('New');
    expect(useWorkbenchStore.getState().formulaName).toBe('New');
    useWorkbenchStore.getState().updateLine('1', { actualG: 1.5 });
    expect(useWorkbenchStore.getState().lines[0]?.actualG).toBe(1.5);
    useWorkbenchStore.getState().addLine();
    expect(useWorkbenchStore.getState().lines.length).toBe(2);
    useWorkbenchStore.getState().removeLine('1');
    expect(useWorkbenchStore.getState().lines.every((l) => l.id !== '1')).toBe(true);
  });

  it('tracks save status', () => {
    useWorkbenchStore.getState().markSaving();
    expect(useWorkbenchStore.getState().saveStatus).toBe('saving');
    useWorkbenchStore.getState().markSaved();
    expect(useWorkbenchStore.getState().saveStatus).toBe('saved');
    useWorkbenchStore.getState().markError();
    expect(useWorkbenchStore.getState().saveStatus).toBe('error');
  });
});
