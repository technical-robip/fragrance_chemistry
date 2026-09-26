import { describe, expect, it } from 'vitest';
import { totalBatchGrams } from '@fc/formula-engine';
import {
  BASELINE,
  CONCENTRATE_TARGET,
  DEMO_FAMILY_ORDER,
  applySlider,
  clampAmount,
  demoRadarAxes,
  deriveComposeDemo,
  sliderCeiling,
  type Amounts,
} from './compose-demo';
import { DEMO_ADJUSTABLE_IDS, DEMO_BATCH_GRAMS } from './demo-formula';

function amounts(overrides: Partial<Amounts> = {}): Amounts {
  return { ...BASELINE, ...overrides };
}

function zeroed(): Amounts {
  return Object.fromEntries(DEMO_ADJUSTABLE_IDS.map((id) => [id, 0])) as Amounts;
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
    const raised = deriveComposeDemo(applySlider('bergamot', sliderCeiling('bergamot'), BASELINE));
    expect(familyShare(raised.concentrate, 'Fresh')).toBeGreaterThan(baselineFresh + 5);
    expect(demoRadarAxes(raised.concentrate).map((axis) => axis.id)).toEqual([
      ...DEMO_FAMILY_ORDER,
    ]);
  });

  it('raises Woody, Amber, and Animalic without moving the other sliders', () => {
    const cases = [
      ['isoe', 'Woody'],
      ['ambroxan', 'Amber'],
      ['musk', 'Animalic'],
    ] as const;
    for (const [id, family] of cases) {
      const baselineShare = familyShare(deriveComposeDemo(BASELINE).concentrate, family);
      const next = applySlider(id, sliderCeiling(id), BASELINE);
      const state = deriveComposeDemo(next);
      expect(next[id]).toBeCloseTo(sliderCeiling(id), 6);
      for (const other of DEMO_ADJUSTABLE_IDS) {
        if (other === id) continue;
        expect(next[other]).toBeCloseTo(BASELINE[other], 6);
      }
      expect(familyShare(state.concentrate, family)).toBeGreaterThan(baselineShare + 20);
      expect(state.batchGrams).toBeCloseTo(DEMO_BATCH_GRAMS, 6);
      expect(state.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBeCloseTo(
        0.42,
        6,
      );
    }
  });

  it('lets every slider sit on its own ceiling at the same time', () => {
    let next = BASELINE;
    for (const id of DEMO_ADJUSTABLE_IDS) next = applySlider(id, sliderCeiling(id), next);
    for (const id of DEMO_ADJUSTABLE_IDS) {
      expect(next[id]).toBeCloseTo(sliderCeiling(id), 6);
    }
    const state = deriveComposeDemo(next);
    expect(state.batchGrams).toBeCloseTo(DEMO_BATCH_GRAMS, 6);
    expect(state.remainderGrams).toBeGreaterThan(0);
  });

  it('keeps the hidden lines when every slider is at zero', () => {
    const state = deriveComposeDemo(zeroed());
    expect(state.edge).toBe('allMin');
    expect(state.batchGrams).toBeCloseTo(DEMO_BATCH_GRAMS, 6);
    for (const id of DEMO_ADJUSTABLE_IDS) {
      expect(state.concentrate.find((line) => line.id === id)?.amountGrams).toBe(0);
    }
    expect(state.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBeCloseTo(
      0.42,
      6,
    );
    expect(demoRadarAxes(state.concentrate).some((axis) => axis.value > 0)).toBe(true);
  });

  it('does not throw when the requested doses exceed the example concentrate', () => {
    const greedy = Object.fromEntries(
      DEMO_ADJUSTABLE_IDS.map((id) => [id, BASELINE[id] * 2.5]),
    ) as Amounts;
    const sum = DEMO_ADJUSTABLE_IDS.reduce((total, id) => total + greedy[id], 0);
    expect(sum).toBeGreaterThan(CONCENTRATE_TARGET);
    const state = deriveComposeDemo(greedy);
    expect(state.batchGrams).toBeCloseTo(DEMO_BATCH_GRAMS, 5);
    expect(state.edge).toBe('none');
    expect(state.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBeCloseTo(
      0.42,
      6,
    );
    for (const id of DEMO_ADJUSTABLE_IDS) {
      expect(state.amounts[id]).toBeCloseTo(clampAmount(id, greedy[id]), 6);
    }
  });

  it('lets a slider reach a stepped ceiling without touching the other lines', () => {
    const id = 'musk' as const;
    const ceiling = sliderCeiling(id);
    expect(ceiling).toBeGreaterThan(0);
    expect(ceiling * 100).toBeCloseTo(Math.round(ceiling * 100), 8);
    const next = applySlider(id, ceiling, BASELINE);
    const filled = deriveComposeDemo(next);
    expect(next[id]).toBeCloseTo(ceiling, 6);
    expect(next.bergamot).toBeCloseTo(BASELINE.bergamot, 6);
    expect(filled.batchGrams).toBeCloseTo(DEMO_BATCH_GRAMS, 6);
    expect(filled.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBeCloseTo(
      0.42,
      6,
    );
  });

  it('keeps every other slider when one line is raised to its ceiling', () => {
    const next = applySlider('ambroxan', 99, BASELINE);
    expect(next.ambroxan).toBeCloseTo(sliderCeiling('ambroxan'), 6);
    expect(next.bergamot).toBeCloseTo(BASELINE.bergamot, 6);
    expect(next.musk).toBeCloseTo(BASELINE.musk, 6);
    expect(deriveComposeDemo(next).batchGrams).toBeCloseTo(DEMO_BATCH_GRAMS, 6);
  });

  it('leaves the other lines alone when a slider drops', () => {
    const dropped = applySlider('bergamot', 0, BASELINE);
    expect(dropped.linalool).toBeCloseTo(BASELINE.linalool, 6);
    const state = deriveComposeDemo(dropped);
    expect(state.concentrate.find((line) => line.id === 'hedione')?.amountGrams).toBeCloseTo(
      0.42,
      6,
    );
    expect(familyShare(state.concentrate, 'Fresh')).toBeLessThan(
      familyShare(deriveComposeDemo(BASELINE).concentrate, 'Fresh'),
    );
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
      expect(clampAmount(id, -1)).toBe(0);
      expect(clampAmount(id, sliderCeiling(id))).toBeCloseTo(sliderCeiling(id), 6);
      expect(clampAmount(id, 99)).toBeCloseTo(sliderCeiling(id), 6);
    }
  });
});
