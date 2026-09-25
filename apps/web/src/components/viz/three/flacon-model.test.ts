import { describe, expect, it } from 'vitest';
import { applyCostView, CAP_LIFT, createFlaconModel } from './flacon-model';

describe('flacon cost view', () => {
  it('lifts the bottle and seats the flask for concentrate', () => {
    const model = createFlaconModel();
    applyCostView(model, 0);
    expect(model.vessel.position.y).toBeGreaterThan(1);
    expect(model.flask.position.y).toBeCloseTo(0, 5);
    expect(model.flask.visible).toBe(true);
    expect(model.tiers.packaged.position.y).toBeCloseTo(CAP_LIFT, 6);
  });

  it('seats the bottle and hides the flask for the packaged unit', () => {
    const model = createFlaconModel();
    applyCostView(model, 1);
    expect(model.vessel.position.y).toBeCloseTo(0, 5);
    expect(model.flask.visible).toBe(false);
    expect(model.tiers.packaged.position.y).toBeCloseTo(0, 6);
    const juice = model.tiers.concentrate.getObjectByName('juice');
    expect(juice?.scale.y).toBeCloseTo(1, 6);
  });

  it('clears the bottle before the flask has fully arrived', () => {
    const model = createFlaconModel();
    applyCostView(model, 0.5);
    expect(model.vessel.position.y).toBeGreaterThan(model.flask.position.y + 1);
  });
});
