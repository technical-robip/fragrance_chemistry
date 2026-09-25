import {
  activeGrams,
  dominantPyramidNote,
  formulaCost,
  pyramidPercents,
  totalBatchGrams,
  type FormulaLine,
} from '@fc/formula-engine';
import type { RadarAxis } from '@/lib/formula-viz';
import {
  DEMO_ADJUSTABLE_IDS,
  DEMO_BATCH_GRAMS,
  DEMO_CARRIER_ID,
  DEMO_FAMILIES,
  DEMO_LINES,
} from './demo-formula';

/** Concentrate lines only — the carrier is the fill, not the juice. */
export const CONCENTRATE_LINES = DEMO_LINES.filter((line) => line.id !== DEMO_CARRIER_ID);

export const CONCENTRATE_TARGET = CONCENTRATE_LINES.reduce(
  (sum, line) => sum + line.amountGrams,
  0,
);

export const BASELINE = Object.fromEntries(
  DEMO_ADJUSTABLE_IDS.map((id) => [id, DEMO_LINES.find((line) => line.id === id)!.amountGrams]),
) as Record<(typeof DEMO_ADJUSTABLE_IDS)[number], number>;

export type Amounts = typeof BASELINE;

export type ComposeEdge = 'none' | 'allMin' | 'remainderZero';

/** Stable radar vertices. Rank-sorting made the polygon jump while sliders moved. */
export const DEMO_FAMILY_ORDER = [
  'Fresh',
  'Green',
  'Floral',
  'Woody',
  'Amber',
  'Animalic',
] as const;

const EPS = 1e-9;
/** Matches the range `step`, so a slider can actually reach its ceiling. */
const SLIDER_STEP = 0.01;

function floorToStep(value: number, step = SLIDER_STEP): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor((value + 1e-9) / step) * step;
}

export function sliderCeiling(id: keyof Amounts, amounts: Amounts): number {
  const others = DEMO_ADJUSTABLE_IDS.filter((key) => key !== id).reduce(
    (sum, key) => sum + amounts[key],
    0,
  );
  const room = Math.max(0, CONCENTRATE_TARGET - others);
  const independent = Math.max(BASELINE[id] * 2.5, 0.25);
  return floorToStep(Math.min(independent, room));
}

/** Clamp a single slider so the three adjustable lines cannot exceed the concentrate. */
export function clampAmount(id: keyof Amounts, value: number, amounts: Amounts): number {
  const finite = Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(0, finite), sliderCeiling(id, amounts));
}

function clampAll(amounts: Amounts): Amounts {
  const next = { ...amounts };
  let sum = DEMO_ADJUSTABLE_IDS.reduce((total, id) => total + next[id], 0);
  if (sum > CONCENTRATE_TARGET + EPS) {
    const scale = CONCENTRATE_TARGET / sum;
    for (const id of DEMO_ADJUSTABLE_IDS) next[id] = next[id] * scale;
    sum = CONCENTRATE_TARGET;
  }
  return next;
}

/**
 * Applies the visitor's amounts, then lets every other concentrate line absorb
 * the difference so the concentrate still totals its target. Never throws: if
 * the three sliders fill the concentrate, the remaining lines sit at zero.
 */
export function deriveComposeDemo(amounts: Amounts) {
  const clamped = clampAll(amounts);
  const withEdits: FormulaLine[] = CONCENTRATE_LINES.map((line) =>
    line.id in clamped ? { ...line, amountGrams: clamped[line.id as keyof Amounts] } : { ...line },
  );

  const fixedGrams = DEMO_ADJUSTABLE_IDS.reduce((sum, id) => {
    const line = withEdits.find((entry) => entry.id === id);
    return sum + (line?.amountGrams ?? 0);
  }, 0);
  const remainder = CONCENTRATE_TARGET - fixedGrams;

  let movableGrams = 0;
  for (const line of withEdits) {
    if (!DEMO_ADJUSTABLE_IDS.includes(line.id as (typeof DEMO_ADJUSTABLE_IDS)[number])) {
      movableGrams += line.amountGrams;
    }
  }

  const scaled = withEdits.map((line) => {
    if (DEMO_ADJUSTABLE_IDS.includes(line.id as (typeof DEMO_ADJUSTABLE_IDS)[number])) {
      return line;
    }
    if (remainder <= EPS || movableGrams <= EPS) {
      return { ...line, amountGrams: 0 };
    }
    return {
      ...line,
      amountGrams: roundGrams(line.amountGrams * (remainder / movableGrams)),
    };
  });

  const movableTotal = scaled
    .filter(
      (line) => !DEMO_ADJUSTABLE_IDS.includes(line.id as (typeof DEMO_ADJUSTABLE_IDS)[number]),
    )
    .reduce((sum, line) => sum + line.amountGrams, 0);
  const leftover = remainder > EPS ? remainder - movableTotal : 0;
  const lastMovable = [...scaled]
    .reverse()
    .find(
      (line) =>
        !DEMO_ADJUSTABLE_IDS.includes(line.id as (typeof DEMO_ADJUSTABLE_IDS)[number]) &&
        line.amountGrams > EPS,
    );
  const concentrate = scaled.map((line) =>
    lastMovable && line.id === lastMovable.id
      ? { ...line, amountGrams: roundGrams(line.amountGrams + leftover) }
      : line,
  );

  const carrier = DEMO_LINES.find((line) => line.id === DEMO_CARRIER_ID)!;
  const lines = [...concentrate, { ...carrier }];
  const allMin = DEMO_ADJUSTABLE_IDS.every((id) => clamped[id] <= EPS);
  const remainingIdle = concentrate.every(
    (line) =>
      DEMO_ADJUSTABLE_IDS.includes(line.id as (typeof DEMO_ADJUSTABLE_IDS)[number]) ||
      line.amountGrams <= EPS,
  );

  let edge: ComposeEdge = 'none';
  if (allMin) edge = 'allMin';
  else if (remainingIdle) edge = 'remainderZero';

  return {
    amounts: clamped,
    lines,
    concentrate,
    batchGrams: totalBatchGrams(lines),
    neatGrams: lines.reduce((sum, line) => sum + activeGrams(line), 0),
    pyramid: pyramidPercents(concentrate),
    dominant: dominantPyramidNote(concentrate),
    cost: formulaCost({ id: 'demo', name: 'demo', lines, batchSizeGrams: DEMO_BATCH_GRAMS }),
    edge,
    remainderGrams: Math.max(0, remainder),
  };
}

/** Family shares of the concentrate, on a fixed 0–100 domain and a fixed vertex order. */
export function demoRadarAxes(concentrate: FormulaLine[]): RadarAxis[] {
  const total = concentrate.reduce((sum, line) => sum + line.amountGrams, 0);
  const buckets = new Map<string, number>(DEMO_FAMILY_ORDER.map((name) => [name, 0]));

  if (total > EPS) {
    for (const line of concentrate) {
      const family = DEMO_FAMILIES[line.id];
      if (!family || !buckets.has(family)) continue;
      buckets.set(family, (buckets.get(family) ?? 0) + (line.amountGrams / total) * 100);
    }
  }

  return DEMO_FAMILY_ORDER.map((id) => ({
    id,
    label: id,
    value: buckets.get(id) ?? 0,
  }));
}

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
