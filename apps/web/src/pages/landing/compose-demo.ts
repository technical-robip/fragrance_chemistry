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

/**
 * Each slider has its own fixed range. The thumb at the end is always the
 * same dose, and moving one line never rewrites the others.
 */
const SPIKE_SHARE = 0.55;

export function sliderCeiling(id: keyof Amounts): number {
  return floorToStep(Math.max(BASELINE[id] * 2.5, CONCENTRATE_TARGET * SPIKE_SHARE));
}

/** Clamp one slider to its own ceiling. */
export function clampAmount(id: keyof Amounts, value: number): number {
  const finite = Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(0, finite), sliderCeiling(id));
}

/** Sets one line. Every other adjustable line stays where the visitor left it. */
export function applySlider(id: keyof Amounts, value: number, amounts: Amounts): Amounts {
  return { ...amounts, [id]: clampAmount(id, value) };
}

function clampEach(amounts: Amounts): Amounts {
  const next = { ...amounts };
  for (const id of DEMO_ADJUSTABLE_IDS) next[id] = clampAmount(id, next[id]);
  return next;
}

/**
 * Applies the visitor's amounts as set. Hidden example lines stay on their
 * stock dose. The carrier gives or takes mass so the batch stays 10 g.
 */
export function deriveComposeDemo(amounts: Amounts) {
  const clamped = clampEach(amounts);
  const concentrate: FormulaLine[] = CONCENTRATE_LINES.map((line) =>
    line.id in clamped ? { ...line, amountGrams: clamped[line.id as keyof Amounts] } : { ...line },
  );
  const concentrateGrams = concentrate.reduce((sum, line) => sum + line.amountGrams, 0);
  const carrierGrams = Math.max(0, roundGrams(DEMO_BATCH_GRAMS - concentrateGrams));
  const carrier = DEMO_LINES.find((line) => line.id === DEMO_CARRIER_ID)!;
  const lines = [...concentrate, { ...carrier, amountGrams: carrierGrams }];
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
    remainderGrams: carrierGrams,
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
