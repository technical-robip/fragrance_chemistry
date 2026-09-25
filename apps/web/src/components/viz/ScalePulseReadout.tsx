import styles from './ScalePulseReadout.module.css';

export function ScalePulseReadout({
  grams,
  connected,
  label,
}: {
  grams: number | null;
  connected: boolean;
  label: string;
}) {
  return (
    <div className={`${styles.panel} ${connected ? styles.live : ''}`}>
      <span className={styles.status}>{label}</span>
      <strong className={styles.value}>
        {connected && grams != null ? grams.toFixed(3) : '— — —'}
      </strong>
      <span className={styles.unit}>g</span>
    </div>
  );
}
