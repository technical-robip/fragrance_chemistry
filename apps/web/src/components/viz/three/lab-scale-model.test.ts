import { describe, expect, it } from 'vitest';
import { applyWeighFill, createFlaconModel } from './flacon-model';
import { applyWeighMass, createLabScaleModel } from './lab-scale-model';

describe('lab scale + weigh fill', () => {
  it('builds a top-pan scale with a clear flacon deck (no overhead beam)', () => {
    const scale = createLabScaleModel();
    expect(scale.pan.name).toBe('scale-pan');
    expect(scale.deck.name).toBe('flacon-deck');
    expect(scale.root.getObjectByName('scale-beam')).toBeUndefined();
    expect(scale.root.getObjectByName('pan-stem')).toBeUndefined();
    expect(scale.root.getObjectByName('scale-housing')).toBeTruthy();
    expect(scale.root.getObjectByName('pan-column')).toBeTruthy();
    expect(scale.pan.getObjectByName('pan-disc')).toBeTruthy();
    // Pan centred on the plinth — not pushed past the housing toward the camera.
    expect(scale.pan.position.z).toBe(0);
    expect(scale.pan.position.y).toBeGreaterThan(0.3);
  });

  it('lowers the pan as mass increases', () => {
    const scale = createLabScaleModel();
    const rest = scale.pan.position.y;
    applyWeighMass(scale, 0);
    expect(scale.pan.position.y).toBeCloseTo(rest, 5);
    applyWeighMass(scale, 1);
    expect(scale.pan.position.y).toBeLessThan(rest);
  });

  it('keeps the neck on the bottle and scales juice with fill', () => {
    const model = createFlaconModel();
    applyWeighFill(model, 0);
    expect(model.tiers.packaged.visible).toBe(true);
    expect(model.tiers.juice.getObjectByName('weighNeck')).toBeUndefined();
    expect(model.tiers.juice.getObjectByName('shoulderAssembly')?.visible).toBe(true);
    expect(model.tiers.packaged.getObjectByName('collar')?.visible).toBe(true);
    expect(model.tiers.packaged.getObjectByName('cap')?.visible).toBe(false);
    const juice = model.tiers.concentrate.getObjectByName('juice');
    expect(juice?.visible).toBe(false);

    applyWeighFill(model, 1);
    expect(juice?.visible).toBe(true);
    expect(juice?.scale.y).toBeCloseTo(0.45, 5);

    applyWeighFill(model, 0.684 / 0.62);
    expect(juice!.scale.y).toBeGreaterThan(0.45);
    expect(juice!.scale.y).toBeLessThanOrEqual(0.65);
  });
});
