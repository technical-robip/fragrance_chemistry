/**
 * The landing surface is built as a lab reference manual: coloured section
 * boards with a translucent acetate leaf hinged over them, and a stepped tab
 * rail down the fore edge. Every division hue comes from the committed palette
 * in `tokens.css` — nothing new is introduced here.
 */
export const DIVISIONS = [
  { id: 'compose', hue: 'var(--fc-teal-400)', extent: 1 },
  { id: 'weigh', hue: 'var(--fc-note-top)', extent: 0.78 },
  { id: 'comply', hue: 'var(--fc-amber-400)', extent: 0.92 },
  { id: 'cost', hue: 'var(--fc-note-base)', extent: 0.7 },
  { id: 'evaluate', hue: 'var(--fc-teal-300)', extent: 0.85 },
] as const;

export type DivisionId = (typeof DIVISIONS)[number]['id'];

/** Formats a mass the way a lab notebook does: fixed decimals, never exponent. */
export function grams(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

/** Percent with one decimal, for line shares and allergen totals. */
export function percent(value: number, decimals = 1): string {
  return value.toFixed(decimals);
}
