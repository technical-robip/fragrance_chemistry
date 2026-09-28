import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { LINE_SORT_KEYS, type LineSort, type LineSortKey } from '@/lib/formula-line-sort';
import styles from './LineListControls.module.css';

const NARROW = '(max-width: 720px)';

type Props = {
  sort: LineSort;
  showFamily: boolean;
  onSort: (key: LineSortKey) => void;
  onToggleFamily: () => void;
  showSort?: boolean;
  /** Match the compact unit switch used beside these controls on the dashboard. */
  compact?: boolean;
};

export function LineListControls({
  sort,
  showFamily,
  onSort,
  onToggleFamily,
  showSort = true,
  compact = false,
}: Props) {
  const { t } = useTranslation();
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });

  useEffect(() => {
    const media = window.matchMedia(NARROW);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 280;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
      setAnchor({ top: rect.bottom + 6, left });
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu =
    open && showSort
      ? createPortal(
          <>
            <button
              type="button"
              className={narrow ? `${styles.backdrop} ${styles.backdropDim}` : styles.backdrop}
              aria-label={t('common.closeMenu')}
              onClick={() => setOpen(false)}
            />
            <div
              id={menuId}
              role="menu"
              aria-label={t('lineList.sortBy')}
              data-testid="line-sort-menu"
              className={narrow ? `${styles.menu} ${styles.menuSheet}` : styles.menu}
              style={narrow ? undefined : { top: anchor.top, left: anchor.left }}
            >
              <p className={styles.kicker}>{t('lineList.sortBy')}</p>
              {LINE_SORT_KEYS.map((key) => {
                const active = sort.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={active ? styles.itemOn : styles.item}
                    onClick={() => {
                      onSort(key);
                      setOpen(false);
                    }}
                  >
                    <span>{t(`lineList.sort.${key}`)}</span>
                    {active ? <DirectionMark direction={sort.direction} /> : <span />}
                    <SortIcon kind={key} />
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={compact ? `${styles.controls} ${styles.compact}` : styles.controls}>
      {showSort ? (
        <button
          ref={buttonRef}
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          aria-label={`${t('lineList.sortBy')}: ${t(`lineList.sort.${sort.key}`)}`}
          data-testid="line-sort"
          onClick={() => setOpen((value) => !value)}
        >
          {compact ? <SortHint /> : null}
          <SortIcon kind={sort.key} />
          <span>{t(`lineList.sort.${sort.key}`)}</span>
        </button>
      ) : null}
      <button
        type="button"
        className={showFamily ? styles.familyOn : styles.family}
        aria-pressed={showFamily}
        data-testid="line-family"
        onClick={onToggleFamily}
      >
        <FamilyIcon />
        <span>{t('lineList.family')}</span>
      </button>
      {menu}
    </div>
  );
}

function SortHint() {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden>
      <path d="M8 6v12M5 9l3-3 3 3" />
      <path d="M16 18V6M13 15l3 3 3-3" />
    </svg>
  );
}

function DirectionMark({ direction }: { direction: 'asc' | 'desc' }) {
  return (
    <svg className={styles.dir} viewBox="0 0 24 24" aria-hidden>
      {direction === 'asc' ? (
        <path d="M12 19V5M6 11l6-6 6 6" />
      ) : (
        <path d="M12 5v14M6 13l6 6 6-6" />
      )}
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" />
      <path d="M8 16c2-3 4-5 8-7" />
    </svg>
  );
}

function SortIcon({ kind }: { kind: LineSortKey }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden>
      {kind === 'alpha' ? (
        <path d="M5 18 10 6l5 12M7.2 13h5.6" />
      ) : kind === 'pyramid' ? (
        <>
          <path d="M12 4 20 19H4z" />
          <path d="M8.2 13h7.6M6.2 17h11.6" />
        </>
      ) : kind === 'cost' ? (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M9.5 9.5c.6-.8 1.4-1.2 2.5-1.2 1.6 0 2.6.8 2.6 2s-1 1.8-2.6 2.1c-1.6.3-2.6.9-2.6 2.1s1.1 2 2.7 2c1.1 0 2-.4 2.6-1.2" />
        </>
      ) : kind === 'percentage' ? (
        <>
          <circle cx="8" cy="8" r="2.2" />
          <circle cx="16" cy="16" r="2.2" />
          <path d="M17 7 7 17" />
        </>
      ) : kind === 'category' ? (
        <>
          <path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z" />
          <path d="M8 16c2-3 4-5 8-7" />
        </>
      ) : kind === 'dateAdded' ? (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </>
      ) : kind === 'weight' ? (
        <>
          <path d="M12 3v3M4 9h16" />
          <path d="M7 9 5 15a3.2 3.2 0 0 0 6.2 0z" />
          <path d="M17 9 15 15a3.2 3.2 0 0 0 6.2 0z" />
        </>
      ) : (
        <path d="M12 3s6 6.2 6 10.2A6 6 0 0 1 6 13.2C6 9.2 12 3 12 3z" />
      )}
    </svg>
  );
}
