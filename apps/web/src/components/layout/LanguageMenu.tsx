import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocaleFlag } from '@/components/icons/flags';
import { APP_LOCALES, useUiStore, type AppLocale } from '@/stores/ui-store';
import styles from './LanguageMenu.module.css';

export function LanguageMenu({ placement = 'up' }: { placement?: 'up' | 'down' }) {
  const { t, i18n } = useTranslation();
  const locale = useUiStore((s) => s.locale);
  const setLocale = useUiStore((s) => s.setLocale);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(next: AppLocale) {
    setLocale(next);
    void i18n.changeLanguage(next);
    setOpen(false);
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <LocaleFlag locale={locale} />
        <span>{t(`common.locales.${locale}`)}</span>
      </button>
      {open ? (
        <ul
          id={listId}
          className={`${styles.list} ${placement === 'down' ? styles.listDown : ''}`}
          role="listbox"
          aria-label={t('common.language')}
        >
          {APP_LOCALES.map((code) => (
            <li key={code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                className={`${styles.option} ${code === locale ? styles.optionActive : ''}`}
                onClick={() => choose(code)}
              >
                <LocaleFlag locale={code} />
                <span>{t(`common.locales.${code}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
