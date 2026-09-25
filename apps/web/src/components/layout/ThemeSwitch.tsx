import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import styles from './ThemeSwitch.module.css';

export function ThemeSwitch() {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const checked = theme === 'light';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={t('common.themeToggle')}
      className={styles.switch}
      onClick={toggleTheme}
    >
      <span className={`${styles.track} ${checked ? styles.trackOn : ''}`}>
        <span className={`${styles.knob} ${checked ? styles.knobOn : ''}`} />
      </span>
      <span className={styles.label}>
        {checked ? t('common.themeLight') : t('common.themeDark')}
      </span>
    </button>
  );
}
