import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LabUnitMode } from '@fc/shared';
import { FcCheckbox } from '@/components/FcCheckbox';
import { MaterialAvatar } from '@/components/MaterialAvatar';
import styles from './CompositionInspector.module.css';

export type CompositionLine = {
  id?: string;
  materialId: string;
  slug: string | null;
  name: string;
  percent: number;
  ppt?: number;
  grams?: number;
  neatPercent?: number;
  neatPpt?: number;
  neatGrams?: number;
  stockConcentrationPct?: number;
  solvent?: string | null;
  dilutionLabel?: string | null;
  lineCost?: number;
  costPerGram?: number;
  pyramidNote: string | null;
  tenacityHours?: number | null;
  olfactoryFamily: string | null;
  imageUrl?: string | null;
  childFormulaId?: string | null;
  children?: CompositionLine[];
};

type Props = {
  lines: CompositionLine[];
  title?: string;
  emptyHint?: string;
  from?: string;
  fromLabel?: string;
  currency?: string;
  showLabColumns?: boolean;
  onSaveAccord?: (lineIds: string[]) => void;
};

function noteLabel(note: string | null, t: (k: string) => string) {
  if (note === 'top') return t('catalog.top');
  if (note === 'middle' || note === 'heart') return t('catalog.heart');
  if (note === 'base') return t('catalog.base');
  if (note === 'modifier') return t('dashboard.modifier');
  return t('catalog.other');
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function primaryValue(line: CompositionLine, mode: LabUnitMode): string {
  if (mode === 'ppt') return `${(line.ppt ?? line.percent * 10).toFixed(0)} ppt`;
  if (mode === 'grams') return `${(line.grams ?? 0).toFixed(3)} g`;
  return `${line.percent.toFixed(1)}%`;
}

export function CompositionInspector({
  lines,
  title,
  emptyHint,
  from,
  fromLabel,
  currency = 'USD',
  showLabColumns = true,
  onSaveAccord,
}: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const [mode, setMode] = useState<LabUnitMode>('percent');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const heading = title ?? t('dashboard.inspectorTitle');
  const navFrom = from ?? `${location.pathname}${location.search}`;
  const navLabel = fromLabel ?? t('dashboard.title');

  const selectedIds = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k),
    [selected],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <h3 className={styles.title}>{heading}</h3>
        {showLabColumns ? (
          <div className={styles.units} role="group" aria-label={t('dashboard.unitMode')}>
            {(['percent', 'ppt', 'grams'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? styles.unitActive : styles.unit}
                onClick={() => setMode(m)}
              >
                {m === 'percent' ? '%' : m === 'ppt' ? 'PPT' : 'g'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {onSaveAccord && selectedIds.length >= 2 ? (
        <button
          type="button"
          className={styles.accordBtn}
          onClick={() => onSaveAccord(selectedIds)}
        >
          {t('dashboard.saveAsAccord')}
        </button>
      ) : null}

      {lines.length === 0 ? (
        <p className={styles.empty}>{emptyHint ?? t('dashboard.inspectorEmpty')}</p>
      ) : (
        <ul className={styles.list}>
          {lines.map((line) => {
            const key = line.id ?? `${line.materialId}-${line.name}`;
            const href = line.childFormulaId
              ? `/workbench?formula=${line.childFormulaId}`
              : line.slug
                ? `/catalog/${line.slug}`
                : `/catalog/${line.materialId}`;
            const isAccord = Boolean(line.childFormulaId);
            const open = expanded[key];
            return (
              <li key={key} className={styles.item}>
                <div className={styles.row}>
                  {onSaveAccord && line.id ? (
                    <FcCheckbox
                      className={styles.check}
                      size="sm"
                      checked={Boolean(selected[line.id])}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [line.id!]: e.target.checked }))
                      }
                      aria-label={t('dashboard.selectLine')}
                    />
                  ) : null}
                  {isAccord ? (
                    <button
                      type="button"
                      className={styles.expand}
                      aria-expanded={open}
                      onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                  ) : (
                    <span className={styles.expandSpacer} />
                  )}
                  <Link
                    to={href}
                    state={{ from: navFrom, fromLabel: navLabel }}
                    className={styles.link}
                  >
                    <MaterialAvatar
                      name={line.name}
                      family={line.olfactoryFamily}
                      imageUrl={line.imageUrl}
                      size={36}
                      className={styles.avatar}
                    />
                    <span className={styles.name}>
                      {line.name}
                      {isAccord ? (
                        <span className={styles.accordTag}>{t('dashboard.accord')}</span>
                      ) : null}
                    </span>
                    <span className={styles.meta}>
                      {line.dilutionLabel ? `${line.dilutionLabel} · ` : ''}
                      {line.olfactoryFamily ?? t('dashboard.unassignedFamily')}
                      {' · '}
                      {noteLabel(line.pyramidNote, t)}
                    </span>
                    <div className={styles.metrics}>
                      <em className={styles.pct}>{primaryValue(line, mode)}</em>
                      {showLabColumns && line.dilutionLabel && line.neatPercent != null ? (
                        <span className={styles.neat}>
                          {t('dashboard.neatShort')}:{' '}
                          {mode === 'ppt'
                            ? `${(line.neatPpt ?? line.neatPercent * 10).toFixed(0)} ppt`
                            : mode === 'grams'
                              ? `${(line.neatGrams ?? 0).toFixed(3)} g`
                              : `${line.neatPercent.toFixed(2)}%`}
                        </span>
                      ) : null}
                      {showLabColumns && line.lineCost != null ? (
                        <span className={styles.cost}>{formatMoney(line.lineCost, currency)}</span>
                      ) : null}
                    </div>
                  </Link>
                </div>
                {isAccord && open && line.children?.length ? (
                  <ul className={styles.nested}>
                    {line.children.map((child) => (
                      <li key={child.id ?? child.materialId}>
                        <span>{child.name}</span>
                        <em>{primaryValue(child, mode)}</em>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
