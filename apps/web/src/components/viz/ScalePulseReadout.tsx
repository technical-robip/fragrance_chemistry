import type { ReactNode } from 'react';
import styles from './ScalePulseReadout.module.css';

export function ScalePulseReadout({
  grams,
  connected,
  label,
  stage,
}: {
  grams: number | null;
  connected: boolean;
  label: string;
  /** Optional 3D / visual stage under the typography. */
  stage?: ReactNode;
}) {
  return (
    <div
      className={`${styles.panel} ${connected ? styles.live : ''} ${stage ? styles.withStage : ''}`}
    >
      <div className={styles.readout}>
        <span className={styles.status}>{label}</span>
        <strong className={styles.value}>
          {connected && grams != null ? grams.toFixed(3) : '— — —'}
        </strong>
        <span className={styles.unit}>g</span>
      </div>
      {stage ? <div className={styles.stage}>{stage}</div> : null}
    </div>
  );
}
