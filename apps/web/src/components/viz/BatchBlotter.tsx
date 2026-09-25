import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  BATCH_COLUMNS,
  BLOTTER_PYRAMID_NOTES,
  FOCUS_LINE_CAP,
  columnFamilyPower,
  familyPowerDeltas,
  familyPowerToRadarAxes,
  familyPowerYMax,
  juiceAtColumn,
  previousBatchColumn,
  visibleBlotterLines,
  markAtColumn,
  type BatchColumnId,
  type EvaluationLineMark,
  type FamilyPowerDelta,
  type FamilyPowerSlice,
  type HeatmapSitting,
  type JuiceAtColumn,
  type MixPercentLine,
} from '@fc/shared';
import { familyHue } from '@/lib/formula-viz';
import { NotesRadar, type RadarOverlaySeries } from '@/components/viz/NotesRadar';
import styles from './BatchBlotter.module.css';

export type BlotterLine = {
  id?: string;
  materialId: string;
  materialName: string;
  pyramidNote?: string | null;
  olfactoryFamily?: string | null;
  percent?: string | number;
};

const MARK_CLASS: Record<EvaluationLineMark, string> = {
  ok: styles.cellOk ?? '',
  weak: styles.cellWeak ?? '',
  strong: styles.cellStrong ?? '',
  harsh: styles.cellHarsh ?? '',
};

const GRID_COLUMNS = `minmax(7.5rem, 11rem) repeat(${BATCH_COLUMNS.length}, minmax(2.75rem, 1fr))`;
const ROW_PX = 44;
const VIRTUAL_ROWS = 12;

function asMixLine(line: BlotterLine): MixPercentLine {
  const n = Number(line.percent);
  return {
    materialId: line.materialId,
    lineId: line.id,
    percent: Number.isFinite(n) ? n : 0,
    olfactoryFamily: line.olfactoryFamily,
  };
}

function roundPct(value: number): number {
  return Math.round(value);
}

function signedPct(value: number): string {
  const n = roundPct(value);
  if (n > 0) return `+${n}`;
  if (n < 0) return `-${Math.abs(n)}`;
  return '0';
}

function kpiTone(row: FamilyPowerDelta): 'up' | 'down' | 'flat' | 'new' {
  if (row.previous == null) return 'flat';
  if (row.deltaPct == null) return roundPct(row.now) > 0 ? 'new' : 'flat';
  const n = roundPct(row.deltaPct);
  if (n > 0) return 'up';
  if (n < 0) return 'down';
  return 'flat';
}

function deltaAttr(row: FamilyPowerDelta): string {
  const tone = kpiTone(row);
  if (row.previous == null) return '';
  if (tone === 'new') return 'new';
  if (row.deltaPct == null) return '0';
  return signedPct(row.deltaPct);
}

function formatFamilyKpi(
  row: FamilyPowerDelta,
  familyLabel: (family: string) => string,
  familyNow: (family: string, now: number) => string,
  familyChangeUp: (family: string, delta: string) => string,
  familyChangeDown: (family: string, delta: string) => string,
  familyChangeFlat: (family: string) => string,
  familyChangeNew: (family: string) => string,
): string {
  const name = familyLabel(row.family);
  const tone = kpiTone(row);
  if (row.previous == null) return familyNow(name, roundPct(row.now));
  if (tone === 'new') return familyChangeNew(name);
  if (tone === 'flat') return familyChangeFlat(name);
  const delta = signedPct(row.deltaPct ?? 0);
  return tone === 'up' ? familyChangeUp(name, delta) : familyChangeDown(name, delta);
}

function toneClass(tone: ReturnType<typeof kpiTone>): string {
  if (tone === 'up') return styles.kpiUp ?? '';
  if (tone === 'down') return styles.kpiDown ?? '';
  return styles.kpiFlat ?? '';
}

function sliceValues(
  slices: FamilyPowerSlice[],
  mode: 'recipe' | 'judged',
): Record<string, number> {
  return Object.fromEntries(
    familyPowerToRadarAxes(slices, mode).map((axis) => [axis.id, axis.value]),
  );
}

function JuicePip({
  juice,
  look,
  ratingLabel,
}: {
  juice: JuiceAtColumn;
  look: string;
  ratingLabel: string;
}) {
  const fill = 'var(--fc-accent)';
  const title = `${ratingLabel} ${juice.rating}/5 · ${look}`;
  if (juice.clarity === 'haze') {
    return (
      <span className={styles.pip} title={title}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <polygon points="6,1 11,6 6,11 1,6" fill={fill} />
        </svg>
        {juice.rating}
      </span>
    );
  }
  if (juice.clarity === 'cloudy') {
    return (
      <span className={styles.pip} title={title}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <rect x="2" y="2" width="8" height="8" rx="1" fill={fill} />
        </svg>
        {juice.rating}
      </span>
    );
  }
  return (
    <span className={styles.pip} title={title}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4" fill={fill} />
      </svg>
      {juice.rating}
    </span>
  );
}

export function BatchBlotter({
  formulaId,
  lines,
  sittings,
  activeColumn,
  onSelectColumn,
  overallLabel,
  columnLabel,
  markLabel,
  unmarkedLabel,
  emptyLabel,
  familyPowerAxis,
  juiceLook,
  familyNow,
  familyChangeUp,
  familyChangeDown,
  familyChangeFlat,
  familyChangeNew,
  vsPreviousColumn,
  overallHint,
  ratingLabel,
  playLabel,
  pauseLabel,
  recipeLayerLabel,
  firstLayerLabel,
  nowLayerLabel,
  query,
  onQuery,
  pyramidNote,
  onPyramidNote,
  familyFilter,
  onFamilyFilter,
  familyLabel,
  otherFamilyLabel,
  showAll,
  onShowAll,
  searchPlaceholder,
  showingOf,
  showAllLabel,
  attentionLabel,
  pyramidLabel,
}: {
  formulaId: string;
  lines: BlotterLine[];
  sittings: HeatmapSitting[];
  activeColumn: BatchColumnId;
  onSelectColumn: (columnId: BatchColumnId) => void;
  overallLabel: string;
  columnLabel: (columnId: BatchColumnId) => string;
  markLabel: (mark: EvaluationLineMark) => string;
  unmarkedLabel: string;
  emptyLabel: string;
  familyPowerAxis: string;
  juiceLook: (juice: JuiceAtColumn) => string;
  familyNow: (family: string, now: number) => string;
  familyChangeUp: (family: string, delta: string) => string;
  familyChangeDown: (family: string, delta: string) => string;
  familyChangeFlat: (family: string) => string;
  familyChangeNew: (family: string) => string;
  vsPreviousColumn: (column: string) => string;
  overallHint: string;
  ratingLabel: string;
  playLabel: string;
  pauseLabel: string;
  recipeLayerLabel: string;
  firstLayerLabel: string;
  nowLayerLabel: string;
  query: string;
  onQuery: (value: string) => void;
  pyramidNote: string | null;
  onPyramidNote: (value: string | null) => void;
  familyFilter: string | null;
  onFamilyFilter: (value: string | null) => void;
  familyLabel: (family: string) => string;
  otherFamilyLabel: string;
  showAll: boolean;
  onShowAll: (value: boolean) => void;
  searchPlaceholder: string;
  showingOf: (shown: number, matched: number) => string;
  showAllLabel: string;
  attentionLabel: string;
  pyramidLabel: (note: string) => string;
}) {
  const mixLines = useMemo(() => lines.map(asMixLine), [lines]);
  const total = lines.length;
  const large = total > FOCUS_LINE_CAP;
  const columns = useMemo(() => {
    const powerById = new Map(
      BATCH_COLUMNS.map((col) => [
        col.id,
        columnFamilyPower(sittings, formulaId, mixLines, col.id, {
          otherLabel: otherFamilyLabel,
        }),
      ]),
    );
    return BATCH_COLUMNS.map((col) => {
      const families = powerById.get(col.id) ?? [];
      const previousId = previousBatchColumn(col.id);
      const previous = previousId ? (powerById.get(previousId) ?? null) : null;
      return {
        id: col.id,
        families,
        deltas: familyPowerDeltas(families, previous),
        previousId,
        juice: juiceAtColumn(sittings, formulaId, col.id),
        totalPower: families.reduce((sum, slice) => sum + slice.power, 0),
      };
    });
  }, [sittings, formulaId, mixLines, otherFamilyLabel]);
  const markedIndexes = columns
    .map((row, index) => (row.totalPower >= 0.5 ? index : -1))
    .filter((index) => index >= 0);
  const playFrom = markedIndexes[0] ?? 0;
  const playTo = markedIndexes[markedIndexes.length - 1] ?? 0;
  const canPlay = markedIndexes.length > 1;
  const [playing, setPlaying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const onSelectRef = useRef(onSelectColumn);
  onSelectRef.current = onSelectColumn;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!playing || !canPlay) return;
    const timer = window.setInterval(() => {
      const idx = BATCH_COLUMNS.findIndex((col) => col.id === activeColumn);
      const next = idx < playFrom || idx >= playTo ? playFrom : idx + 1;
      const column = BATCH_COLUMNS[next];
      if (column) onSelectRef.current(column.id);
      if (next >= playTo) setPlaying(false);
    }, 800);
    return () => window.clearInterval(timer);
  }, [playing, canPlay, playFrom, playTo, activeColumn]);

  const activeRow = columns.find((row) => row.id === activeColumn) ?? columns[0];
  const firstRow = columns[playFrom] ?? activeRow;
  const recipeValues = sliceValues(activeRow?.families ?? [], 'recipe');
  const nowValues = sliceValues(activeRow?.families ?? [], 'judged');
  const firstValues = sliceValues(firstRow?.families ?? [], 'judged');
  const heroAxes = familyPowerToRadarAxes(activeRow?.families ?? [], 'judged').map((axis) => ({
    ...axis,
    label: familyLabel(axis.id),
  }));
  const overlay: RadarOverlaySeries[] = [
    {
      id: 'recipe',
      label: recipeLayerLabel,
      values: recipeValues,
      stroke: 'var(--fc-text-muted)',
      fill: 'var(--fc-text-muted)',
      fillOpacity: 0.05,
      strokeDasharray: '4 4',
      strokeWidth: 1.5,
    },
  ];
  if (firstRow && firstRow.id !== activeRow?.id) {
    overlay.push({
      id: 'first',
      label: firstLayerLabel,
      values: firstValues,
      stroke: 'var(--fc-accent-soft)',
      fill: 'var(--fc-accent-soft)',
      fillOpacity: 0.1,
      strokeWidth: 1.5,
    });
  }
  overlay.push({
    id: 'now',
    label: nowLayerLabel,
    values: nowValues,
    stroke: 'var(--fc-accent)',
    fill: 'var(--fc-accent)',
    fillOpacity: 0.32,
    strokeWidth: 2.5,
  });
  const radarMax = familyPowerYMax([
    ...columns.flatMap((row) => row.families.map((slice) => slice.power)),
    ...Object.values(recipeValues),
  ]);
  const characterSummary = columns
    .map((row) => {
      const judged = row.deltas.map((delta) =>
        formatFamilyKpi(
          delta,
          familyLabel,
          familyNow,
          familyChangeUp,
          familyChangeDown,
          familyChangeFlat,
          familyChangeNew,
        ),
      );
      const vs = row.previousId ? ` ${vsPreviousColumn(columnLabel(row.previousId))}` : '';
      return `${columnLabel(row.id)}: ${judged.join(', ') || unmarkedLabel}${vs}`;
    })
    .join('. ');

  const blotterMode = !large || showAll ? 'all' : 'attention';
  const { visible, matched } = visibleBlotterLines(lines, sittings, formulaId, activeColumn, {
    query,
    pyramidNote,
    family: familyFilter,
    otherLabel: otherFamilyLabel,
    mode: blotterMode,
    cap: blotterMode === 'all' ? null : FOCUS_LINE_CAP,
  });
  const virtualize = visible.length > FOCUS_LINE_CAP;
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: virtualize ? visible.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_PX,
    overscan: 8,
  });
  const activeIndex = Math.max(
    0,
    BATCH_COLUMNS.findIndex((col) => col.id === activeColumn),
  );

  return (
    <section
      className={`fc-card ${styles.wrap}`}
      aria-label={overallLabel}
      data-testid="batch-blotter"
    >
      <h2 className={styles.title}>{overallLabel}</h2>
      <p className={styles.hint}>{overallHint}</p>
      <div data-testid="batch-hero-kpis">
        <ul className={styles.legend} aria-label={familyPowerAxis} data-testid="batch-family-kpis">
          {(activeRow?.deltas ?? []).map((row) => {
            const tone = kpiTone(row);
            return (
              <li key={row.family} className={styles.legendItem}>
                <button
                  type="button"
                  className={`${styles.legendBtn} ${familyFilter === row.family ? styles.legendBtnOn : ''}`}
                  aria-pressed={familyFilter === row.family}
                  data-family={row.family}
                  data-delta={deltaAttr(row)}
                  onClick={() => onFamilyFilter(familyFilter === row.family ? null : row.family)}
                >
                  <span className={styles.swatch} style={{ background: familyHue(row.family) }} />
                  <span className={styles.legendName}>{familyLabel(row.family)}</span>
                  <span className={toneClass(tone)}>
                    {changeToken(row, familyLabel, familyChangeNew)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {activeRow?.previousId ? (
          <p className={styles.vsPrevious}>{vsPreviousColumn(columnLabel(activeRow.previousId))}</p>
        ) : null}
      </div>
      <p className="fc-sr-only">{characterSummary}</p>
      {lines.length === 0 ? <p className={styles.empty}>{emptyLabel}</p> : null}
      {lines.length > 0 ? (
        <div className={styles.stage}>
          <div className={styles.hero}>
            <div
              className={styles.heroChart}
              data-testid="batch-family-radar"
              aria-label={familyPowerAxis}
            >
              <NotesRadar
                axes={heroAxes}
                series={overlay}
                showLegend={false}
                animate={!reduceMotion}
                valueMax={radarMax}
                emptyLabel={emptyLabel}
              />
            </div>
            <ul className={styles.layers} aria-label={familyPowerAxis}>
              <li>
                <span className={`${styles.layerSwatch} ${styles.layerRecipe}`} />
                {recipeLayerLabel}
              </li>
              {firstRow && firstRow.id !== activeRow?.id ? (
                <li>
                  <span className={`${styles.layerSwatch} ${styles.layerFirst}`} />
                  {firstLayerLabel}
                </li>
              ) : null}
              <li>
                <span className={`${styles.layerSwatch} ${styles.layerNow}`} />
                {nowLayerLabel}
              </li>
            </ul>
            <div className={styles.transport}>
              <button
                type="button"
                className={styles.play}
                aria-pressed={playing}
                disabled={!canPlay}
                onClick={() => setPlaying((on) => !on)}
              >
                {playing ? pauseLabel : playLabel}
              </button>
              <label className={styles.sliderLabel}>
                <span className="fc-sr-only">{columnLabel(activeColumn)}</span>
                <input
                  className={styles.slider}
                  type="range"
                  min={0}
                  max={BATCH_COLUMNS.length - 1}
                  step={1}
                  value={activeIndex}
                  onChange={(e) => {
                    setPlaying(false);
                    const column = BATCH_COLUMNS[Number(e.target.value)];
                    if (column) onSelectColumn(column.id);
                  }}
                />
              </label>
              <span className={styles.sliderNow}>{columnLabel(activeColumn)}</span>
            </div>
          </div>
          <div className={styles.scroller}>
            <div className={styles.minis} style={{ gridTemplateColumns: GRID_COLUMNS }}>
              <span className={styles.axisName}>{familyPowerAxis}</span>
              {columns.map((row) => (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={`${styles.mini} ${activeColumn === row.id ? styles.miniOn : ''}`}
                  data-testid="batch-family-mini"
                  data-column={row.id}
                  aria-pressed={activeColumn === row.id}
                  aria-label={`${columnLabel(row.id)}. ${
                    row.deltas
                      .map((delta) =>
                        formatFamilyKpi(
                          delta,
                          familyLabel,
                          familyNow,
                          familyChangeUp,
                          familyChangeDown,
                          familyChangeFlat,
                          familyChangeNew,
                        ),
                      )
                      .join(', ') || unmarkedLabel
                  }${row.previousId ? ` ${vsPreviousColumn(columnLabel(row.previousId))}` : ''}`}
                  onClick={() => {
                    setPlaying(false);
                    onSelectColumn(row.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    setPlaying(false);
                    onSelectColumn(row.id);
                  }}
                >
                  <NotesRadar
                    axes={familyPowerToRadarAxes(row.families, 'judged')}
                    mini
                    hideLabels
                    showLegend={false}
                    animate={false}
                    valueMax={radarMax}
                    emptyLabel={unmarkedLabel}
                  />
                  <span className={styles.miniLabel}>{columnLabel(row.id)}</span>
                  {row.juice ? (
                    <JuicePip
                      juice={row.juice}
                      look={juiceLook(row.juice)}
                      ratingLabel={ratingLabel}
                    />
                  ) : (
                    <span className={styles.pipEmpty} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            {large ? (
              <div className={styles.toolbar}>
                <label className={styles.searchLabel}>
                  <span className="fc-sr-only">{searchPlaceholder}</span>
                  <input
                    className={styles.search}
                    type="search"
                    value={query}
                    placeholder={searchPlaceholder}
                    onChange={(e) => onQuery(e.target.value)}
                  />
                </label>
                <div className={styles.chips} role="group">
                  {BLOTTER_PYRAMID_NOTES.map((note) => (
                    <button
                      key={note}
                      type="button"
                      className={`${styles.chip} ${pyramidNote === note ? styles.chipOn : ''}`}
                      aria-pressed={pyramidNote === note}
                      onClick={() => onPyramidNote(pyramidNote === note ? null : note)}
                    >
                      {pyramidLabel(note)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`${styles.chip} ${showAll ? styles.chipOn : ''}`}
                  aria-pressed={showAll}
                  onClick={() => onShowAll(!showAll)}
                >
                  {showAll ? attentionLabel : showAllLabel}
                </button>
                <span className={styles.showing}>{showingOf(visible.length, matched)}</span>
              </div>
            ) : null}
            <div
              className={styles.grid}
              style={{ gridTemplateColumns: GRID_COLUMNS }}
              role="grid"
              aria-label={overallLabel}
              data-visible-count={visible.length}
            >
              <div className={`${styles.head} ${styles.material}`} role="columnheader">
                {'\u00a0'}
              </div>
              {BATCH_COLUMNS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  role="columnheader"
                  className={`${styles.headBtn} ${activeColumn === col.id ? styles.headOn : ''}`}
                  onClick={() => onSelectColumn(col.id)}
                >
                  {columnLabel(col.id)}
                </button>
              ))}
              {virtualize
                ? null
                : visible.map((line) => (
                    <BlotterRow
                      key={line.id ?? line.materialId}
                      line={line}
                      formulaId={formulaId}
                      sittings={sittings}
                      activeColumn={activeColumn}
                      onSelectColumn={onSelectColumn}
                      columnLabel={columnLabel}
                      markLabel={markLabel}
                      unmarkedLabel={unmarkedLabel}
                    />
                  ))}
            </div>
            {virtualize ? (
              <div
                ref={parentRef}
                className={styles.virtualBody}
                style={{ height: `${VIRTUAL_ROWS * ROW_PX}px` }}
              >
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                  {virtualizer.getVirtualItems().map((vRow) => {
                    const line = visible[vRow.index];
                    if (!line) return null;
                    return (
                      <div
                        key={line.id ?? line.materialId}
                        className={styles.virtualRow}
                        style={{
                          height: `${vRow.size}px`,
                          transform: `translateY(${vRow.start}px)`,
                          gridTemplateColumns: GRID_COLUMNS,
                        }}
                      >
                        <BlotterRow
                          line={line}
                          formulaId={formulaId}
                          sittings={sittings}
                          activeColumn={activeColumn}
                          onSelectColumn={onSelectColumn}
                          columnLabel={columnLabel}
                          markLabel={markLabel}
                          unmarkedLabel={unmarkedLabel}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BlotterRow({
  line,
  formulaId,
  sittings,
  activeColumn,
  onSelectColumn,
  columnLabel,
  markLabel,
  unmarkedLabel,
}: {
  line: BlotterLine;
  formulaId: string;
  sittings: HeatmapSitting[];
  activeColumn: BatchColumnId;
  onSelectColumn: (columnId: BatchColumnId) => void;
  columnLabel: (columnId: BatchColumnId) => string;
  markLabel: (mark: EvaluationLineMark) => string;
  unmarkedLabel: string;
}) {
  return (
    <>
      <div className={styles.material} role="rowheader">
        {line.materialName}
      </div>
      {BATCH_COLUMNS.map((col) => {
        const mark = markAtColumn(sittings, formulaId, line.materialId, col.id, line.id);
        const label = mark
          ? `${line.materialName} · ${columnLabel(col.id)} · ${markLabel(mark)}`
          : `${line.materialName} · ${columnLabel(col.id)} · ${unmarkedLabel}`;
        return (
          <button
            key={col.id}
            type="button"
            className={`${styles.cell} ${mark ? MARK_CLASS[mark] : ''} ${activeColumn === col.id ? styles.cellOn : ''}`}
            data-testid="batch-cell"
            data-column={col.id}
            data-mark={mark ?? ''}
            aria-label={label}
            aria-pressed={activeColumn === col.id}
            onClick={() => onSelectColumn(col.id)}
          />
        );
      })}
    </>
  );
}

function changeLabel(row: FamilyPowerDelta): string {
  const tone = kpiTone(row);
  if (row.previous == null) return '';
  if (tone === 'new') return '';
  if (tone === 'flat') return '0%';
  return `${signedPct(row.deltaPct ?? 0)}%`;
}

function changeToken(
  row: FamilyPowerDelta,
  familyLabel: (family: string) => string,
  familyChangeNew: (family: string) => string,
): string {
  const tone = kpiTone(row);
  if (row.previous == null) return String(roundPct(row.now));
  if (tone === 'new')
    return familyChangeNew(familyLabel(row.family)).replace(familyLabel(row.family), '').trim();
  return changeLabel(row);
}
