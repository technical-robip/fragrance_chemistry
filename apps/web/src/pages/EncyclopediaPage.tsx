import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api-client';
import { NotesRadar } from '@/components/viz/NotesRadar';
import { FragrancePyramid } from '@/components/viz/FragrancePyramid';
import { capRadarAxes } from '@/lib/formula-viz';
import { useFormulaStore } from '@/stores/formula-store';
import { formulaUrlKey, type FormulaSummary } from '@/components/FormulaSelector';
import styles from './EncyclopediaPage.module.css';

type Perfume = {
  id: string;
  name: string;
  house: string | null;
  perfumer: string | null;
  year: number | null;
  family: string | null;
  pyramid: {
    top?: string[];
    heart?: string[];
    base?: string[];
  };
  attributes: Record<string, number>;
};

type BriefResult = {
  perfume: Perfume;
  formula: { id: string; name: string };
};

const AXIS_ORDER = ['fresh', 'floral', 'woody', 'sweet', 'spicy'];

function familyKey(id: string) {
  return `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}

type NoteBand = {
  id: 'top' | 'middle' | 'base';
  label: string;
  percent: number;
  notes: string[];
  toneClass: string;
};

function EncyclopediaCard({
  perfume,
  generating,
  onBrief,
  t,
}: {
  perfume: Perfume;
  generating: boolean;
  onBrief: (id: string) => void;
  t: (key: string, options?: Record<string, string>) => string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const top = perfume.pyramid.top ?? [];
  const heart = perfume.pyramid.heart ?? [];
  const base = perfume.pyramid.base ?? [];
  const bands: NoteBand[] = [
    {
      id: 'top',
      label: t('catalog.top'),
      percent: top.length ? 30 : 0,
      notes: top,
      toneClass: styles.note_top ?? '',
    },
    {
      id: 'middle',
      label: t('catalog.heart'),
      percent: heart.length ? 40 : 0,
      notes: heart,
      toneClass: styles.note_heart ?? '',
    },
    {
      id: 'base',
      label: t('catalog.base'),
      percent: base.length ? 30 : 0,
      notes: base,
      toneClass: styles.note_base ?? '',
    },
  ];
  const attrKeys = [
    ...AXIS_ORDER.filter((key) => key in (perfume.attributes ?? {})),
    ...Object.keys(perfume.attributes ?? {}).filter((key) => !AXIS_ORDER.includes(key)),
  ];
  const radarAxes = capRadarAxes(
    attrKeys.map((id) => ({
      id,
      label: t(`families.${familyKey(id)}`, { defaultValue: id }),
      value: perfume.attributes[id] ?? 0,
    })),
  );
  const peaks = [...radarAxes].sort((a, b) => b.value - a.value).slice(0, 3);
  const familyLabel = perfume.family
    ? t(`families.${perfume.family}`, { defaultValue: perfume.family })
    : null;

  return (
    <article className={`fc-card ${styles.entry}`}>
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <div className={styles.titleRow}>
            <h2>{perfume.name}</h2>
            {familyLabel ? <span className={styles.family}>{familyLabel}</span> : null}
          </div>
          <p className={styles.descriptor}>
            {[perfume.house, perfume.perfumer, perfume.year].filter(Boolean).join(' · ') ||
              t('encyclopedia.untitled')}
          </p>
        </div>
        <button
          type="button"
          className={`fc-btn fc-btn--amber ${styles.briefBtn}`}
          disabled={generating}
          onClick={() => onBrief(perfume.id)}
        >
          {generating ? t('encyclopedia.generating') : t('encyclopedia.generateBrief')}
        </button>
      </header>

      <div className={styles.body}>
        <FragrancePyramid
          compact
          showLegend={false}
          showCallouts
          activeId={activeId}
          onSelect={setActiveId}
          tiers={bands.map(({ id, label, percent, notes }) => ({ id, label, percent, notes }))}
        />
        <div className={styles.radarCol}>
          <NotesRadar axes={radarAxes} showLegend={false} compact />
          {peaks.length > 0 ? (
            <p className={styles.peaks}>
              {peaks.map((axis) => `${axis.label} ${axis.value}`).join(' · ')}
            </p>
          ) : null}
        </div>
        <ul className={styles.notes}>
          {bands.map((band) =>
            band.notes.length === 0 ? null : (
              <li
                key={band.id}
                className={`${styles.noteRow} ${activeId === band.id ? styles.noteRowActive : ''}`}
              >
                <span className={`${styles.noteLabel} ${band.toneClass}`}>{band.label}</span>
                <span>{band.notes.join(' · ')}</span>
              </li>
            ),
          )}
        </ul>
      </div>
    </article>
  );
}

export function EncyclopediaPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const setActiveFormulaId = useFormulaStore((s) => s.setActiveFormulaId);
  const [lastBrief, setLastBrief] = useState<BriefResult | null>(null);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['community', 'perfumes'],
    queryFn: () => api.get<Perfume[]>('/community/perfumes'),
  });

  const brief = useMutation({
    mutationFn: (id: string) => api.post<BriefResult>(`/community/perfumes/${id}/lab-brief`),
    onSuccess: async (result) => {
      setLastBrief(result);
      setActiveFormulaId(result.formula.id);
      await qc.invalidateQueries({ queryKey: ['formulas'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
  });

  const { data: formulas } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
  });
  const libraryAccords = (formulas ?? []).filter((row) => row.isLibraryAccord);

  const families = useMemo(() => {
    const set = new Set<string>();
    for (const perfume of data ?? []) {
      if (perfume.family) set.add(perfume.family);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const perfumes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((perfume) => {
      if (family !== 'all' && perfume.family !== family) return false;
      if (!q) return true;
      const notes = [
        ...(perfume.pyramid.top ?? []),
        ...(perfume.pyramid.heart ?? []),
        ...(perfume.pyramid.base ?? []),
      ].join(' ');
      const hay = [perfume.name, perfume.house, perfume.perfumer, perfume.family, notes]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, family, query]);

  return (
    <div>
      <h1 className="fc-page-title">{t('encyclopedia.title')}</h1>
      <p className="fc-muted">{t('encyclopedia.subtitle')}</p>

      {libraryAccords.length > 0 ? (
        <div className={styles.libraryAccords}>
          <h2 className={styles.libraryTitle}>{t('encyclopedia.libraryAccordsTitle')}</h2>
          <p className="fc-muted">{t('encyclopedia.libraryAccordsBlurb')}</p>
          <ul className={styles.libraryList}>
            {libraryAccords.map((accord) => (
              <li key={accord.id}>
                <Link
                  to={`/workbench?formula=${encodeURIComponent(formulaUrlKey(accord) ?? accord.id)}`}
                >
                  {accord.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="fc-muted">{t('encyclopedia.noLibraryAccords')}</p>
      )}

      {lastBrief ? (
        <div className={`fc-card ${styles.result}`} role="status">
          <p>
            {t('encyclopedia.createdFormula', {
              formula: lastBrief.formula.name,
              perfume: lastBrief.perfume.name,
            })}
          </p>
          <div className={styles.resultActions}>
            <Link
              className="fc-btn fc-btn--primary"
              to={`/workbench?formula=${lastBrief.formula.id}`}
            >
              {t('encyclopedia.openWorkbench')}
            </Link>
            <Link className="fc-btn fc-btn--amber" to={`/costing?formula=${lastBrief.formula.id}`}>
              {t('encyclopedia.costIt')}
            </Link>
            <Link
              className="fc-btn fc-btn--ghost"
              to={`/evaluation?formula=${lastBrief.formula.id}`}
            >
              {t('encyclopedia.evaluate')}
            </Link>
          </div>
        </div>
      ) : null}

      <label className="fc-label" htmlFor="encyclopedia-search">
        {t('catalog.search')}
      </label>
      <input
        id="encyclopedia-search"
        className={`fc-input ${styles.search}`}
        placeholder={t('encyclopedia.searchPlaceholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={styles.chipRow} role="group" aria-label={t('catalog.family')}>
        <button
          type="button"
          className={`fc-chip ${family === 'all' ? 'fc-chip--active' : ''}`}
          onClick={() => setFamily('all')}
        >
          {t('catalog.all')}
        </button>
        {families.map((id) => (
          <button
            key={id}
            type="button"
            className={`fc-chip ${family === id ? 'fc-chip--active' : ''}`}
            onClick={() => setFamily(id)}
          >
            {t(`families.${id}`, { defaultValue: id })}
          </button>
        ))}
      </div>

      {isLoading ? <p className="fc-muted">{t('encyclopedia.loading')}</p> : null}
      {isError ? <p className="fc-muted">{t('encyclopedia.failed')}</p> : null}
      {!isLoading && !isError && perfumes.length === 0 ? (
        <p className="fc-muted">{t('encyclopedia.empty')}</p>
      ) : null}

      <div className={styles.list}>
        {perfumes.map((perfume) => (
          <EncyclopediaCard
            key={perfume.id}
            perfume={perfume}
            generating={brief.isPending && brief.variables === perfume.id}
            onBrief={(id) => brief.mutate(id)}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
