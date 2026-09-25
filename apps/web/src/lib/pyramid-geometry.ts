export type PyramidSliceInput = {
  id: string;
  percent: number;
};

export type PyramidSlice = {
  id: string;
  y0: number;
  y1: number;
  halfTop: number;
  halfBottom: number;
  height: number;
  percent: number;
};

export type PyramidGeometryOpts = {
  height?: number;
  halfWidth?: number;
  apexY?: number;
  gap?: number;
  cx?: number;
};

/**
 * Apex at top; width grows linearly with depth so each tier is a trapezoid
 * (top tier is a triangle). Heights are proportional to percent share.
 */
export function pyramidSlices(
  tiers: PyramidSliceInput[],
  { height = 168, halfWidth = 96, apexY = 16, gap = 3, cx = 120 }: PyramidGeometryOpts = {},
): Array<PyramidSlice & { points: string; labelY: number; showLabel: boolean }> {
  const positive = tiers.filter((t) => t.percent > 0);
  const total = positive.reduce((s, t) => s + t.percent, 0) || 1;
  let y = apexY;
  const halfAt = (yy: number) => ((yy - apexY) / height) * halfWidth;

  return positive.map((t, idx) => {
    const h = (t.percent / total) * height;
    const y0 = y;
    const y1 = y + h;
    y = y1;
    const isLast = idx === positive.length - 1;
    const drawBottom = isLast ? y1 : Math.max(y0 + 1, y1 - gap);
    const halfTop = halfAt(y0);
    const halfBottom = halfAt(drawBottom);
    const sliceH = drawBottom - y0;
    const points = [
      `${cx - halfTop},${y0}`,
      `${cx + halfTop},${y0}`,
      `${cx + halfBottom},${drawBottom}`,
      `${cx - halfBottom},${drawBottom}`,
    ].join(' ');
    return {
      id: t.id,
      y0,
      y1: drawBottom,
      halfTop,
      halfBottom,
      height: sliceH,
      percent: t.percent,
      points,
      labelY: y0 + sliceH / 2 + 4,
      showLabel: sliceH >= 14,
    };
  });
}

export function pctFromPointer(
  clientY: number,
  rect: { top: number; height: number },
  { min = 1, max = 100, step = 0.5 }: { min?: number; max?: number; step?: number } = {},
): number {
  if (rect.height <= 0) return min;
  const raw = ((rect.top + rect.height - clientY) / rect.height) * 100;
  const clamped = Math.min(max, Math.max(min, raw));
  const stepped = Math.round(clamped / step) * step;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(2))));
}
