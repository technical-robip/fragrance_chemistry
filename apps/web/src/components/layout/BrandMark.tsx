import { useUiStore } from '@/stores/ui-store';
import styles from './BrandMark.module.css';

type BrandMarkProps = {
  /** Slightly smaller mark for dense chrome (e.g. landing masthead). */
  compact?: boolean;
  className?: string;
};

/** Shared product mark: rounded square with concentric core + ring. */
export function BrandMark({ compact, className }: BrandMarkProps) {
  const theme = useUiStore((s) => s.theme);
  const classes = [
    styles.brandMark,
    compact ? styles.brandMarkCompact : '',
    theme === 'light' ? styles.brandMarkLight : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} aria-hidden>
      <span className={styles.brandMarkCore} />
      <span className={styles.brandMarkRing} />
    </span>
  );
}
