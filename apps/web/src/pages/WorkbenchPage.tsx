import { useWorkbenchStore } from '@/stores/workbench-store';
import styles from './WorkbenchPage.module.css';

export function WorkbenchPage() {
  const formulaName = useWorkbenchStore((s) => s.formulaName);
  const lines = useWorkbenchStore((s) => s.lines);
  const saveStatus = useWorkbenchStore((s) => s.saveStatus);
  const lastSavedAt = useWorkbenchStore((s) => s.lastSavedAt);
  const setFormulaName = useWorkbenchStore((s) => s.setFormulaName);
  const updateLine = useWorkbenchStore((s) => s.updateLine);
  const addLine = useWorkbenchStore((s) => s.addLine);
  const removeLine = useWorkbenchStore((s) => s.removeLine);

  const totalPct = lines.reduce((sum, l) => sum + l.targetPct, 0);

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1 className="fc-page-title">Workbench</h1>
          <p className="fc-muted">
            Live grid with Zustand state — autosaves to local draft every 600ms.
          </p>
        </div>
        <SaveBadge status={saveStatus} lastSavedAt={lastSavedAt} />
      </header>

      <div className={`fc-card ${styles.panel}`}>
        <label className="fc-label" htmlFor="formula-name">
          Formula name
        </label>
        <input
          id="formula-name"
          className="fc-input"
          value={formulaName}
          onChange={(e) => setFormulaName(e.target.value)}
        />
      </div>

      <div className={`fc-table-wrap ${styles.gridWrap}`}>
        <table className="fc-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Material</th>
              <th>Target %</th>
              <th>Actual (g)</th>
              <th>Lot</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id}>
                <td>
                  <input
                    className={styles.cellInput}
                    value={line.materialCode}
                    onChange={(e) => updateLine(line.id, { materialCode: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    value={line.materialName}
                    onChange={(e) => updateLine(line.id, { materialName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    type="number"
                    step="0.01"
                    value={line.targetPct}
                    onChange={(e) =>
                      updateLine(line.id, {
                        targetPct: Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    type="number"
                    step="0.001"
                    value={line.actualG}
                    onChange={(e) => updateLine(line.id, { actualG: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    value={line.lot ?? ''}
                    placeholder="Lot"
                    onChange={(e) => updateLine(line.id, { lot: e.target.value })}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="fc-btn fc-btn--ghost"
                    onClick={() => removeLine(line.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className={styles.footer}>
        <span className={totalPct === 100 ? styles.ok : styles.warn}>
          Total target: {totalPct.toFixed(2)}%
        </span>
        <button type="button" className="fc-btn fc-btn--primary" onClick={addLine}>
          Add line
        </button>
      </footer>
    </div>
  );
}

function SaveBadge({
  status,
  lastSavedAt,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
}) {
  const label =
    status === 'saving'
      ? 'Saving…'
      : status === 'saved' && lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
        : status === 'error'
          ? 'Save failed'
          : 'Draft idle';

  return <span className={styles.saveBadge}>{label}</span>;
}
