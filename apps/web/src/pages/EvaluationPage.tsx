import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import {
  BATCH_COLUMNS,
  EVALUATION_LINE_MARKS,
  EVALUATION_TIMEPOINTS,
  FOCUS_LINE_CAP,
  MACERATION_DAYS,
  hoursForSlot,
  isDayOne,
  juiceClassFromConcentration,
  joinEvaluationNotes,
  splitEvaluationNotes,
  markForMaterial,
  mergeLineMarks,
  overlayWorkingSitting,
  resolveSittingId,
  slotForHours,
  toggleLineMark,
  visibleBlotterLines,
  type BatchColumnId,
  type EvaluationLineMark,
  type EvaluationLineMarkRow,
  type EvaluationTimepointKey,
} from '@fc/shared';
import {
  FormulaSelector,
  useSelectedFormulaId,
  useSelectedFormulaRouteKey,
} from '@/components/FormulaSelector';
import { FcCheckbox } from '@/components/FcCheckbox';
import { FcSelect } from '@/components/FcSelect';
import { BatchBlotter } from '@/components/viz/BatchBlotter';
import { EvolutionPlayhead } from '@/components/viz/EvolutionPlayhead';
import { api } from '@/lib/api-client';
import { withLabQuery } from '@/lib/lab-query';
import { FormulaReminder } from './FormulaReminder';
import {
  filterEvaluations,
  groupByFormula,
  type EvaluationSummary,
} from '@/lib/evaluation-library';
import styles from './EvaluationPage.module.css';

const CLARITY = ['clear', 'haze', 'cloudy'] as const;
const OPALESCENCE = ['none', 'slight', 'strong'] as const;
const SOLUBILITY = ['complete', 'partial', 'phase-sep'] as const;

type Clarity = (typeof CLARITY)[number];
type Opalescence = (typeof OPALESCENCE)[number];
type Solubility = (typeof SOLUBILITY)[number];

type EvaluationRow = EvaluationSummary;

type FormulaLine = {
  id?: string;
  materialId: string;
  materialName: string;
  percent: string;
  pyramidNote: string | null;
  olfactoryFamily?: string | null;
};

type FormulaHead = {
  id: string;
  name: string;
  slug?: string | null;
  concentrationPct: string;
  status: string;
  lines?: FormulaLine[];
};

const CLARITY_KEY: Record<string, string> = {
  clear: 'clarityClear',
  haze: 'clarityHaze',
  cloudy: 'clarityCloudy',
};
const OPAL_KEY: Record<string, string> = {
  none: 'opalNone',
  slight: 'opalSlight',
  strong: 'opalStrong',
};
const SOL_KEY: Record<string, string> = {
  complete: 'solComplete',
  partial: 'solPartial',
  'phase-sep': 'solPhaseSep',
};

const SLOT_KEY: Record<EvaluationTimepointKey, string> = {
  t0Notes: 'slotT0',
  t30mNotes: 'slotT30',
  t4hNotes: 'slotT4h',
  t24hNotes: 'slotT24h',
};

const MARK_KEY: Record<EvaluationLineMark, string> = {
  ok: 'markOk',
  weak: 'markWeak',
  strong: 'markStrong',
  harsh: 'markHarsh',
};

const PYRAMID_KEY: Record<string, string> = {
  top: 'noteTop',
  middle: 'noteHeart',
  base: 'noteBase',
  modifier: 'noteModifier',
};

const MARK_ON: Record<EvaluationLineMark, string> = {
  ok: styles.markOk ?? '',
  weak: styles.markWeak ?? '',
  strong: styles.markStrong ?? '',
  harsh: styles.markHarsh ?? '',
};

function asEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function snippet(ev: EvaluationRow, empty: string) {
  const text = isDayOne(ev.macerationDay)
    ? ev.t0Notes || ev.notes || ''
    : ev.notes || ev.t0Notes || '';
  if (!text) return empty;
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function activeColumnForDay(day: number, slot: EvaluationTimepointKey): BatchColumnId {
  if (isDayOne(day)) return slot;
  if (day === 7) return 'day7';
  if (day === 14) return 'day14';
  return 'day30';
}

export function EvaluationPage() {
  const { t } = useTranslation();
  const formulaIdFromList = useSelectedFormulaId();
  const formulaRouteKey = useSelectedFormulaRouteKey();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const dayParam = params.get('day');
  const slotParam = params.get('slot');
  const evalParam = params.get('eval');

  const [day, setDay] = useState(1);
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState({
    t0Notes: '',
    t30mNotes: '',
    t4hNotes: '',
    t24hNotes: '',
  });
  const [clarity, setClarity] = useState<Clarity>('clear');
  const [opalescence, setOpalescence] = useState<Opalescence>('none');
  const [solubility, setSolubility] = useState<Solubility>('complete');
  const [dayNote, setDayNote] = useState('');
  const [hours, setHours] = useState(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [lineMarks, setLineMarks] = useState<EvaluationLineMarkRow[]>([]);
  const sittingRef = useRef({
    formulaId: undefined as string | null | undefined,
    loadedId: null as string | null,
    rating: 3,
    day: 1,
    dayOne: true,
    notes: {
      t0Notes: '',
      t30mNotes: '',
      t4hNotes: '',
      t24hNotes: '',
    },
    dayNote: '',
    clarity: 'clear' as Clarity,
    opalescence: 'none' as Opalescence,
    solubility: 'complete' as Solubility,
    lineMarks: [] as EvaluationLineMarkRow[],
  });
  const [lineQuery, setLineQuery] = useState('');
  const [pyramidNote, setPyramidNote] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string | null>(null);
  const [showAllBlotter, setShowAllBlotter] = useState(false);
  const [showAllMarks, setShowAllMarks] = useState(false);

  const [q, setQ] = useState('');
  const [dayFilter, setDayFilter] = useState<number | null>(null);
  const [minRating, setMinRating] = useState(1);
  const [groupBy, setGroupBy] = useState<'formula' | 'time'>('time');
  const [onlyThisFormula, setOnlyThisFormula] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const activeTp = useMemo(() => slotForHours(hours), [hours]);
  const dayOne = isDayOne(day);
  const activeColumn = activeColumnForDay(day, activeTp);

  const formula = useQuery({
    queryKey: ['formulas', formulaRouteKey],
    queryFn: () => api.get<FormulaHead>(`/formulas/${formulaRouteKey}`),
    enabled: !!formulaRouteKey,
  });
  const formulaId = formula.data?.id ?? formulaIdFromList;

  const library = useQuery({
    queryKey: ['evaluations', 'all'],
    queryFn: () => api.get<EvaluationRow[]>('/evaluations'),
  });

  function resetForm(nextDay = 1) {
    setDay(nextDay);
    setRating(3);
    setNotes({ t0Notes: '', t30mNotes: '', t4hNotes: '', t24hNotes: '' });
    setClarity('clear');
    setOpalescence('none');
    setSolubility('complete');
    setHours(0);
    setLoadedId(null);
    setLineMarks([]);
    setDayNote('');
  }

  function loadCheckpoint(ev: EvaluationRow, slot?: EvaluationTimepointKey) {
    setDay(ev.macerationDay && ev.macerationDay > 0 ? ev.macerationDay : 1);
    setRating(ev.rating);
    const packed = splitEvaluationNotes(ev.notes);
    setNotes({
      t0Notes: ev.t0Notes || packed.t0Notes || '',
      t30mNotes: ev.t30mNotes || packed.t30mNotes || '',
      t4hNotes: ev.t4hNotes || packed.t4hNotes || '',
      t24hNotes: ev.t24hNotes || packed.t24hNotes || '',
    });
    setClarity(asEnum(ev.clarity, CLARITY, 'clear'));
    setOpalescence(asEnum(ev.opalescence, OPALESCENCE, 'none'));
    setSolubility(asEnum(ev.solubility, SOLUBILITY, 'complete'));
    setHours(hoursForSlot(slot ?? 't0Notes'));
    setLoadedId(ev.id);
    setLineMarks(ev.lineMarks ?? []);
    setDayNote(isDayOne(ev.macerationDay) ? '' : (ev.notes ?? ev.t0Notes ?? ''));
  }

  function setEvalParam(id: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('eval', id);
        else next.delete('eval');
        return next;
      },
      { replace: true },
    );
  }

  const appliedRef = useRef<string | null>(null);
  useEffect(() => {
    const data = library.data;
    if (!data) return;
    const requestedDay = Number(dayParam);
    const dayFocus = (MACERATION_DAYS as readonly number[]).includes(requestedDay)
      ? requestedDay
      : null;
    const requestedSlot = EVALUATION_TIMEPOINTS.find((tp) => tp.key === slotParam)?.key;
    if (dayFocus && formulaId) {
      const focusSig = `focus|${formulaId}|${dayFocus}|${requestedSlot ?? ''}`;
      if (appliedRef.current === focusSig) return;
      appliedRef.current = focusSig;
      selectDay(dayFocus, requestedSlot);
      return;
    }
    const sig = `${formulaId ?? ''}|${evalParam ?? ''}`;
    if (evalParam) {
      const found = data.find((e) => e.id === evalParam);
      if (!found) return;
      if (sittingRef.current.loadedId === found.id) {
        const packed = splitEvaluationNotes(found.notes);
        setNotes((prev) => ({
          t0Notes: prev.t0Notes || found.t0Notes || packed.t0Notes || '',
          t30mNotes: prev.t30mNotes || found.t30mNotes || packed.t30mNotes || '',
          t4hNotes: prev.t4hNotes || found.t4hNotes || packed.t4hNotes || '',
          t24hNotes: prev.t24hNotes || found.t24hNotes || packed.t24hNotes || '',
        }));
        setLineMarks((prev) => mergeLineMarks(found.lineMarks, prev, found.macerationDay ?? 1));
        appliedRef.current = sig;
        return;
      }
      if (appliedRef.current === sig) return;
      appliedRef.current = sig;
      loadCheckpoint(found);
      return;
    }
    if (appliedRef.current === sig) return;
    appliedRef.current = sig;
    const latest = formulaId ? data.find((e) => e.formulaId === formulaId) : undefined;
    if (latest) {
      loadCheckpoint(latest);
      if (latest.id !== evalParam) setEvalParam(latest.id);
      return;
    }
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formulaId, evalParam, library.data, dayParam, slotParam]);

  useEffect(() => {
    setLineQuery('');
    setPyramidNote(null);
    setFamilyFilter(null);
    setShowAllBlotter(false);
    setShowAllMarks(false);
  }, [formulaId]);

  sittingRef.current = {
    formulaId,
    loadedId,
    rating,
    day,
    dayOne,
    notes,
    dayNote,
    clarity,
    opalescence,
    solubility,
    lineMarks,
  };

  const save = useMutation({
    mutationFn: async (draft?: Partial<(typeof sittingRef)['current']>) => {
      const sitting = { ...sittingRef.current, ...draft };
      if (!sitting.formulaId) throw new Error('No formula');
      const savedMarks = (qc.getQueryData<EvaluationRow[]>(['evaluations', 'all']) ?? []).find(
        (row) => row.id === sitting.loadedId,
      )?.lineMarks;
      const body = {
        formulaId: sitting.formulaId,
        rating: sitting.rating,
        macerationDay: sitting.day,
        t0Notes: sitting.dayOne ? sitting.notes.t0Notes || undefined : '',
        t30mNotes: sitting.dayOne ? sitting.notes.t30mNotes || undefined : '',
        t4hNotes: sitting.dayOne ? sitting.notes.t4hNotes || undefined : '',
        t24hNotes: sitting.dayOne ? sitting.notes.t24hNotes || undefined : '',
        clarity: sitting.clarity,
        opalescence: sitting.opalescence,
        solubility: sitting.solubility,
        lineMarks: mergeLineMarks(savedMarks, sitting.lineMarks, sitting.day),
        notes: sitting.dayOne
          ? joinEvaluationNotes(sitting.notes, sitting.day)
          : sitting.dayNote || undefined,
      };
      if (sitting.loadedId) {
        const { formulaId: _omit, ...patch } = body;
        return api.patch<{ id: string }>(`/evaluations/${sitting.loadedId}`, patch);
      }
      return api.post<{ id: string }>('/evaluations', body);
    },
    onSuccess: async (created) => {
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1800);
      const id = created?.id ?? loadedId;
      if (id) {
        setLoadedId(id);
        appliedRef.current = `${formulaId ?? ''}|${id}`;
        setEvalParam(id);
      }
      await qc.invalidateQueries({ queryKey: ['evaluations'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
      await qc.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
    },
  });

  function openCheckpoint(ev: EvaluationRow) {
    appliedRef.current = null;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('formula', ev.formulaId);
      next.set('eval', ev.id);
      return next;
    });
  }

  function selectDay(nextDay: number, slot?: EvaluationTimepointKey) {
    setDay(nextDay);
    if (!formulaId || !library.data) {
      resetForm(nextDay);
      if (slot) setHours(hoursForSlot(slot));
      setEvalParam(null);
      return;
    }
    const id = resolveSittingId(library.data, formulaId, nextDay);
    const found = id ? library.data.find((row) => row.id === id) : undefined;
    if (found) {
      appliedRef.current = `${formulaId}|${found.id}`;
      loadCheckpoint(found, slot);
      setEvalParam(found.id);
      return;
    }
    appliedRef.current = `${formulaId}|`;
    resetForm(nextDay);
    if (slot) setHours(hoursForSlot(slot));
    setEvalParam(null);
  }

  function selectBatchColumn(columnId: BatchColumnId) {
    const column = BATCH_COLUMNS.find((col) => col.id === columnId);
    if (!column) return;
    if (column.day === day) {
      if (column.timepoint) setHours(hoursForSlot(column.timepoint));
      return;
    }
    selectDay(column.day, column.timepoint);
  }

  function toggleMark(line: FormulaLine, mark: EvaluationLineMark) {
    setLineMarks((prev) => toggleLineMark(prev, line, mark, day, dayOne ? activeTp : null));
  }

  function toggleCompare(id: string) {
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 2 ? ids : [...ids, id],
    );
  }

  const concentrationPct = Number(formula.data?.concentrationPct ?? 0);
  const juiceClass = juiceClassFromConcentration(concentrationPct);
  const juiceLabel =
    juiceClass === 'extrait'
      ? t('dashboard.juiceClassExtrait')
      : juiceClass === 'edp'
        ? t('dashboard.juiceClassEdp')
        : t('dashboard.juiceClassEdt');

  const allRows = library.data ?? [];
  const filtered = useMemo(
    () =>
      filterEvaluations(allRows, {
        q,
        day: dayFilter,
        minRating,
        formulaId: onlyThisFormula ? formulaId : null,
      }),
    [allRows, q, dayFilter, minRating, onlyThisFormula, formulaId],
  );
  const groups = useMemo(
    () => (groupBy === 'formula' ? groupByFormula(filtered) : null),
    [groupBy, filtered],
  );
  const compareRows = compareIds
    .map((id) => allRows.find((e) => e.id === id))
    .filter((e): e is EvaluationRow => Boolean(e));

  const clarityText = (v: string | null | undefined) =>
    v ? (CLARITY_KEY[v] ? t(`evaluation.${CLARITY_KEY[v]}`) : v) : '—';
  const opalText = (v: string | null | undefined) =>
    v ? (OPAL_KEY[v] ? t(`evaluation.${OPAL_KEY[v]}`) : v) : '—';
  const solText = (v: string | null | undefined) =>
    v ? (SOL_KEY[v] ? t(`evaluation.${SOL_KEY[v]}`) : v) : '—';

  const slotLabel = (key: EvaluationTimepointKey) => t(`evaluation.${SLOT_KEY[key]}`);

  function renderRow(ev: EvaluationRow, showFormula: boolean) {
    const checked = compareIds.includes(ev.id);
    return (
      <li key={ev.id} className={loadedId === ev.id ? styles.libItemActive : styles.libItem}>
        <FcCheckbox
          className={styles.compareBox}
          size="sm"
          checked={checked}
          disabled={!checked && compareIds.length >= 2}
          onChange={() => toggleCompare(ev.id)}
          aria-label={t('evaluation.compare')}
        />
        <button type="button" className={styles.libBtn} onClick={() => openCheckpoint(ev)}>
          <span className={styles.libTop}>
            {showFormula ? (
              <strong className={styles.libFormula}>{ev.formulaName ?? '—'}</strong>
            ) : null}
            <span className={styles.libDay}>
              {t('evaluation.day', { day: ev.macerationDay ?? '—' })}
            </span>
            <span
              className={styles.libStars}
              aria-label={t('evaluation.ratingAria', { rating: ev.rating })}
            >
              {'★'.repeat(ev.rating)}
              <span className={styles.libStarNum}>{ev.rating}/5</span>
            </span>
            {ev.clarity ? (
              <span className={styles.clarityTag}>{clarityText(ev.clarity)}</span>
            ) : null}
            <span className="fc-muted">{new Date(ev.createdAt).toLocaleDateString()}</span>
          </span>
          <span className={styles.libSnippet}>{snippet(ev, t('evaluation.noNotes'))}</span>
        </button>
      </li>
    );
  }

  const hasAny = allRows.length > 0;
  const lines = formula.data?.lines ?? [];
  const workbenchTo = withLabQuery('/workbench', {
    formula: formula.data?.slug || formulaId,
    evalId: loadedId,
  });
  const heatmapSittings = useMemo(() => {
    if (!formulaId) return [];
    const rows = allRows.filter((row) => row.formulaId === formulaId);
    return overlayWorkingSitting(rows, {
      id: loadedId || 'draft',
      formulaId,
      macerationDay: day,
      rating,
      lineMarks,
      clarity,
      opalescence,
      solubility,
    });
  }, [allRows, formulaId, loadedId, day, rating, lineMarks, clarity, opalescence, solubility]);

  const largeFormula = lines.length > FOCUS_LINE_CAP;
  const marksResult = useMemo(() => {
    if (!formulaId) return { visible: [] as typeof lines, matched: 0 };
    const mode = !largeFormula || showAllMarks ? 'all' : 'unmarked';
    const first = visibleBlotterLines(lines, heatmapSittings, formulaId, activeColumn, {
      query: lineQuery,
      pyramidNote,
      family: familyFilter,
      otherLabel: t('evaluation.familyOther'),
      mode,
      cap: largeFormula && !showAllMarks ? FOCUS_LINE_CAP : null,
    });
    if (first.matched > 0 || !largeFormula || showAllMarks) return first;
    return visibleBlotterLines(lines, heatmapSittings, formulaId, activeColumn, {
      query: lineQuery,
      pyramidNote,
      family: familyFilter,
      otherLabel: t('evaluation.familyOther'),
      mode: 'attention',
      cap: FOCUS_LINE_CAP,
    });
  }, [
    formulaId,
    lines,
    heatmapSittings,
    activeColumn,
    lineQuery,
    pyramidNote,
    familyFilter,
    largeFormula,
    showAllMarks,
    t,
  ]);
  const marksParentRef = useRef<HTMLDivElement>(null);
  const virtualizeMarks = marksResult.visible.length > FOCUS_LINE_CAP;
  const marksVirtualizer = useVirtualizer({
    count: virtualizeMarks ? marksResult.visible.length : 0,
    getScrollElement: () => marksParentRef.current,
    estimateSize: () => 72,
    overscan: 6,
  });

  function columnLabel(columnId: BatchColumnId) {
    const column = BATCH_COLUMNS.find((col) => col.id === columnId);
    if (!column) return columnId;
    if (column.timepoint) return slotLabel(column.timepoint);
    return t('evaluation.day', { day: column.day });
  }

  function MarkRow({ line }: { line: FormulaLine }) {
    const current = markForMaterial(
      lineMarks,
      line.materialId,
      line.id,
      dayOne ? activeTp : null,
      day,
    );
    return (
      <div className={styles.recipeRow}>
        <div className={styles.recipeCopy}>
          <strong>{line.materialName}</strong>
          <span className={styles.recipePct}>{Number(line.percent).toFixed(1)}%</span>
        </div>
        <div className={styles.marks} role="group" aria-label={line.materialName}>
          {EVALUATION_LINE_MARKS.map((mark) => (
            <button
              key={mark}
              type="button"
              className={`${styles.markBtn} ${current === mark ? `${styles.markBtnOn} ${MARK_ON[mark]}` : ''}`}
              aria-pressed={current === mark}
              onClick={() => toggleMark(line, mark)}
            >
              {t(`evaluation.${MARK_KEY[mark]}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          {formula.data ? (
            <>
              <p className={styles.pageKicker}>{t('evaluation.title')}</p>
              <h1 className={`fc-page-title ${styles.formulaTitle}`}>{formula.data.name}</h1>
              <p className={styles.formulaMeta}>
                {t('evaluation.formulaMeta', {
                  pct: Number.isFinite(concentrationPct) ? concentrationPct.toFixed(0) : '—',
                  juiceClass: juiceLabel,
                })}
              </p>
              <p className={`fc-muted ${styles.lede}`}>{t('evaluation.subtitle')}</p>
            </>
          ) : (
            <>
              <h1 className="fc-page-title">{t('evaluation.title')}</h1>
              <p className={`fc-muted ${styles.lede}`}>{t('evaluation.subtitle')}</p>
            </>
          )}
        </div>
        <div className={styles.headerActions}>
          {formulaId ? (
            <Link className={`fc-btn fc-btn--ghost ${styles.headerCta}`} to={workbenchTo}>
              {t('evaluation.adjustFormula')}
            </Link>
          ) : null}
          <FormulaSelector className={styles.headerSelector} />
        </div>
      </header>

      {!formulaRouteKey ? (
        <div className={`fc-card ${styles.empty}`}>
          <p>{t('evaluation.empty')}</p>
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.dayGroup}>
              <span className={styles.dayLabel}>{t('evaluation.macerationDay')}</span>
              <div className={styles.days}>
                {MACERATION_DAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${styles.dayChip} ${day === d ? styles.dayChipActive : ''}`}
                    data-testid={`maceration-day-${d}`}
                    onClick={() => selectDay(d)}
                  >
                    {t('evaluation.day', { day: d })}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {formulaId ? (
            <FormulaReminder formulaId={formulaId} formulaName={formula.data?.name ?? ''} />
          ) : null}

          {formulaId ? (
            <BatchBlotter
              formulaId={formulaId}
              lines={lines}
              sittings={heatmapSittings}
              activeColumn={activeColumn}
              onSelectColumn={selectBatchColumn}
              overallLabel={t('evaluation.overall')}
              columnLabel={columnLabel}
              markLabel={(mark) => t(`evaluation.${MARK_KEY[mark]}`)}
              unmarkedLabel={t('evaluation.unmarked')}
              emptyLabel={t('evaluation.recipeEmpty')}
              familyPowerAxis={t('evaluation.familyPowerAxis')}
              juiceLook={(juice) =>
                t('evaluation.juiceAppearance', {
                  clarity: clarityText(juice.clarity),
                  opal: opalText(juice.opalescence),
                  sol: solText(juice.solubility),
                })
              }
              familyNow={(family, now) => t('evaluation.familyNow', { family, now })}
              familyChangeUp={(family, delta) => t('evaluation.familyChangeUp', { family, delta })}
              familyChangeDown={(family, delta) =>
                t('evaluation.familyChangeDown', { family, delta })
              }
              familyChangeFlat={(family) => t('evaluation.familyChangeFlat', { family })}
              familyChangeNew={(family) => t('evaluation.familyChangeNew', { family })}
              vsPreviousColumn={(column) => t('evaluation.vsPreviousColumn', { column })}
              overallHint={t('evaluation.overallHint')}
              ratingLabel={t('evaluation.rating')}
              playLabel={t('evaluation.playEvolution')}
              pauseLabel={t('evaluation.pauseEvolution')}
              recipeLayerLabel={t('evaluation.recipeLayer')}
              firstLayerLabel={t('evaluation.firstLayer')}
              nowLayerLabel={t('evaluation.nowLayer')}
              query={lineQuery}
              onQuery={setLineQuery}
              pyramidNote={pyramidNote}
              onPyramidNote={setPyramidNote}
              familyFilter={familyFilter}
              onFamilyFilter={setFamilyFilter}
              familyLabel={(family) => family}
              otherFamilyLabel={t('evaluation.familyOther')}
              showAll={showAllBlotter}
              onShowAll={setShowAllBlotter}
              searchPlaceholder={t('evaluation.searchLines')}
              showingOf={(shown, matched) => t('evaluation.showingOf', { shown, matched })}
              showAllLabel={t('evaluation.showAll')}
              attentionLabel={t('evaluation.showAttention')}
              pyramidLabel={(note) => t(`evaluation.${PYRAMID_KEY[note] ?? 'noteTop'}`)}
            />
          ) : null}

          <div className={styles.columns}>
            <div className={`fc-card ${styles.editor}`}>
              {dayOne ? (
                <>
                  <div
                    className={styles.slots}
                    role="tablist"
                    aria-label={t('evaluation.evolution')}
                  >
                    {EVALUATION_TIMEPOINTS.map((tp) => {
                      const filled = Boolean(notes[tp.key].trim());
                      return (
                        <button
                          key={tp.key}
                          type="button"
                          role="tab"
                          aria-selected={activeTp === tp.key}
                          className={`${styles.slotChip} ${activeTp === tp.key ? styles.slotChipOn : ''} ${filled ? styles.slotFilled : ''}`}
                          onClick={() => setHours(tp.hours)}
                        >
                          {slotLabel(tp.key)}
                        </button>
                      );
                    })}
                  </div>
                  <label className={styles.field} htmlFor="sitting-note">
                    <span>{slotLabel(activeTp)}</span>
                    <textarea
                      id="sitting-note"
                      className={styles.textarea}
                      rows={8}
                      value={notes[activeTp]}
                      onChange={(e) => setNotes((n) => ({ ...n, [activeTp]: e.target.value }))}
                    />
                  </label>
                </>
              ) : (
                <label className={styles.field} htmlFor="sitting-note">
                  <span>{t('evaluation.dayNote', { day })}</span>
                  <textarea
                    id="sitting-note"
                    className={styles.textarea}
                    rows={8}
                    value={dayNote}
                    onChange={(e) => setDayNote(e.target.value)}
                  />
                </label>
              )}

              <h2 className={styles.sideTitle}>
                {t('evaluation.marksAt', {
                  label: dayOne ? slotLabel(activeTp) : t('evaluation.day', { day }),
                })}
              </h2>
              {lines.length === 0 ? (
                <p className={styles.playHint}>{t('evaluation.recipeEmpty')}</p>
              ) : (
                <>
                  {largeFormula ? (
                    <div className={styles.marksToolbar}>
                      <span className={styles.showing}>
                        {t('evaluation.showingOf', {
                          shown: marksResult.visible.length,
                          matched: marksResult.matched,
                        })}
                      </span>
                      <button
                        type="button"
                        className={`${styles.viewChip} ${!showAllMarks ? styles.viewChipOn : ''}`}
                        aria-pressed={!showAllMarks}
                        onClick={() => setShowAllMarks(false)}
                      >
                        {t('evaluation.focusUnmarked')}
                      </button>
                      <button
                        type="button"
                        className={`${styles.viewChip} ${showAllMarks ? styles.viewChipOn : ''}`}
                        aria-pressed={showAllMarks}
                        onClick={() => setShowAllMarks(true)}
                      >
                        {t('evaluation.showAll')}
                      </button>
                    </div>
                  ) : null}
                  {virtualizeMarks ? (
                    <div ref={marksParentRef} className={styles.recipeVirtual}>
                      <div
                        style={{
                          height: `${marksVirtualizer.getTotalSize()}px`,
                          position: 'relative',
                        }}
                      >
                        {marksVirtualizer.getVirtualItems().map((vRow) => {
                          const line = marksResult.visible[vRow.index];
                          if (!line) return null;
                          return (
                            <div
                              key={line.id ?? line.materialId}
                              className={styles.recipeVirtualRow}
                              style={{
                                height: `${vRow.size}px`,
                                transform: `translateY(${vRow.start}px)`,
                              }}
                            >
                              <MarkRow line={line} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.recipe}>
                      {marksResult.visible.map((line) => (
                        <MarkRow key={line.id ?? line.materialId} line={line} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {dayOne ? (
                <>
                  <h2 className={styles.sideTitle}>{t('evaluation.evolution')}</h2>
                  <EvolutionPlayhead hours={hours} maxHours={24} onChange={setHours} />
                  <p className={styles.playHint}>
                    {t('evaluation.highlighting', { label: slotLabel(activeTp) })}
                  </p>
                </>
              ) : null}
            </div>

            <div className={`fc-card ${styles.side}`}>
              <div>
                <h2 className={styles.sideTitle}>{t('evaluation.juiceDay', { day })}</h2>
                <p className={styles.juiceCardHint}>{t('evaluation.juiceHint')}</p>
                <div className={styles.rating} role="group" aria-label={t('evaluation.rating')}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.star} ${rating >= n ? styles.starOn : ''}`}
                      onClick={() => setRating(n)}
                      aria-pressed={rating >= n}
                      aria-label={t('evaluation.ratingAria', { rating: n })}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <p className={styles.ratingCaption}>{t('evaluation.ratingOutOf', { rating })}</p>
              </div>

              <h2 className={styles.sideTitle}>{t('evaluation.appearance')}</h2>
              <div className={styles.metaRow}>
                <label>
                  {t('evaluation.clarity')}
                  <FcSelect
                    options={[
                      { value: 'clear', label: t('evaluation.clarityClear') },
                      { value: 'haze', label: t('evaluation.clarityHaze') },
                      { value: 'cloudy', label: t('evaluation.clarityCloudy') },
                    ]}
                    value={clarity}
                    onChange={(v) => v && setClarity(v as Clarity)}
                    aria-label={t('evaluation.clarity')}
                  />
                </label>
                <label>
                  {t('evaluation.opalescence')}
                  <FcSelect
                    options={[
                      { value: 'none', label: t('evaluation.opalNone') },
                      { value: 'slight', label: t('evaluation.opalSlight') },
                      { value: 'strong', label: t('evaluation.opalStrong') },
                    ]}
                    value={opalescence}
                    onChange={(v) => v && setOpalescence(v as Opalescence)}
                    aria-label={t('evaluation.opalescence')}
                  />
                </label>
                <label>
                  {t('evaluation.solubility')}
                  <FcSelect
                    options={[
                      { value: 'complete', label: t('evaluation.solComplete') },
                      { value: 'partial', label: t('evaluation.solPartial') },
                      { value: 'phase-sep', label: t('evaluation.solPhaseSep') },
                    ]}
                    value={solubility}
                    onChange={(v) => v && setSolubility(v as Solubility)}
                    aria-label={t('evaluation.solubility')}
                  />
                </label>
              </div>

              <button
                type="button"
                className="fc-btn fc-btn--primary"
                disabled={save.isPending || !formulaId}
                onClick={() => {
                  const typed = (
                    document.getElementById('sitting-note') as HTMLTextAreaElement | null
                  )?.value;
                  const liveNotes =
                    dayOne && typed != null ? { ...notes, [activeTp]: typed } : notes;
                  setNotes(liveNotes);
                  save.mutate({
                    formulaId,
                    loadedId,
                    rating,
                    day,
                    dayOne,
                    notes: liveNotes,
                    dayNote: dayOne ? dayNote : (typed ?? dayNote),
                    clarity,
                    opalescence,
                    solubility,
                    lineMarks,
                  });
                }}
              >
                {save.isPending ? t('evaluation.saving') : t('evaluation.saveDay', { day })}
              </button>
              {savedFlash ? <p className="fc-muted">{t('evaluation.saved')}</p> : null}
            </div>
          </div>
        </>
      )}

      <section className={`fc-card ${styles.library}`} data-testid="evaluation-history">
        <h2 className={styles.sectionTitle}>{t('evaluation.history')}</h2>
        <p className={styles.compareHint}>{t('evaluation.compareHint')}</p>
        <div className={styles.libraryTools}>
          <input
            type="search"
            className={styles.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('evaluation.searchPlaceholder')}
          />
          <label className={styles.filterField}>
            {t('evaluation.filterDay')}
            <FcSelect
              options={[
                { value: '', label: t('evaluation.allDays') },
                ...MACERATION_DAYS.map((d) => ({
                  value: String(d),
                  label: t('evaluation.day', { day: d }),
                })),
              ]}
              value={dayFilter == null ? '' : String(dayFilter)}
              onChange={(v) => setDayFilter(v ? Number(v) : null)}
              aria-label={t('evaluation.filterDay')}
            />
          </label>
          <label className={styles.filterField}>
            {t('evaluation.minRating')}
            <FcSelect
              options={[1, 2, 3, 4, 5].map((n) => ({
                value: String(n),
                label: t('evaluation.minRatingOpt', { rating: n }),
              }))}
              value={String(minRating)}
              onChange={(v) => setMinRating(Number(v) || 1)}
              aria-label={t('evaluation.minRating')}
            />
          </label>
          <div className={styles.groupToggle}>
            <button
              type="button"
              className={groupBy === 'formula' ? styles.toggleOn : styles.toggleOff}
              onClick={() => setGroupBy('formula')}
            >
              {t('evaluation.groupByFormula')}
            </button>
            <button
              type="button"
              className={groupBy === 'time' ? styles.toggleOn : styles.toggleOff}
              onClick={() => setGroupBy('time')}
            >
              {t('evaluation.chronological')}
            </button>
          </div>
          <button
            type="button"
            className={onlyThisFormula ? styles.chipOn : styles.chipOff}
            onClick={() => setOnlyThisFormula((v) => !v)}
          >
            {t('evaluation.thisFormula')}
          </button>
        </div>

        {compareRows.length === 2 ? (
          <div className={styles.compare} data-testid="evaluation-compare">
            <div className={styles.compareHead}>
              <strong>{t('evaluation.comparing')}</strong>
              <button
                type="button"
                className="fc-btn fc-btn--ghost"
                onClick={() => setCompareIds([])}
              >
                {t('evaluation.compareClear')}
              </button>
            </div>
            <div className={styles.compareGrid}>
              {compareRows.map((ev) => (
                <div key={ev.id} className={styles.compareCol}>
                  <strong>{ev.formulaName}</strong>
                  <span className={styles.compareLine}>
                    {t('evaluation.day', { day: ev.macerationDay ?? '—' })}
                  </span>
                  <p className={styles.compareNotes}>{snippet(ev, t('evaluation.noNotes'))}</p>
                  <div className={styles.compareActions}>
                    <button
                      type="button"
                      className="fc-btn fc-btn--ghost"
                      onClick={() => openCheckpoint(ev)}
                    >
                      {t('evaluation.openInNotebook')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {library.isLoading ? <p className="fc-muted">{t('evaluation.loadingHistory')}</p> : null}
        {library.isError ? <p className="fc-muted">{t('evaluation.failed')}</p> : null}
        {!library.isLoading && filtered.length === 0 ? (
          <p className="fc-muted">
            {onlyThisFormula && formulaId && !hasAny
              ? t('evaluation.historyEmpty')
              : onlyThisFormula && formulaId && !allRows.some((row) => row.formulaId === formulaId)
                ? t('evaluation.historyEmpty')
                : !hasAny
                  ? t('evaluation.libraryEmpty')
                  : t('evaluation.noResults')}
          </p>
        ) : null}

        {groups ? (
          <div className={styles.groups}>
            {groups.map((group) => (
              <div key={group.formulaId} className={styles.group}>
                <div className={styles.groupHead}>
                  <strong>{group.formulaName}</strong>
                  <span className="fc-muted">{group.rows.length}</span>
                </div>
                <ul className={styles.libList}>{group.rows.map((ev) => renderRow(ev, false))}</ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className={styles.libList}>{filtered.map((ev) => renderRow(ev, true))}</ul>
        )}
      </section>
    </div>
  );
}
