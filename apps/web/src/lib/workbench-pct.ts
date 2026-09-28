export type PctMode = 'abs' | 'rel';

/** Rel is the line's share of the current absolute total. Abs is stored as-is. */
export function toDisplayPct(abs: number, totalAbs: number, mode: PctMode): number {
  if (mode === 'rel' && totalAbs > 0) return (abs / totalAbs) * 100;
  return abs;
}

/** Inverse of `toDisplayPct`. Rel edits keep the current absolute total as the base. */
export function fromDisplayPct(display: number, totalAbs: number, mode: PctMode): number {
  if (mode === 'rel' && totalAbs > 0) return (display / 100) * totalAbs;
  return display;
}

export function roundPct(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
