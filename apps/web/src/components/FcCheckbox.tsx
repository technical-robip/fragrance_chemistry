import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './FcCheckbox.module.css';

export type FcCheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children' | 'size'
> & {
  /** Optional visible label next to the control. */
  label?: ReactNode;
  /** Compact box for dense rows (library, inspector). Default fits touch targets. */
  size?: 'sm' | 'md';
};

/**
 * Lab-themed checkbox — teal fill when checked, gold-tint focus ring.
 * Use anywhere a native checkbox would clash with the fragrance UI.
 */
export function FcCheckbox({
  label,
  size = 'md',
  className,
  disabled,
  checked,
  ...rest
}: FcCheckboxProps) {
  return (
    <label
      className={[
        styles.root,
        size === 'sm' ? styles.sm : styles.md,
        disabled ? styles.disabled : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        {...rest}
        type="checkbox"
        className={styles.input}
        disabled={disabled}
        checked={checked}
      />
      <span className={styles.box} aria-hidden>
        <svg className={styles.mark} viewBox="0 0 16 16" focusable="false">
          <path
            d="M3.2 8.4 6.4 11.6 12.8 4.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label != null ? <span className={styles.label}>{label}</span> : null}
    </label>
  );
}
