import { z } from 'zod';

export const EVALUATION_LINE_MARKS = ['ok', 'weak', 'strong', 'harsh'] as const;
export type EvaluationLineMark = (typeof EVALUATION_LINE_MARKS)[number];

/** Day 1 × ~300 lines × 4 intervals, with headroom for one sitting. */
export const EVALUATION_LINE_MARKS_MAX = 2000;

/** Show every blotter row below this; above it, attention / unmarked first. */
export const FOCUS_LINE_CAP = 18;

/** Use a 0…N Y domain when the formula is this small; otherwise scale to marked. */
export const MIX_Y_FULL_CAP = 24;

export const BLOTTER_PYRAMID_NOTES = ['top', 'middle', 'base', 'modifier'] as const;
export type BlotterPyramidNote = (typeof BLOTTER_PYRAMID_NOTES)[number];
export type BlotterFocusMode = 'attention' | 'unmarked' | 'all';

export const EVALUATION_TIMEPOINTS = [
  { key: 't0Notes', label: 'T+0', hours: 0 },
  { key: 't30mNotes', label: 'T+30 min', hours: 0.5 },
  { key: 't4hNotes', label: 'T+4 h', hours: 4 },
  { key: 't24hNotes', label: 'T+24 h', hours: 24 },
] as const;

export type EvaluationTimepointKey = (typeof EVALUATION_TIMEPOINTS)[number]['key'];

export const MACERATION_DAYS = [1, 7, 14, 30] as const;
export type MacerationDay = (typeof MACERATION_DAYS)[number];

export const evaluationLineMarkSchema = z.object({
  lineId: z.string().uuid().optional(),
  materialId: z.string().uuid(),
  mark: z.enum(EVALUATION_LINE_MARKS),
  timepoint: z.enum(['t0Notes', 't30mNotes', 't4hNotes', 't24hNotes']).optional(),
});

export type EvaluationLineMarkRow = z.infer<typeof evaluationLineMarkSchema>;

const organolepticFields = {
  notes: z.string().trim().max(8000).optional(),
  macerationDay: z.coerce.number().int().min(0).max(365).optional(),
  t0Notes: z.string().trim().max(4000).optional(),
  t30mNotes: z.string().trim().max(4000).optional(),
  t4hNotes: z.string().trim().max(4000).optional(),
  t24hNotes: z.string().trim().max(4000).optional(),
  clarity: z.enum(['clear', 'haze', 'cloudy']).optional(),
  opalescence: z.enum(['none', 'slight', 'strong']).optional(),
  solubility: z.enum(['complete', 'partial', 'phase-sep']).optional(),
  lineMarks: z.array(evaluationLineMarkSchema).max(EVALUATION_LINE_MARKS_MAX).optional(),
};

export const createEvaluationBodySchema = z.object({
  formulaId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  ...organolepticFields,
});

export const updateEvaluationBodySchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    ...organolepticFields,
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Empty patch' });

export const listEvaluationsQuerySchema = z.object({
  formulaId: z.string().uuid().optional(),
});

export type CreateEvaluationBody = z.infer<typeof createEvaluationBodySchema>;
export type UpdateEvaluationBody = z.infer<typeof updateEvaluationBodySchema>;
export type ListEvaluationsQuery = z.infer<typeof listEvaluationsQuerySchema>;

export type SittingNotes = {
  notes?: string | null;
  t0Notes?: string | null;
  t30mNotes?: string | null;
  t4hNotes?: string | null;
  t24hNotes?: string | null;
};

export function isDayOne(day: number | null | undefined): boolean {
  return !day || day <= 1;
}

export type BatchColumnId = EvaluationTimepointKey | 'day7' | 'day14' | 'day30';

export const BATCH_COLUMNS: ReadonlyArray<{
  id: BatchColumnId;
  kind: 'slot' | 'day';
  day: number;
  timepoint?: EvaluationTimepointKey;
}> = [
  { id: 't0Notes', kind: 'slot', day: 1, timepoint: 't0Notes' },
  { id: 't30mNotes', kind: 'slot', day: 1, timepoint: 't30mNotes' },
  { id: 't4hNotes', kind: 'slot', day: 1, timepoint: 't4hNotes' },
  { id: 't24hNotes', kind: 'slot', day: 1, timepoint: 't24hNotes' },
  { id: 'day7', kind: 'day', day: 7 },
  { id: 'day14', kind: 'day', day: 14 },
  { id: 'day30', kind: 'day', day: 30 },
];

/** Nearest organoleptic slot for a playhead position in hours. */
export function slotForHours(hours: number): EvaluationTimepointKey {
  let best: (typeof EVALUATION_TIMEPOINTS)[number] = EVALUATION_TIMEPOINTS[0];
  for (const tp of EVALUATION_TIMEPOINTS) {
    if (Math.abs(tp.hours - hours) <= Math.abs(best.hours - hours)) best = tp;
  }
  return best.key;
}

export function hoursForSlot(key: EvaluationTimepointKey): number {
  return EVALUATION_TIMEPOINTS.find((tp) => tp.key === key)?.hours ?? 0;
}

export function joinEvaluationNotes(notes: SittingNotes, day?: number | null): string {
  if (!isDayOne(day) && hasText(notes.notes)) {
    return notes.notes!.trim().slice(0, 8000);
  }
  return [notes.t0Notes, notes.t30mNotes, notes.t4hNotes, notes.t24hNotes]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join('\n---\n')
    .slice(0, 8000);
}

/** Inverse of joinEvaluationNotes for day-1 slot fields packed into `notes`. */
export function splitEvaluationNotes(joined: string | null | undefined): {
  t0Notes?: string;
  t30mNotes?: string;
  t4hNotes?: string;
  t24hNotes?: string;
} {
  if (!joined?.includes('\n---\n')) return {};
  const parts = joined.split('\n---\n');
  const keys = ['t0Notes', 't30mNotes', 't4hNotes', 't24hNotes'] as const;
  const next: { t0Notes?: string; t30mNotes?: string; t4hNotes?: string; t24hNotes?: string } = {};
  keys.forEach((key, index) => {
    const value = parts[index]?.trim();
    if (value) next[key] = value;
  });
  return next;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function nextEmptySlot(
  notes: SittingNotes,
  day?: number | null,
): EvaluationTimepointKey | null {
  if (!isDayOne(day)) return null;
  for (const tp of EVALUATION_TIMEPOINTS) {
    if (!hasText(notes[tp.key])) return tp.key;
  }
  return null;
}

export function sittingSlotCount(
  notes: SittingNotes,
  day?: number | null,
): { filled: number; total: number } {
  if (!isDayOne(day)) {
    return { filled: hasText(notes.notes) || hasText(notes.t0Notes) ? 1 : 0, total: 1 };
  }
  const filled = EVALUATION_TIMEPOINTS.filter((tp) => hasText(notes[tp.key])).length;
  return { filled, total: EVALUATION_TIMEPOINTS.length };
}

export function nextMacerationDay(day: number | null | undefined): MacerationDay | null {
  const current = day && day > 0 ? day : 1;
  const idx = MACERATION_DAYS.findIndex((d) => d === current);
  if (idx < 0) return MACERATION_DAYS[0];
  return MACERATION_DAYS[idx + 1] ?? null;
}

export type SittingIdentity = {
  id: string;
  formulaId: string;
  macerationDay: number | null;
  createdAt?: string | Date;
};

/** Most recent sitting for a formula + maceration day. Rows are assumed newest-first. */
export function resolveSittingId(
  rows: readonly SittingIdentity[],
  formulaId: string,
  macerationDay: number,
): string | null {
  const found = rows.find(
    (row) => row.formulaId === formulaId && (row.macerationDay ?? 0) === macerationDay,
  );
  return found?.id ?? null;
}

export type OpenSitting = {
  id: string;
  macerationDay: number;
  nextSlot: EvaluationTimepointKey | null;
  complete: boolean;
  nextDay: MacerationDay | null;
};

export function describeOpenSitting(
  row: (SittingNotes & { id: string; macerationDay: number | null }) | null | undefined,
): OpenSitting | null {
  if (!row) return null;
  const day = row.macerationDay && row.macerationDay > 0 ? row.macerationDay : 1;
  if (!isDayOne(day)) {
    const complete = hasText(row.notes) || hasText(row.t0Notes);
    return {
      id: row.id,
      macerationDay: day,
      nextSlot: null,
      complete,
      nextDay: complete ? nextMacerationDay(day) : null,
    };
  }
  const nextSlot = nextEmptySlot(row, day);
  return {
    id: row.id,
    macerationDay: day,
    nextSlot,
    complete: nextSlot == null,
    nextDay: nextSlot == null ? nextMacerationDay(day) : null,
  };
}

function rowsForMaterial(
  marks: readonly EvaluationLineMarkRow[],
  materialId: string,
  lineId?: string | null,
): EvaluationLineMarkRow[] {
  if (lineId) {
    const byLine = marks.filter((row) => row.lineId === lineId);
    if (byLine.length) return byLine;
  }
  return marks.filter((row) => row.materialId === materialId);
}

function sameLine(row: EvaluationLineMarkRow, materialId: string, lineId?: string | null): boolean {
  if (lineId && row.lineId) return row.lineId === lineId;
  return row.materialId === materialId;
}

/** Unscoped historical marks read as T+0 on day 1, and as the day mark otherwise. */
export function effectiveMarkTimepoint(
  row: EvaluationLineMarkRow,
  sittingDay: number | null | undefined,
): EvaluationTimepointKey | null {
  if (row.timepoint) return row.timepoint;
  return isDayOne(sittingDay) ? 't0Notes' : null;
}

export function markForMaterial(
  marks: readonly EvaluationLineMarkRow[] | null | undefined,
  materialId: string,
  lineId?: string | null,
  timepoint?: EvaluationTimepointKey | null,
  sittingDay?: number | null,
): EvaluationLineMark | null {
  if (!marks?.length) return null;
  const matches = rowsForMaterial(marks, materialId, lineId);
  if (!matches.length) return null;
  if (timepoint) {
    return (
      matches.find((row) => effectiveMarkTimepoint(row, sittingDay ?? 1) === timepoint)?.mark ??
      null
    );
  }
  if (!isDayOne(sittingDay)) {
    return matches.find((row) => effectiveMarkTimepoint(row, sittingDay) == null)?.mark ?? null;
  }
  return matches[0]?.mark ?? null;
}

export function toggleLineMark(
  marks: readonly EvaluationLineMarkRow[],
  line: { id?: string; materialId: string },
  mark: EvaluationLineMark,
  sittingDay: number,
  timepoint?: EvaluationTimepointKey | null,
): EvaluationLineMarkRow[] {
  const current = markForMaterial(marks, line.materialId, line.id, timepoint ?? null, sittingDay);
  const next: EvaluationLineMarkRow = {
    materialId: line.materialId,
    mark,
    ...(line.id ? { lineId: line.id } : {}),
    ...(timepoint ? { timepoint } : {}),
  };
  const rest = marks.filter((row) => {
    if (!sameLine(row, line.materialId, line.id)) return true;
    return effectiveMarkTimepoint(row, sittingDay) !== effectiveMarkTimepoint(next, sittingDay);
  });
  if (current === mark) return rest;
  return [...rest, next];
}

const SLOT_ORDER: EvaluationTimepointKey[] = ['t24hNotes', 't4hNotes', 't30mNotes', 't0Notes'];

export function latestProbeMark(
  sittings: readonly {
    id?: string;
    macerationDay?: number | null;
    lineMarks?: EvaluationLineMarkRow[] | null;
  }[],
  materialId: string,
  lineId?: string | null,
  preferredSittingId?: string | null,
): EvaluationLineMark | null {
  const ordered = preferredSittingId
    ? [
        ...sittings.filter((row) => row.id === preferredSittingId),
        ...sittings.filter((row) => row.id !== preferredSittingId),
      ]
    : sittings;
  for (const sitting of ordered) {
    const marks = sitting.lineMarks ?? [];
    const day = sitting.macerationDay;
    if (isDayOne(day)) {
      for (const slot of SLOT_ORDER) {
        const found = markForMaterial(marks, materialId, lineId, slot, 1);
        if (found) return found;
      }
    } else {
      const found = markForMaterial(marks, materialId, lineId, null, day);
      if (found) return found;
    }
  }
  return null;
}

export type HeatmapSitting = {
  id: string;
  formulaId: string;
  macerationDay: number | null;
  rating: number;
  lineMarks?: EvaluationLineMarkRow[] | null;
  clarity?: string | null;
  opalescence?: string | null;
  solubility?: string | null;
};

/** Day-1 T+24 and later maceration days — juice is sitting-level, not per blotter hour. */
export const JUICE_COLUMNS: readonly BatchColumnId[] = ['t24hNotes', 'day7', 'day14', 'day30'];

export function isJuiceColumn(columnId: BatchColumnId): boolean {
  return (JUICE_COLUMNS as readonly string[]).includes(columnId);
}

export type JuiceAtColumn = {
  columnId: BatchColumnId;
  sittingId: string;
  rating: number;
  clarity: string | null;
  opalescence: string | null;
  solubility: string | null;
};

export function juiceAtColumn(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  columnId: BatchColumnId,
): JuiceAtColumn | null {
  if (!isJuiceColumn(columnId)) return null;
  const column = BATCH_COLUMNS.find((col) => col.id === columnId);
  if (!column) return null;
  const sitting = sittingForDay(sittings, formulaId, column.day);
  if (!sitting) return null;
  return {
    columnId,
    sittingId: sitting.id,
    rating: sitting.rating,
    clarity: sitting.clarity ?? null,
    opalescence: sitting.opalescence ?? null,
    solubility: sitting.solubility ?? null,
  };
}

export function sittingForDay(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  day: number,
): HeatmapSitting | undefined {
  return sittings.find((row) => row.formulaId === formulaId && (row.macerationDay ?? 0) === day);
}

export function markAtColumn(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  materialId: string,
  columnId: BatchColumnId,
  lineId?: string | null,
): EvaluationLineMark | null {
  const column = BATCH_COLUMNS.find((col) => col.id === columnId);
  if (!column) return null;
  const sitting = sittingForDay(sittings, formulaId, column.day);
  if (!sitting) return null;
  return markForMaterial(
    sitting.lineMarks,
    materialId,
    lineId,
    column.timepoint ?? null,
    sitting.macerationDay,
  );
}

export function ratingSparkline(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
): Array<{ columnId: BatchColumnId; rating: number; sittingId: string }> {
  const day1 = sittingForDay(sittings, formulaId, 1);
  const points: Array<{ columnId: BatchColumnId; rating: number; sittingId: string }> = [];
  if (day1 && day1.rating >= 1)
    points.push({ columnId: 't24hNotes', rating: day1.rating, sittingId: day1.id });
  for (const day of [7, 14, 30] as const) {
    const sitting = sittingForDay(sittings, formulaId, day);
    if (sitting && sitting.rating >= 1) {
      points.push({
        columnId: day === 7 ? 'day7' : day === 14 ? 'day14' : 'day30',
        rating: sitting.rating,
        sittingId: sitting.id,
      });
    }
  }
  return points;
}

/** How many formula lines already carry a mark in this blotter column. */
export function columnMarkCoverage(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  materials: readonly { materialId: string; lineId?: string }[],
  columnId: BatchColumnId,
): { marked: number; total: number } {
  const mix = columnMarkMix(sittings, formulaId, materials, columnId);
  return { marked: mix.marked, total: mix.total };
}

export type ColumnMarkMix = {
  ok: number;
  weak: number;
  strong: number;
  harsh: number;
  marked: number;
  total: number;
};

/** Coverage plus Ok/Weak/Strong/Harsh counts for one blotter column. */
export function columnMarkMix(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  materials: readonly { materialId: string; lineId?: string }[],
  columnId: BatchColumnId,
): ColumnMarkMix {
  const mix: ColumnMarkMix = {
    ok: 0,
    weak: 0,
    strong: 0,
    harsh: 0,
    marked: 0,
    total: materials.length,
  };
  for (const material of materials) {
    const mark = markAtColumn(sittings, formulaId, material.materialId, columnId, material.lineId);
    if (!mark) continue;
    mix[mark] += 1;
    mix.marked += 1;
  }
  return mix;
}

export const DEFAULT_OLFACTORY_FAMILY = 'Special';
export const OTHER_FAMILY_LABEL = 'Other';
export const FAMILY_AXIS_CAP = 8;

export type MixPercentLine = {
  materialId: string;
  lineId?: string;
  percent: number;
  olfactoryFamily?: string | null;
};

export type ColumnMarkMixPercent = {
  ok: number;
  weak: number;
  strong: number;
  harsh: number;
  unmarked: number;
  marked: number;
};

export type FamilyMarkSlice = ColumnMarkMixPercent & { family: string };

export function resolvedOlfactoryFamily(family?: string | null): string {
  return family?.trim() || DEFAULT_OLFACTORY_FAMILY;
}

function linePercent(line: MixPercentLine): number {
  const n = Number(line.percent);
  return Number.isFinite(n) ? n : 0;
}

/** Same cap as workbench radar: top families, overflow folded into Other. */
export function formulaFamilyIds(
  lines: readonly MixPercentLine[],
  opts?: { maxAxes?: number; otherLabel?: string },
): string[] {
  const otherLabel = opts?.otherLabel ?? OTHER_FAMILY_LABEL;
  const maxAxes = opts?.maxAxes ?? FAMILY_AXIS_CAP;
  const map = new Map<string, number>();
  for (const line of lines) {
    const family = resolvedOlfactoryFamily(line.olfactoryFamily);
    map.set(family, (map.get(family) ?? 0) + linePercent(line));
  }
  const buckets = [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (buckets.length <= maxAxes) return buckets.map(([name]) => name);
  return [...buckets.slice(0, maxAxes - 1).map(([name]) => name), otherLabel];
}

export function familyBucketForLine(
  line: Pick<MixPercentLine, 'olfactoryFamily'>,
  axes: readonly string[],
  otherLabel = OTHER_FAMILY_LABEL,
): string {
  const family = resolvedOlfactoryFamily(line.olfactoryFamily);
  if (axes.includes(family)) return family;
  if (axes.includes(otherLabel)) return otherLabel;
  return family;
}

function scopedMixLines(
  lines: readonly MixPercentLine[],
  family: string | null | undefined,
  otherLabel: string,
  maxAxes: number,
): MixPercentLine[] {
  if (!family) return [...lines];
  const axes = formulaFamilyIds(lines, { otherLabel, maxAxes });
  return lines.filter((line) => familyBucketForLine(line, axes, otherLabel) === family);
}

/**
 * Ok/Weak/Strong/Harsh as percent of the (optionally family-filtered) formula,
 * not as line counts. Unmarked is the remainder; stacks should leave it empty.
 */
export function columnMarkMixPercent(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  lines: readonly MixPercentLine[],
  columnId: BatchColumnId,
  opts?: { family?: string | null; otherLabel?: string; maxAxes?: number },
): ColumnMarkMixPercent {
  const otherLabel = opts?.otherLabel ?? OTHER_FAMILY_LABEL;
  const maxAxes = opts?.maxAxes ?? FAMILY_AXIS_CAP;
  const scoped = scopedMixLines(lines, opts?.family, otherLabel, maxAxes);
  const total = scoped.reduce((sum, line) => sum + linePercent(line), 0);
  const mix: ColumnMarkMixPercent = { ok: 0, weak: 0, strong: 0, harsh: 0, unmarked: 0, marked: 0 };
  if (total <= 0) return mix;
  for (const line of scoped) {
    const weight = (linePercent(line) / total) * 100;
    const mark = markAtColumn(sittings, formulaId, line.materialId, columnId, line.lineId);
    if (!mark) {
      mix.unmarked += weight;
      continue;
    }
    mix[mark] += weight;
    mix.marked += weight;
  }
  return mix;
}

/** How much of a line's formula percent still "sounds" after a mark. */
export const MARK_PRESENCE: Record<EvaluationLineMark, number> = {
  weak: 0.4,
  ok: 1,
  strong: 1.35,
  harsh: 1.35,
};

export type FamilyPowerSlice = {
  family: string;
  recipePct: number;
  power: number;
  powerSafe: number;
  powerHarsh: number;
  ok: number;
  weak: number;
  strong: number;
  harsh: number;
  unmarked: number;
};

export function familyPowerStackKey(family: string, harsh = false): string {
  return harsh ? `${family}__harsh` : family;
}

/**
 * Review-weighted family loudness: recipe percent × mark presence.
 * Unmarked lines contribute 0. Harsh is split so it can stack as a danger cap.
 */
export function columnFamilyPower(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  lines: readonly MixPercentLine[],
  columnId: BatchColumnId,
  opts?: { otherLabel?: string; maxAxes?: number },
): FamilyPowerSlice[] {
  const otherLabel = opts?.otherLabel ?? OTHER_FAMILY_LABEL;
  const maxAxes = opts?.maxAxes ?? FAMILY_AXIS_CAP;
  const axes = formulaFamilyIds(lines, { otherLabel, maxAxes });
  const formulaTotal = lines.reduce((sum, line) => sum + linePercent(line), 0);
  return axes.map((family) => {
    const slice: FamilyPowerSlice = {
      family,
      recipePct: 0,
      power: 0,
      powerSafe: 0,
      powerHarsh: 0,
      ok: 0,
      weak: 0,
      strong: 0,
      harsh: 0,
      unmarked: 0,
    };
    if (formulaTotal <= 0) return slice;
    for (const line of lines) {
      if (familyBucketForLine(line, axes, otherLabel) !== family) continue;
      const weight = (linePercent(line) / formulaTotal) * 100;
      slice.recipePct += weight;
      const mark = markAtColumn(sittings, formulaId, line.materialId, columnId, line.lineId);
      if (!mark) {
        slice.unmarked += weight;
        continue;
      }
      slice[mark] += weight;
      const judged = weight * MARK_PRESENCE[mark];
      if (mark === 'harsh') slice.powerHarsh += judged;
      else slice.powerSafe += judged;
    }
    slice.power = slice.powerSafe + slice.powerHarsh;
    return slice;
  });
}

export function familyPowerYMax(totals: readonly number[]): number {
  const peak = Math.max(100, ...totals);
  return Math.ceil(peak / 20) * 20;
}

export type FamilyRadarAxis = {
  id: string;
  label: string;
  value: number;
};

/** Polar vertices from family power — recipe or judged. Never invents a Harsh axis. */
export function familyPowerToRadarAxes(
  slices: readonly FamilyPowerSlice[],
  mode: 'recipe' | 'judged',
): FamilyRadarAxis[] {
  return slices.map((slice) => ({
    id: slice.family,
    label: slice.family,
    value: mode === 'recipe' ? slice.recipePct : slice.power,
  }));
}

export type FamilyPowerDelta = {
  family: string;
  now: number;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
};

const PREV_POWER_FLOOR = 0.5;

/** Judged-power change vs the previous blotter column. T+0 has no prior (`delta` / `deltaPct`: null). */
export function familyPowerDeltas(
  current: readonly FamilyPowerSlice[],
  previous: readonly FamilyPowerSlice[] | null,
): FamilyPowerDelta[] {
  const prevByFamily = new Map((previous ?? []).map((slice) => [slice.family, slice.power]));
  return current.map((slice) => {
    if (!previous) {
      return {
        family: slice.family,
        now: slice.power,
        previous: null,
        delta: null,
        deltaPct: null,
      };
    }
    const prior = prevByFamily.get(slice.family) ?? 0;
    return {
      family: slice.family,
      now: slice.power,
      previous: prior,
      delta: slice.power - prior,
      deltaPct: prior >= PREV_POWER_FLOOR ? ((slice.power - prior) / prior) * 100 : null,
    };
  });
}

/** Per-family mark mix as percent of the whole formula (tooltip / family chips). */
export function columnFamilyMarkProfile(
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  lines: readonly MixPercentLine[],
  columnId: BatchColumnId,
  opts?: { otherLabel?: string; maxAxes?: number },
): FamilyMarkSlice[] {
  const otherLabel = opts?.otherLabel ?? OTHER_FAMILY_LABEL;
  const maxAxes = opts?.maxAxes ?? FAMILY_AXIS_CAP;
  const axes = formulaFamilyIds(lines, { otherLabel, maxAxes });
  const formulaTotal = lines.reduce((sum, line) => sum + linePercent(line), 0);
  return axes.map((family) => {
    const slice: FamilyMarkSlice = {
      family,
      ok: 0,
      weak: 0,
      strong: 0,
      harsh: 0,
      unmarked: 0,
      marked: 0,
    };
    if (formulaTotal <= 0) return slice;
    for (const line of lines) {
      if (familyBucketForLine(line, axes, otherLabel) !== family) continue;
      const weight = (linePercent(line) / formulaTotal) * 100;
      const mark = markAtColumn(sittings, formulaId, line.materialId, columnId, line.lineId);
      if (!mark) {
        slice.unmarked += weight;
        continue;
      }
      slice[mark] += weight;
      slice.marked += weight;
    }
    return slice;
  });
}

export function previousBatchColumn(columnId: BatchColumnId): BatchColumnId | null {
  const idx = BATCH_COLUMNS.findIndex((col) => col.id === columnId);
  if (idx <= 0) return null;
  return BATCH_COLUMNS[idx - 1]?.id ?? null;
}

export function mixYMax(total: number, maxMarked: number): number {
  if (total <= MIX_Y_FULL_CAP) return Math.max(total, 1);
  return Math.max(maxMarked, 8);
}

export type BlotterLineRef = {
  materialId: string;
  lineId?: string;
  id?: string;
  materialName: string;
  pyramidNote?: string | null;
  olfactoryFamily?: string | null;
  percent?: string | number;
};

function lineRefId(line: BlotterLineRef): string | undefined {
  return line.lineId ?? line.id;
}

function attentionRank(
  line: BlotterLineRef,
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  activeColumn: BatchColumnId,
): number {
  const active = markAtColumn(sittings, formulaId, line.materialId, activeColumn, lineRefId(line));
  if (active === 'harsh') return 0;
  for (const col of BATCH_COLUMNS) {
    if (markAtColumn(sittings, formulaId, line.materialId, col.id, lineRefId(line)) === 'harsh')
      return 1;
  }
  if (!active) return 2;
  const prev = previousBatchColumn(activeColumn);
  if (prev) {
    const previous = markAtColumn(sittings, formulaId, line.materialId, prev, lineRefId(line));
    if (previous !== active) return 3;
  }
  if (active === 'strong') return 4;
  return 5;
}

/** Filter, rank, and optionally cap blotter rows for large formulas. */
export function visibleBlotterLines<T extends BlotterLineRef>(
  lines: readonly T[],
  sittings: readonly HeatmapSitting[],
  formulaId: string,
  activeColumn: BatchColumnId,
  opts?: {
    query?: string;
    pyramidNote?: string | null;
    family?: string | null;
    otherLabel?: string;
    mode?: BlotterFocusMode;
    cap?: number | null;
  },
): { visible: T[]; matched: number } {
  const query = opts?.query?.trim().toLowerCase() ?? '';
  const pyramid = opts?.pyramidNote ?? null;
  const family = opts?.family ?? null;
  const otherLabel = opts?.otherLabel ?? OTHER_FAMILY_LABEL;
  const familyAxes = family
    ? formulaFamilyIds(
        lines.map((line) => ({
          materialId: line.materialId,
          lineId: lineRefId(line),
          percent: Number(line.percent) || 0,
          olfactoryFamily: line.olfactoryFamily,
        })),
        { otherLabel },
      )
    : [];
  const large = lines.length > FOCUS_LINE_CAP;
  const mode = opts?.mode ?? (large ? 'attention' : 'all');
  const cap = opts?.cap === undefined ? (mode === 'all' ? null : FOCUS_LINE_CAP) : opts.cap;

  const filtered = lines.filter((line) => {
    if (pyramid && (line.pyramidNote ?? '') !== pyramid) return false;
    if (query && !line.materialName.toLowerCase().includes(query)) return false;
    if (family && familyBucketForLine(line, familyAxes, otherLabel) !== family) return false;
    if (mode === 'unmarked') {
      return !markAtColumn(sittings, formulaId, line.materialId, activeColumn, lineRefId(line));
    }
    return true;
  });

  const ranked =
    mode === 'attention'
      ? filtered
          .map((line, index) => ({
            line,
            index,
            rank: attentionRank(line, sittings, formulaId, activeColumn),
          }))
          .sort((a, b) => a.rank - b.rank || a.index - b.index)
          .map((row) => row.line)
      : filtered;

  return {
    visible: cap != null ? ranked.slice(0, cap) : ranked,
    matched: ranked.length,
  };
}

/** Put the in-progress sitting first so heatmap and coverage read live marks before Save Day. */
function lineMarkKey(row: EvaluationLineMarkRow, sittingDay: number): string {
  return `${row.lineId ?? row.materialId}|${effectiveMarkTimepoint(row, sittingDay) ?? 'day'}`;
}

export function mergeLineMarks(
  saved: readonly EvaluationLineMarkRow[] | null | undefined,
  live: readonly EvaluationLineMarkRow[] | null | undefined,
  sittingDay: number,
): EvaluationLineMarkRow[] {
  const next = new Map<string, EvaluationLineMarkRow>();
  for (const row of saved ?? []) next.set(lineMarkKey(row, sittingDay), row);
  for (const row of live ?? []) next.set(lineMarkKey(row, sittingDay), row);
  return [...next.values()];
}

export function overlayWorkingSitting(
  saved: readonly HeatmapSitting[],
  live: HeatmapSitting,
): HeatmapSitting[] {
  const liveDay = live.macerationDay ?? 0;
  const sameDay = saved.find(
    (row) =>
      row.id === live.id ||
      (row.formulaId === live.formulaId && (row.macerationDay ?? 0) === liveDay),
  );
  const merged: HeatmapSitting = {
    ...sameDay,
    ...live,
    id: live.id && live.id !== 'draft' ? live.id : (sameDay?.id ?? live.id),
    lineMarks: mergeLineMarks(sameDay?.lineMarks, live.lineMarks, liveDay),
  };
  return [
    merged,
    ...saved.filter(
      (row) =>
        row.id !== merged.id &&
        !(row.formulaId === live.formulaId && (row.macerationDay ?? 0) === liveDay),
    ),
  ];
}
