import { describe, expect, it } from 'vitest';
import { updateAccountBodySchema } from './account';
import {
  DEFAULT_FAMILY_COLORS,
  FAMILY_COLOR_KEYS,
  deltaE76,
  familyColorVariable,
  familyColorsSchema,
} from './family-colors';

describe('default family colors', () => {
  it('keeps every pair far enough apart to tell the swatches apart', () => {
    const close: string[] = [];
    for (let i = 0; i < FAMILY_COLOR_KEYS.length; i++) {
      for (let j = i + 1; j < FAMILY_COLOR_KEYS.length; j++) {
        const left = FAMILY_COLOR_KEYS[i]!;
        const right = FAMILY_COLOR_KEYS[j]!;
        const distance = deltaE76(DEFAULT_FAMILY_COLORS[left], DEFAULT_FAMILY_COLORS[right]);
        if (distance < 25) close.push(`${left}/${right} ${distance.toFixed(1)}`);
      }
    }
    expect(close).toEqual([]);
  });

  it('names each stylesheet variable and measures identical colors as zero', () => {
    expect(familyColorVariable('Floral')).toBe('--fc-family-floral');
    expect(deltaE76('#000000', '#000000')).toBe(0);
    expect(deltaE76('#ffffff', '#010101')).toBeGreaterThan(0);
  });

  it('accepts a full scheme or a reset and rejects a partial one', () => {
    expect(familyColorsSchema.parse(DEFAULT_FAMILY_COLORS)).toEqual(DEFAULT_FAMILY_COLORS);
    expect(updateAccountBodySchema.parse({ familyColors: null })).toEqual({ familyColors: null });
    expect(
      updateAccountBodySchema.parse({ familyColors: DEFAULT_FAMILY_COLORS }).familyColors,
    ).toEqual(DEFAULT_FAMILY_COLORS);
    expect(() => familyColorsSchema.parse({ Floral: '#fff' })).toThrow();
    expect(() =>
      familyColorsSchema.parse({ ...DEFAULT_FAMILY_COLORS, Extra: '#112233' }),
    ).toThrow();
  });
});
