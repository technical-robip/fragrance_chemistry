import { describe, expect, it } from 'vitest';
import {
  angleFromOrigin,
  radarAxisAngleRad,
  radarMaxRadius,
  radarPolarOrigin,
  valueAlongRadarAxis,
  valueAlongRadarAxisFromDelta,
  nudgeRadarValue,
} from './radar-geometry';

const margin = { top: 16, right: 24, bottom: 16, left: 24 };
const size = { width: 200, height: 200 };

describe('radarPolarOrigin', () => {
  it('centers in the plot area (symmetric margins → SVG midpoint)', () => {
    expect(radarPolarOrigin(size, margin)).toEqual({ x: 100, y: 100 });
  });
});

describe('radarMaxRadius', () => {
  it('uses 80% of the inner half-min dimension', () => {
    // inner 152 x 168 → min/2 = 76 → 80% = 60.8
    expect(radarMaxRadius(size, margin)).toBeCloseTo(60.8);
  });
});

describe('radarAxisAngleRad', () => {
  it('puts the first axis at the top and proceeds clockwise', () => {
    expect(radarAxisAngleRad(0, 4)).toBeCloseTo(-Math.PI / 2);
    expect(radarAxisAngleRad(1, 4)).toBeCloseTo(0);
    expect(radarAxisAngleRad(2, 4)).toBeCloseTo(Math.PI / 2);
  });
});

describe('angleFromOrigin', () => {
  it('falls back when the point sits on the origin', () => {
    expect(angleFromOrigin({ x: 100, y: 100 }, { x: 100, y: 100 }, 1.2)).toBe(1.2);
  });

  it('returns atan2 from origin to the point', () => {
    expect(angleFromOrigin({ x: 150, y: 100 }, { x: 100, y: 100 }, 0)).toBeCloseTo(0);
  });
});

describe('valueAlongRadarAxis', () => {
  const origin = { x: 100, y: 100 };
  const maxRadius = 50;
  const axisAngleRad = -Math.PI / 2; // up

  it('maps the origin to 0 and the outer ring to domainMax', () => {
    expect(
      valueAlongRadarAxis({
        pointer: origin,
        origin,
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 1,
      }),
    ).toBe(0);
    expect(
      valueAlongRadarAxis({
        pointer: { x: 100, y: 50 },
        origin,
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 1,
      }),
    ).toBe(100);
  });

  it('ignores motion perpendicular to the axis and snaps to step', () => {
    expect(
      valueAlongRadarAxis({
        pointer: { x: 140, y: 75 },
        origin,
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 0.5,
      }),
    ).toBe(50);
  });

  it('clamps past the rim and behind the origin', () => {
    expect(
      valueAlongRadarAxis({
        pointer: { x: 100, y: 0 },
        origin,
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 1,
      }),
    ).toBe(100);
    expect(
      valueAlongRadarAxis({
        pointer: { x: 100, y: 180 },
        origin,
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 1,
      }),
    ).toBe(0);
  });
});

describe('valueAlongRadarAxisFromDelta', () => {
  const origin = { x: 100, y: 100 };
  const axisAngleRad = -Math.PI / 2;
  const maxRadius = 50;

  it('keeps startValue when the pointer does not move', () => {
    expect(
      valueAlongRadarAxisFromDelta({
        startValue: 38,
        pointer: { x: 100, y: 81 },
        startPointer: { x: 100, y: 81 },
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 0.5,
      }),
    ).toBe(38);
  });

  it('adds the projected delta along the axis', () => {
    // 10px toward the rim (up) = 10/50 * 100 = +20
    expect(
      valueAlongRadarAxisFromDelta({
        startValue: 38,
        pointer: { x: 100, y: origin.y - 35 },
        startPointer: { x: 100, y: origin.y - 25 },
        axisAngleRad,
        maxRadius,
        domainMax: 100,
        step: 1,
      }),
    ).toBe(58);
  });
});

describe('nudgeRadarValue', () => {
  it('steps with arrows and jumps with Home/End', () => {
    expect(nudgeRadarValue(38, 'ArrowUp', false, 100)).toBe(38.5);
    expect(nudgeRadarValue(38, 'ArrowDown', true, 100)).toBe(33);
    expect(nudgeRadarValue(38, 'Home', false, 100)).toBe(100);
    expect(nudgeRadarValue(38, 'End', false, 100)).toBe(0);
    expect(nudgeRadarValue(38, 'a', false, 100)).toBeNull();
  });
});
