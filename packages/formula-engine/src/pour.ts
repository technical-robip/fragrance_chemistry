import { rebalanceFormula } from './rebalance';
import { linePercent } from './scale';
import type { FormulaLine } from './types';

export type PourAdjustMode = 'keepRatios' | 'keepBatch';

/** One concentrate line in a weighing session. `key` is materialId + sort order, not the row uuid. */
export interface SessionLine {
  key: string;
  materialId: string;
  percent: number;
  targetGrams: number;
  actualGrams: number | null;
}

export interface ApplyPourInput {
  lines: SessionLine[];
  lineKey: string;
  actualGrams: number;
  batchGrams: number;
  concentrationPct: number;
  /** When false, the pour is recorded and every other target stays put. */
  adjust: boolean;
  mode: PourAdjustMode;
}

export interface PourState {
  lines: SessionLine[];
  batchGrams: number;
  concentrationPct: number;
  diluentGrams: number;
  adjusted: boolean;
}

export type ApplyPourResult =
  (PourState & { ok: true }) | (PourState & { ok: false; reason: 'fixedExceedBatch' });

const EPS = 1e-6;

function roundGrams(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundPercent(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Alcohol mass for a concentrate batch at a finished-juice concentration. */
export function sessionDiluentGrams(concentrateGrams: number, concentrationPct: number): number {
  if (concentrationPct <= EPS) return 0;
  return Math.max(0, concentrateGrams / (concentrationPct / 100) - concentrateGrams);
}

function concentrationForDiluent(batchGrams: number, diluentGrams: number): number {
  const juice = batchGrams + diluentGrams;
  if (juice <= EPS) return 100;
  return Math.min(100, Math.max(0.1, roundPercent((batchGrams / juice) * 100)));
}

function recordOnly(input: ApplyPourInput, actual: number): ApplyPourResult {
  return {
    ok: true,
    adjusted: false,
    batchGrams: input.batchGrams,
    concentrationPct: input.concentrationPct,
    diluentGrams: roundGrams(sessionDiluentGrams(input.batchGrams, input.concentrationPct)),
    lines: input.lines.map((line) =>
      line.key === input.lineKey ? { ...line, actualGrams: actual } : { ...line },
    ),
  };
}

function percentsFromGrams(
  lines: SessionLine[],
  gramsOf: (line: SessionLine) => number,
): SessionLine[] {
  const grams = lines.map((line) => gramsOf(line));
  const total = grams.reduce((sum, value) => sum + value, 0);
  if (total <= EPS) return lines.map((line) => ({ ...line, percent: 0 }));
  const percents = grams.map((value) => roundPercent((value / total) * 100));
  const drift = roundPercent(100 - percents.reduce((sum, value) => sum + value, 0));
  for (let index = percents.length - 1; index >= 0; index -= 1) {
    if (grams[index]! > EPS) {
      percents[index] = roundPercent(percents[index]! + drift);
      break;
    }
  }
  return lines.map((line, index) => ({ ...line, percent: percents[index]! }));
}

function applyKeepRatios(input: ApplyPourInput, actual: number, target: number): ApplyPourResult {
  const scale = actual / target;
  const priorAccepted = input.lines.some(
    (line) => line.key !== input.lineKey && line.actualGrams != null,
  );
  const diluent = roundGrams(sessionDiluentGrams(input.batchGrams, input.concentrationPct) * scale);

  if (!priorAccepted) {
    const batchGrams = roundGrams(input.batchGrams * scale);
    const lines = input.lines.map((line) => {
      const targetGrams = roundGrams((line.percent / 100) * batchGrams);
      if (line.key === input.lineKey) {
        return { ...line, actualGrams: actual, targetGrams: actual };
      }
      return { ...line, targetGrams };
    });
    return {
      ok: true,
      adjusted: true,
      lines,
      batchGrams,
      concentrationPct: input.concentrationPct,
      diluentGrams: roundGrams(sessionDiluentGrams(batchGrams, input.concentrationPct)),
    };
  }

  const scaled = input.lines.map((line) => {
    if (line.key === input.lineKey) {
      return { ...line, actualGrams: actual, targetGrams: actual };
    }
    if (line.actualGrams != null) return { ...line };
    return { ...line, targetGrams: roundGrams(line.targetGrams * scale) };
  });
  const batchGrams = roundGrams(
    scaled.reduce((sum, line) => sum + (line.actualGrams ?? line.targetGrams), 0),
  );
  const lines = percentsFromGrams(scaled, (line) => line.actualGrams ?? line.targetGrams).map(
    (line) => ({
      ...line,
      targetGrams: roundGrams(line.actualGrams ?? line.targetGrams),
    }),
  );
  const concentrationPct = concentrationForDiluent(batchGrams, diluent);
  return {
    ok: true,
    adjusted: true,
    lines,
    batchGrams,
    concentrationPct,
    diluentGrams: roundGrams(sessionDiluentGrams(batchGrams, concentrationPct)),
  };
}

function applyKeepBatch(input: ApplyPourInput, actual: number): ApplyPourResult {
  const formulaLines: FormulaLine[] = input.lines.map((line) => ({
    id: line.key,
    materialId: line.materialId,
    label: line.key,
    amountGrams: line.key === input.lineKey ? actual : (line.actualGrams ?? line.targetGrams),
    concentrationKind: 'neat',
  }));
  const fixedLineIds = input.lines
    .filter((line) => line.actualGrams != null || line.key === input.lineKey)
    .map((line) => line.key);

  try {
    const result = rebalanceFormula(formulaLines, {
      fixedLineIds,
      batchSizeGrams: input.batchGrams,
    });
    const byId = new Map(result.lines.map((line) => [line.id, line]));
    const next = input.lines.map((line) => {
      const updated = byId.get(line.key);
      const amount = updated?.amountGrams ?? line.targetGrams;
      return {
        ...line,
        targetGrams: roundGrams(amount),
        percent: roundPercent(linePercent(updated ?? formulaLines[0]!, result.totalGrams)),
        actualGrams: line.key === input.lineKey ? actual : line.actualGrams,
      };
    });
    const lines = percentsFromGrams(next, (line) => line.targetGrams);
    return {
      ok: true,
      adjusted: true,
      lines,
      batchGrams: input.batchGrams,
      concentrationPct: input.concentrationPct,
      diluentGrams: roundGrams(sessionDiluentGrams(input.batchGrams, input.concentrationPct)),
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Fixed lines exceed target batch size') {
      return {
        ok: false,
        reason: 'fixedExceedBatch',
        adjusted: false,
        lines: input.lines.map((line) => ({ ...line })),
        batchGrams: input.batchGrams,
        concentrationPct: input.concentrationPct,
        diluentGrams: roundGrams(sessionDiluentGrams(input.batchGrams, input.concentrationPct)),
      };
    }
    throw error;
  }
}

/**
 * Accept the current pour.
 * Under target, or with adjustment off, only the weighed amount is stored.
 * Over target, keepRatios grows the open lines (and the batch when nothing is poured yet);
 * keepBatch shrinks the unpoured lines so the concentrate mass stays put.
 */
export function applyPour(input: ApplyPourInput): ApplyPourResult {
  const current = input.lines.find((line) => line.key === input.lineKey);
  if (!current) throw new Error('Unknown weighing line');
  if (current.actualGrams != null) throw new Error('Line already accepted');

  const actual = roundGrams(Math.max(0, input.actualGrams));
  const target = current.targetGrams;
  const overshoot = target > EPS && actual > target + EPS;

  if (!input.adjust || !overshoot) return recordOnly(input, actual);
  if (input.mode === 'keepBatch') return applyKeepBatch(input, actual);
  return applyKeepRatios(input, actual, target);
}

/** Rescale every open target when the batch changes before the first accepted pour. Percents stay. */
export function scaleOpenBatch(
  lines: SessionLine[],
  batchGrams: number,
  concentrationPct: number,
): PourState {
  const batch = roundGrams(batchGrams);
  return {
    lines: lines.map((line) => ({
      ...line,
      targetGrams: roundGrams((line.percent / 100) * batch),
    })),
    batchGrams: batch,
    concentrationPct,
    diluentGrams: roundGrams(sessionDiluentGrams(batch, concentrationPct)),
    adjusted: false,
  };
}

export interface DiluentPourInput {
  actualGrams: number;
  batchGrams: number;
  concentrationPct: number;
  adjust: boolean;
}

export interface DiluentPourResult {
  ok: true;
  adjusted: boolean;
  batchGrams: number;
  concentrationPct: number;
  diluentGrams: number;
  actualGrams: number;
}

/** The alcohol step is last. An overshoot changes concentration so the saved diluent matches the beaker. */
export function applyDiluentPour(input: DiluentPourInput): DiluentPourResult {
  const actual = roundGrams(Math.max(0, input.actualGrams));
  const target = sessionDiluentGrams(input.batchGrams, input.concentrationPct);
  const overshoot = target > EPS && actual > target + EPS;
  if (!input.adjust || !overshoot) {
    return {
      ok: true,
      adjusted: false,
      actualGrams: actual,
      batchGrams: input.batchGrams,
      concentrationPct: input.concentrationPct,
      diluentGrams: roundGrams(target),
    };
  }
  const concentrationPct = concentrationForDiluent(input.batchGrams, actual);
  return {
    ok: true,
    adjusted: true,
    actualGrams: actual,
    batchGrams: input.batchGrams,
    concentrationPct,
    diluentGrams: roundGrams(sessionDiluentGrams(input.batchGrams, concentrationPct)),
  };
}
