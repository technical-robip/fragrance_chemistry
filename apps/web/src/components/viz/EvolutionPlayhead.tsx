import styles from './EvolutionPlayhead.module.css';

export function EvolutionPlayhead({
  hours,
  maxHours = 12,
  onChange,
}: {
  hours: number;
  maxHours?: number;
  onChange: (h: number) => void;
}) {
  return (
    <div className={styles.wrap}>
      <input
        className={styles.range}
        type="range"
        min={0}
        max={maxHours}
        step={0.1}
        value={hours}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={0}
        aria-valuemax={maxHours}
        aria-valuenow={hours}
      />
      <div className={styles.meta}>
        <span>{hours.toFixed(1)}h</span>
        <span>0 → {maxHours}h</span>
      </div>
    </div>
  );
}
