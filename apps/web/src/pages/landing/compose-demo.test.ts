import { describe, expect, it } from 'vitest';
import { totalBatchGrams } from '@fc/formula-engine';
import {
  BASELINE,
  CONCENTRATE_TARGET,
  DEMO_FAMILY_ORDER,
  clampAmount,
  demoRadarAxes,
  deriveComposeDemo,
  sliderCeiling,
  type Amounts,
} from './compose-demo';
import { DEMO_ADJUSTABLE_IDS } from './demo-formula';

function amounts(overrides: Partial<Amounts> = {}): Amounts {
  return { ...BASELINE, ...overrides };
}

function familyShare(
  concentrate: ReturnType<typeof deriveComposeDemo>['concentrate'],
  family: string,
) {
  return demoRadarAxes(concentrate).find((axis) => axis.id === family)?.value ?? 0;
}

describe('landing compose demo', () => {
  it('keeps the concentrate on its target at the baseline', () => {
    const state = deriveComposeDemo(BASELINE);
    expect(totalBatchGrams(state.concentrate)).toBeCloseTo(CONCENTRATE_TARGET, 6);
    expect(state.edge).toBe('none');
  });

  it('raises Fresh when bergamot moves up, without reordering radar vertices', () => {
    const baselineFresh = familyShare(deriveComposeDemo(BASELINE).concentrate, 'Fresh');
    const raised = deriveComposeDemo(amounts({ bergamot: sliderCeiling('bergamot', BASELINE) }));
    expect(familyShare(raised.concentrate, 'Fresh')).toBeGreaterThan(baselineFresh + 5);
    expect(demoRadarAxes(raised.concentrate).map((axis) => axis.id)).toEqual([
      ...DEMO_FAMILY_ORDER,
    ]);
  });

  it('fills the concentrate from the remaining lines when every slider is at zero', () => {
    const state = deriveComposeDemo(amounts({ bergamot: 0, linalool: 0, ambroxan: 0 }));
    expect(state.edge).toBe('allMin');
    expect(totalBatchGrams(state.concentrate)).toBeCloseTo(CONCENTRATE_TARGET, 6);
    expect(state.concentrate.find((line) => line.id === 'bergamot')?.amountGrams).toBe(0);
    expect(state.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBeGreaterThan(0);
    expect(demoRadarAxes(state.concentrate).some((axis) => axis.value > 0)).toBe(true);
  });

  it('does not throw when the three sliders would overflow the concentrate', () => {
    const greedy: Amounts = {
      bergamot: BASELINE.bergamot * 2.5,
      linalool: BASELINE.linalool * 2.5,
      ambroxan: BASELINE.ambroxan * 2.5,
    };
    expect(greedy.bergamot + greedy.linalool + greedy.ambroxan).toBeGreaterThan(CONCENTRATE_TARGET);
    const state = deriveComposeDemo(greedy);
    expect(totalBatchGrams(state.concentrate)).toBeCloseTo(CONCENTRATE_TARGET, 5);
    expect(state.edge).toBe('remainderZero');
    expect(state.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBe(0);
  });

  it('lets a slider reach a stepped ceiling that fills the concentrate', () => {
    const nearlyFull = amounts({
      bergamot: sliderCeiling('bergamot', BASELINE),
      linalool: sliderCeiling('linalool', {
        bergamot: sliderCeiling('bergamot', BASELINE),
        linalool: 0,
        ambroxan: 0,
      }),
      ambroxan: 0,
    });
    const ceiling = sliderCeiling('ambroxan', nearlyFull);
    expect(ceiling * 100).toBeCloseTo(Math.round(ceiling * 100), 8);
    const filled = deriveComposeDemo({ ...nearlyFull, ambroxan: ceiling });
    expect(filled.edge).toBe('remainderZero');
    expect(filled.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBe(0);
  });

  it('shrinks a slider ceiling so the three lines cannot exceed the concentrate', () => {
    const nearlyFull = amounts({
      bergamot: sliderCeiling('bergamot', BASELINE),
      linalool: 0,
    });
    const ceiling = sliderCeiling('ambroxan', nearlyFull);
    expect(ceiling).toBeLessThanOrEqual(
      CONCENTRATE_TARGET - nearlyFull.bergamot - nearlyFull.linalool + 1e-9,
    );
    expect(clampAmount('ambroxan', 99, nearlyFull)).toBeCloseTo(ceiling, 6);
  });

  it('keeps six radar axes even when a family is empty', () => {
    const state = deriveComposeDemo(amounts({ ambroxan: 0 }));
    const axes = demoRadarAxes(state.concentrate);
    expect(axes).toHaveLength(DEMO_FAMILY_ORDER.length);
    expect(axes.map((axis) => axis.id)).toEqual([...DEMO_FAMILY_ORDER]);
  });

  it('keeps family percents on a 0–100 domain that still sums to the concentrate', () => {
    const state = deriveComposeDemo(amounts({ bergamot: 0.9 }));
    const axes = demoRadarAxes(state.concentrate);
    const total = axes.reduce((sum, axis) => sum + axis.value, 0);
    expect(total).toBeCloseTo(100, 4);
    expect(axes.every((axis) => axis.value >= 0 && axis.value <= 100)).toBe(true);
  });

  it('lets every adjustable id be clamped independently', () => {
    for (const id of DEMO_ADJUSTABLE_IDS) {
      expect(clampAmount(id, -1, BASELINE)).toBe(0);
      expect(clampAmount(id, sliderCeiling(id, BASELINE), BASELINE)).toBeCloseTo(
        sliderCeiling(id, BASELINE),
        6,
      );
    }
  });
});
