import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { filterCatalogIndex } from '@fc/shared';
import { EmptyPyramid } from '@/components/viz/EmptyPyramid';
import { MaterialAvatar } from '@/components/MaterialAvatar';
import {
  CATALOG_FAMILIES,
  CATALOG_MANUFACTURERS,
  CATALOG_NOTE_FILTERS,
  catalogNoteLabel,
  toggleCatalogFilter,
} from '@/lib/catalog-filters';
import { useCatalogIndex } from '@/lib/catalog-index';
import { familyHue } from '@/lib/formula-viz';
import styles from './CatalogPage.module.css';

export function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);

  const { data, isLoading, isError } = useCatalogIndex(false);
  const rows = useMemo(
    () =>
      filterCatalogIndex(data ?? [], {
        q: q || undefined,
        notes,
        families,
        manufacturers,
      }),
    [data, q, notes, families, manufacturers],
  );
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 12,
  });

  return (
    <div>
      <h1 className="fc-page-title">{t('catalog.title')}</h1>
      <p className="fc-muted" style={{ marginBottom: '1rem' }}>
        {t('catalog.subtitle')}
        {isLoading ? ` — ${t('catalog.loading')}` : null}
        {isError ? ` — ${t('catalog.failed')}` : null}
        {!isLoading && !isError
          ? ` — ${t('catalog.materialsCount', { count: rows.length })}`
          : null}
      </p>

      <label className="fc-label" htmlFor="catalog-search">
        {t('catalog.search')}
      </label>
      <input
        id="catalog-search"
        className={`fc-input ${styles.search}`}
        placeholder={t('catalog.searchPlaceholder')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <p className={styles.filtersLabel}>{t('catalog.filters')}</p>
      <div className={styles.chipRow} role="group" aria-label={t('catalog.note')}>
        {CATALOG_NOTE_FILTERS.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`fc-chip ${notes.includes(n.id) ? 'fc-chip--active' : ''}`}
            onClick={() => setNotes((prev) => toggleCatalogFilter(prev, n.id))}
          >
            {t(n.labelKey)}
          </button>
        ))}
      </div>
      <div className={styles.chipRow} role="group" aria-label={t('catalog.family')}>
        {CATALOG_FAMILIES.map((f) => (
          <button
            key={f}
            type="button"
            className={`fc-chip ${families.includes(f) ? 'fc-chip--active' : ''}`}
            onClick={() => setFamilies((prev) => toggleCatalogFilter(prev, f))}
          >
            {t(`families.${f}`, { defaultValue: f })}
          </button>
        ))}
      </div>
      <p className={styles.filtersLabel}>{t('catalog.manufacturer')}</p>
      <div
        className={`${styles.chipRow} ${styles.chipRowScroll}`}
        role="group"
        aria-label={t('catalog.manufacturer')}
      >
        {CATALOG_MANUFACTURERS.map((m) => (
          <button
            key={m}
            type="button"
            className={`fc-chip ${manufacturers.includes(m) ? 'fc-chip--active' : ''}`}
            onClick={() => setManufacturers((prev) => toggleCatalogFilter(prev, m))}
          >
            {m}
          </button>
        ))}
      </div>

      <div ref={parentRef} className={styles.list}>
        {rows.length === 0 && !isLoading ? (
          <div className={styles.empty}>
            <EmptyPyramid />
            <p>{t('catalog.empty')}</p>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            <AnimatePresence initial={false}>
              {virtualizer.getVirtualItems().map((vRow) => {
                const m = rows[vRow.index]!;
                const accent = familyHue(m.olfactoryFamily);
                return (
                  <div
                    key={m.id}
                    className={styles.row}
                    style={{
                      height: `${vRow.size}px`,
                      transform: `translateY(${vRow.start}px)`,
                      ['--accent' as string]: accent,
                    }}
                  >
                    <motion.button
                      type="button"
                      className={styles.rowInner}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.18, delay: Math.min(vRow.index, 8) * 0.015 }}
                      onClick={() =>
                        navigate(`/catalog/${m.slug ?? m.id}`, {
                          state: { from: '/catalog', fromLabel: t('catalog.title') },
                        })
                      }
                    >
                      <span className={styles.accent} />
                      <MaterialAvatar
                        name={m.name}
                        family={m.olfactoryFamily}
                        imageUrl={m.imageUrl}
                        size={36}
                      />
                      <span className={styles.rowText}>
                        <strong>{m.name.toUpperCase()}</strong>
                        {m.manufacturer ? ` (${m.manufacturer})` : ''}
                        {m.pyramidNote
                          ? ` (${catalogNoteLabel(m.pyramidNote, t).toLowerCase()})`
                          : ''}
                      </span>
                    </motion.button>
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
