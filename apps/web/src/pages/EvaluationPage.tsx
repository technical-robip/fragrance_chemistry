import { useState } from 'react';
import styles from './EvaluationPage.module.css';

const MACERATION_DAYS = [1, 7, 14, 30] as const;
const TIMEPOINTS = [
  { key: 't0', label: 'T+0' },
  { key: 't30m', label: 'T+30 min' },
  { key: 't4h', label: 'T+4 h' },
  { key: 't24h', label: 'T+24 h' },
] as const;

export function EvaluationPage() {
  const [day, setDay] = useState<(typeof MACERATION_DAYS)[number]>(1);
  const [notes, setNotes] = useState<Record<string, string>>({
    t0: '',
    t30m: '',
    t4h: '',
    t24h: '',
  });
  const [clarity, setClarity] = useState('clear');
  const [opalescence, setOpalescence] = useState('none');
  const [solubility, setSolubility] = useState('complete');

  return (
    <div>
      <h1 className="fc-page-title">Evaluation notebook</h1>
      <p className="fc-muted">Maceration timeline and organoleptic checkpoints.</p>

      <div className={styles.days}>
        {MACERATION_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.dayChip} ${day === d ? styles.dayChipActive : ''}`}
            onClick={() => setDay(d)}
          >
            Day {d}
          </button>
        ))}
      </div>

      <div className={`fc-card ${styles.editor}`}>
        {TIMEPOINTS.map((tp) => (
          <label key={tp.key} className={styles.field}>
            <span>{tp.label}</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={notes[tp.key]}
              onChange={(e) => setNotes((n) => ({ ...n, [tp.key]: e.target.value }))}
            />
          </label>
        ))}

        <div className={styles.metaRow}>
          <label>
            Clarity
            <select value={clarity} onChange={(e) => setClarity(e.target.value)}>
              <option value="clear">Clear</option>
              <option value="haze">Haze</option>
              <option value="cloudy">Cloudy</option>
            </select>
          </label>
          <label>
            Opalescence
            <select value={opalescence} onChange={(e) => setOpalescence(e.target.value)}>
              <option value="none">None</option>
              <option value="slight">Slight</option>
              <option value="strong">Strong</option>
            </select>
          </label>
          <label>
            Solubility
            <select value={solubility} onChange={(e) => setSolubility(e.target.value)}>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="phase-sep">Phase separation</option>
            </select>
          </label>
        </div>

        <div className={styles.toolbar}>
          <button type="button" className="fc-btn fc-btn--primary">
            Save Day {day}
          </button>
        </div>
      </div>
    </div>
  );
}
