import { z } from 'zod';

export const FAMILY_COLOR_KEYS = [
  'Citrus',
  'Fresh',
  'Green',
  'Floral',
  'Amber',
  'Oriental',
  'Woody',
  'Gourmand',
  'Animalic',
  'Special',
] as const;

export type FamilyColorKey = (typeof FAMILY_COLOR_KEYS)[number];
export type FamilyColors = Record<FamilyColorKey, string>;

/** One mid-lightness hue per family, readable on both lab themes. */
export const DEFAULT_FAMILY_COLORS: FamilyColors = {
  Citrus: '#e6c14a',
  Fresh: '#32c4b6',
  Green: '#308a52',
  Floral: '#e45d8c',
  Amber: '#e8882e',
  Oriental: '#c44a38',
  Woody: '#806044',
  Gourmand: '#d9a08a',
  Animalic: '#a07cc4',
  Special: '#5b8ef0',
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const familyColorsSchema = z
  .object({
    Citrus: hex,
    Fresh: hex,
    Green: hex,
    Floral: hex,
    Amber: hex,
    Oriental: hex,
    Woody: hex,
    Gourmand: hex,
    Animalic: hex,
    Special: hex,
  })
  .strict();

export function familyColorVariable(key: FamilyColorKey): string {
  return `--fc-family-${key.toLowerCase()}`;
}

function pivot(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(hexColor: string): [number, number, number] {
  const n = Number.parseInt(hexColor.slice(1), 16);
  const r = pivot((n >> 16) & 255);
  const g = pivot((n >> 8) & 255);
  const b = pivot(n & 255);
  const x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 distance. Small UI swatches need roughly 25 or more to stay distinct. */
export function deltaE76(a: string, b: string): number {
  const [l1, a1, b1] = rgbToLab(a);
  const [l2, a2, b2] = rgbToLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
