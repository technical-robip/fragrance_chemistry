import { describe, expect, it } from 'vitest';
import { applyCostView, CAP_LIFT, CONCENTRATE_FILL, createFlaconModel } from './flacon-model';

describe('flacon cost view', () => {
  it('keeps the glass body seated and only lifts the closure on concentrate', () => {
    const model = createFlaconModel();
    applyCostView(model, 0);
    expect(model.tiers.juice.position.y).toBe(0);
    expect(model.tiers.packaged.position.y).toBeCloseTo(CAP_LIFT, 6);
    const juice = model.tiers.concentrate.getObjectByName('juice');
    expect(juice?.scale.y).toBeCloseTo(CONCENTRATE_FILL, 6);
  });

  it('seats the cap and fills the juice for the packaged unit', () => {
    const model = createFlaconModel();
    applyCostView(model, 1);
    expect(model.tiers.juice.position.y).toBe(0);
    expect(model.tiers.packaged.position.y).toBeCloseTo(0, 6);
    const juice = model.tiers.concentrate.getObjectByName('juice');
    expect(juice?.scale.y).toBeCloseTo(1, 6);
  });
});
