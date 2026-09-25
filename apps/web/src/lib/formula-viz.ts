export type FormulaLineLike = {
  key?: string;
  name?: string;
  material?: string;
  percent?: number;
  targetPct?: number;
  pyramidNote?: string | null;
  olfactoryFamily?: string | null;
  tenacityHours?: number | null;
  evaporationIndex?: number | null;
};

export type PyramidMode = 'note' | 'volatility';

export type PyramidLayerId = 'top' | 'middle' | 'base' | 'modifier';

export type PyramidLayerItem = {
  key: string;
  name: string;
  percent: number;
};

export type PyramidLayerBreakdown = Record<PyramidLayerId, PyramidLayerItem[]>;

export function pyramidPercents(lines: FormulaLineLike[]) {
  const buckets = { top: 0, middle: 0, base: 0, modifier: 0 };
  for (const line of lines) {
    const pct = Number(line.targetPct ?? 0);
    const note = line.pyramidNote === 'heart' ? 'middle' : line.pyramidNote;
    if (note === 'top' || note === 'middle' || note === 'base' || note === 'modifier') {
      buckets[note] += pct;
    }
  }
  const total = buckets.top + buckets.middle + buckets.base || 1;
  return {
    top: (buckets.top / total) * 100,
    middle: (buckets.middle / total) * 100,
    base: (buckets.base / total) * 100,
    modifier: buckets.modifier,
    raw: buckets,
  };
}

function normalizePyramidNote(note?: string | null): PyramidLayerId | null {
  if (note === 'heart') return 'middle';
  if (note === 'top' || note === 'middle' || note === 'base' || note === 'modifier') return note;
  return null;
}

function bandFromTenacityHours(hours: number): 'top' | 'middle' | 'base' {
  if (hours < 6) return 'top';
  if (hours <= 24) return 'middle';
  return 'base';
}

/** Tagged note vs blotter tenacity / evaporation index (same bands as the API pyramid). */
export function linePyramidBand(
  line: Pick<FormulaLineLike, 'pyramidNote' | 'tenacityHours' | 'evaporationIndex'>,
  mode: PyramidMode,
): 'top' | 'middle' | 'base' | null {
  if (mode === 'volatility') {
    return evaporationBand(line) ?? taggedPyramidBand(line.pyramidNote);
  }
  return taggedPyramidBand(line.pyramidNote);
}

function taggedPyramidBand(note?: string | null): 'top' | 'middle' | 'base' | null {
  const tagged = normalizePyramidNote(note);
  if (tagged === 'top' || tagged === 'middle' || tagged === 'base') return tagged;
  return null;
}

/** Evaporation step from blotter data only — never falls back to the tag. */
export function evaporationBand(
  line: Pick<FormulaLineLike, 'tenacityHours' | 'evaporationIndex'>,
): 'top' | 'middle' | 'base' | null {
  if (line.evaporationIndex != null && Number.isFinite(line.evaporationIndex)) {
    const idx = line.evaporationIndex;
    return idx >= 66 ? 'top' : idx >= 33 ? 'middle' : 'base';
  }
  if (line.tenacityHours != null && Number.isFinite(line.tenacityHours)) {
    return bandFromTenacityHours(Number(line.tenacityHours));
  }
  return null;
}

const BAND_RANK: Record<'top' | 'middle' | 'base', number> = { top: 0, middle: 1, base: 2 };

export type PyramidDrift = {
  key: string;
  name: string;
  percent: number;
  tagged: 'top' | 'middle' | 'base';
  evaporates: 'top' | 'middle' | 'base';
  tenacityHours: number | null;
  direction: 'faster' | 'slower';
};

/** Materials whose tagged pyramid step disagrees with blotter tenacity. */
export function pyramidDrydownDrifts(lines: FormulaLineLike[]): PyramidDrift[] {
  return lines
    .flatMap((line, idx) => {
      const tagged = taggedPyramidBand(line.pyramidNote);
      const evaporates = evaporationBand(line);
      if (!tagged || !evaporates || tagged === evaporates) return [];
      return [
        {
          key: line.key ?? line.material ?? `${idx}`,
          name: lineName(line),
          percent: linePercent(line),
          tagged,
          evaporates,
          tenacityHours: line.tenacityHours ?? null,
          direction:
            BAND_RANK[evaporates] < BAND_RANK[tagged] ? ('faster' as const) : ('slower' as const),
        },
      ];
    })
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}

function linePercent(line: FormulaLineLike) {
  const n = Number(line.percent ?? line.targetPct ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function lineName(line: FormulaLineLike) {
  return (line.name ?? line.material ?? '').trim() || '—';
}

export function pyramidLayerBreakdown(lines: FormulaLineLike[]): PyramidLayerBreakdown {
  const buckets: PyramidLayerBreakdown = { top: [], middle: [], base: [], modifier: [] };
  lines.forEach((line, idx) => {
    const id = normalizePyramidNote(line.pyramidNote);
    if (!id) return;
    buckets[id].push({
      key: line.key ?? `${id}-${idx}`,
      name: lineName(line),
      percent: linePercent(line),
    });
  });
  (Object.keys(buckets) as PyramidLayerId[]).forEach((id) => {
    buckets[id].sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  });
  return buckets;
}

export function previewLayerMaterials(items: PyramidLayerItem[], limit = 2) {
  const safe = Math.max(0, limit);
  return {
    shown: items.slice(0, safe),
    rest: Math.max(0, items.length - safe),
  };
}

/** Radar family ids that contribute to a pyramid layer (maps overflow families onto Other). */
export function familyIdsForPyramidLayer(
  lines: FormulaLineLike[],
  layerId: string | null | undefined,
  options?: { maxAxes?: number; otherLabel?: string },
): string[] {
  const layer = normalizePyramidNote(layerId);
  if (!layer) return [];
  const otherLabel = options?.otherLabel ?? 'Other';
  const axes = radarFamilyAxes(lines, options);
  const axisIds = new Set(axes.map((axis) => axis.id));
  const ids = new Set<string>();
  for (const line of lines) {
    if (normalizePyramidNote(line.pyramidNote) !== layer) continue;
    const family = resolvedFamily(line.olfactoryFamily);
    if (axisIds.has(family)) ids.add(family);
    else if (axisIds.has(otherLabel)) ids.add(otherLabel);
  }
  return [...ids];
}

export function resolvedFamily(olfactoryFamily?: string | null): string {
  return olfactoryFamily?.trim() || 'Special';
}

export function familyBuckets(lines: FormulaLineLike[]) {
  const map = new Map<string, number>();
  for (const line of lines) {
    const fam = resolvedFamily(line.olfactoryFamily);
    map.set(fam, (map.get(fam) ?? 0) + Number(line.targetPct ?? 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export type RadarAxis = { id: string; label: string; value: number };

export function capRadarAxes(axes: RadarAxis[], maxAxes = 8, otherLabel = 'Other'): RadarAxis[] {
  if (axes.length <= maxAxes) return axes;
  const head = axes.slice(0, maxAxes - 1);
  const other = axes.slice(maxAxes - 1).reduce((s, a) => s + a.value, 0);
  return [...head, { id: otherLabel, label: otherLabel, value: other }];
}

/** Catalog / evaluation family fills — tokens only, Fresh ≠ Citrus ≠ Green. */
const FAMILY_HUE: Record<string, string> = {
  Floral: 'var(--fc-family-floral)',
  Fresh: 'var(--fc-family-fresh)',
  Citrus: 'var(--fc-family-citrus)',
  Green: 'var(--fc-family-green)',
  Animalic: 'var(--fc-family-animalic)',
  Woody: 'var(--fc-family-woody)',
  Gourmand: 'var(--fc-family-gourmand)',
  Special: 'var(--fc-family-special)',
  Amber: 'var(--fc-family-amber)',
  Oriental: 'var(--fc-family-oriental)',
};

export function familyHue(family?: string | null): string {
  const name = family?.trim() || '';
  if (!name) return 'var(--fc-accent)';
  const keyed = FAMILY_HUE[name];
  if (keyed) return keyed;
  const match = Object.entries(FAMILY_HUE).find(([id]) => id.toLowerCase() === name.toLowerCase());
  return match?.[1] ?? 'var(--fc-accent)';
}

export function radarFamilyAxes(
  lines: FormulaLineLike[],
  options?: { maxAxes?: number; otherLabel?: string },
): RadarAxis[] {
  return capRadarAxes(
    familyBuckets(lines).map((b) => ({ id: b.name, label: b.name, value: b.value })),
    options?.maxAxes ?? 8,
    options?.otherLabel ?? 'Other',
  );
}

export type FamilyPercentLine = {
  olfactoryFamily?: string | null;
  percent: number;
};

/**
 * Scale every line in `familyId` so that family totals `nextPct`, and scale the
 * remaining families so the formula total stays the same. Intra-family ratios
 * are preserved. The Other radar bucket (same grouping as capRadarAxes) is
 * treated as one group.
 */
export function scaleFamilyLinePercents<T extends FamilyPercentLine>(
  lines: T[],
  familyId: string,
  nextPct: number,
  options?: { otherLabel?: string; maxAxes?: number },
): T[] {
  if (lines.length === 0) return lines;
  const maxAxes = options?.maxAxes ?? 8;
  const otherLabel = options?.otherLabel ?? 'Other';
  const total = lines.reduce((sum, line) => sum + line.percent, 0);
  if (total <= 0) return lines;

  const buckets = familyBuckets(
    lines.map((line) => ({
      targetPct: line.percent,
      olfactoryFamily: line.olfactoryFamily,
    })),
  );
  const capped = buckets.length > maxAxes;
  const headNames = new Set((capped ? buckets.slice(0, maxAxes - 1) : buckets).map((b) => b.name));
  const isOtherGroup = capped && familyId === otherLabel;

  const inTarget = (line: T) => {
    const fam = resolvedFamily(line.olfactoryFamily);
    if (isOtherGroup) return !headNames.has(fam);
    return fam === familyId;
  };

  const familySum = lines.reduce((sum, line) => (inTarget(line) ? sum + line.percent : sum), 0);
  const restSum = total - familySum;
  if (familySum <= 0 || restSum <= 0) return lines;

  const next = Math.min(total, Math.max(0, nextPct));
  if (Math.abs(next - familySum) < 1e-9) return lines;

  const familyScale = next / familySum;
  const restScale = (total - next) / restSum;

  return lines.map((line) => ({
    ...line,
    percent: Number((line.percent * (inTarget(line) ? familyScale : restScale)).toFixed(4)),
  }));
}
