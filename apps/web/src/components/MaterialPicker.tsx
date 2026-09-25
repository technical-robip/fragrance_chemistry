import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { filterCatalogIndex } from '@fc/shared';
import {
  CATALOG_FAMILIES,
  CATALOG_MANUFACTURERS,
  CATALOG_NOTE_FILTERS,
  catalogNoteLabel,
  toggleCatalogFilter,
} from '@/lib/catalog-filters';
import { useCatalogIndex, type PickedMaterial } from '@/lib/catalog-index';
import { CreatePrivateMaterialForm } from './CreatePrivateMaterialForm';
import { MaterialAvatar } from './MaterialAvatar';
import styles from './MaterialPicker.module.css';

export type { PickedMaterial };

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (material: PickedMaterial) => void;
  title?: string;
  closeOnPick?: boolean;
  selectedIds?: string[];
};

export function MaterialPicker({
  open,
  onClose,
  onPick,
  title,
  closeOnPick = true,
  selectedIds = [],
}: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [families, setFamilies] = useState<string[]>([]);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [view, setView] = useState<'list' | 'create'>('list');
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!open) {
      setView('list');
      setQ('');
      setNotes([]);
      setFamilies([]);
      setManufacturers([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (view === 'create') {
          setView('list');
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, view]);

  const { data, isLoading, isError } = useCatalogIndex(true, open);
  const filtered = useMemo(
    () =>
      filterCatalogIndex(data ?? [], {
        q: q || undefined,
        notes,
        families,
        manufacturers,
      }),
    [data, q, notes, families, manufacturers],
  );

  function pick(material: PickedMaterial) {
    if (selected.has(material.id)) return;
    onPick(material);
    if (closeOnPick) {
      onClose();
      return;
    }
    setQ('');
    setView('list');
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t('catalog.addNote')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2>{view === 'create' ? t('catalog.createTitle') : (title ?? t('catalog.addNote'))}</h2>
          <button type="button" className="fc-btn fc-btn--ghost" onClick={onClose}>
            ✕
          </button>
        </header>

        {view === 'create' ? (
          <CreatePrivateMaterialForm
            initialName={q}
            onCancel={() => setView('list')}
            onCreated={pick}
          />
        ) : (
          <>
            <input
              ref={searchRef}
              className="fc-input"
              autoFocus
              placeholder={t('catalog.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className={styles.filters}>
              <p className={styles.filtersLabel}>{t('catalog.filters')}</p>
              <div className={styles.chips} role="group" aria-label={t('catalog.note')}>
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
              <div className={styles.chips} role="group" aria-label={t('catalog.family')}>
                {CATALOG_FAMILIES.map((family) => (
                  <button
                    key={family}
                    type="button"
                    className={`fc-chip ${families.includes(family) ? 'fc-chip--active' : ''}`}
                    onClick={() => setFamilies((prev) => toggleCatalogFilter(prev, family))}
                  >
                    {t(`families.${family}`, { defaultValue: family })}
                  </button>
                ))}
              </div>
              <p className={styles.filtersLabel}>{t('catalog.manufacturer')}</p>
              <div
                className={`${styles.chips} ${styles.chipsScroll}`}
                role="group"
                aria-label={t('catalog.manufacturer')}
              >
                {CATALOG_MANUFACTURERS.map((maker) => (
                  <button
                    key={maker}
                    type="button"
                    className={`fc-chip ${manufacturers.includes(maker) ? 'fc-chip--active' : ''}`}
                    onClick={() => setManufacturers((prev) => toggleCatalogFilter(prev, maker))}
                  >
                    {maker}
                  </button>
                ))}
              </div>
            </div>
            <ul className={styles.list}>
              {isLoading ? <li className={styles.muted}>{t('catalog.loading')}</li> : null}
              {isError ? <li className={styles.muted}>{t('catalog.failed')}</li> : null}
              {filtered.map((m) => {
                const added = selected.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      className={`${styles.item} ${added ? styles.itemAdded : ''}`}
                      disabled={added}
                      onClick={() => pick(m)}
                    >
                      <span className={styles.itemBody}>
                        <MaterialAvatar
                          name={m.name}
                          family={m.olfactoryFamily}
                          imageUrl={m.imageUrl}
                          size={32}
                        />
                        <span className={styles.itemMain}>
                          <strong>
                            {m.name}
                            {m.isPrivate ? (
                              <em className={styles.yours}>{t('catalog.yours')}</em>
                            ) : null}
                          </strong>
                          <span>
                            {[m.manufacturer, m.olfactoryFamily, catalogNoteLabel(m.pyramidNote, t)]
                              .filter((part) => part && part !== '—')
                              .join(' · ')}
                          </span>
                        </span>
                      </span>
                      {added ? <span className={styles.added}>{t('catalog.added')}</span> : null}
                    </button>
                  </li>
                );
              })}
              {!isLoading && !isError && filtered.length === 0 ? (
                <li className={styles.muted}>
                  {t('catalog.empty')}{' '}
                  <button
                    type="button"
                    className={styles.textLink}
                    onClick={() => setView('create')}
                  >
                    {t('catalog.createCustom')}
                  </button>
                </li>
              ) : null}
            </ul>
            <div className={styles.footer}>
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                onClick={() => setView('create')}
              >
                {t('catalog.createCustom')}
              </button>
              {closeOnPick ? null : (
                <button type="button" className="fc-btn fc-btn--primary" onClick={onClose}>
                  {t('catalog.done')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
