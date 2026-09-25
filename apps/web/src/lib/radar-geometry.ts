export type RadarMargin = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/** Recharts RadarChart default outerRadius. */
export const RADAR_OUTER_PCT = 0.8;

export function radarPolarOrigin(
  size: { width: number; height: number },
  margin: RadarMargin,
): { x: number; y: number } {
  const innerW = size.width - margin.left - margin.right;
  const innerH = size.height - margin.top - margin.bottom;
  return {
    x: margin.left + innerW / 2,
    y: margin.top + innerH / 2,
  };
}

export function radarMaxRadius(
  size: { width: number; height: number },
  margin: RadarMargin,
  outerPct = RADAR_OUTER_PCT,
): number {
  const innerW = Math.max(0, size.width - margin.left - margin.right);
  const innerH = Math.max(0, size.height - margin.top - margin.bottom);
  return (Math.min(innerW, innerH) / 2) * outerPct;
}

/** Recharts RadarChart: startAngle 90°, clockwise. Index 0 is the top axis. */
export function radarAxisAngleRad(index: number, axisCount: number): number {
  if (axisCount <= 0) return -Math.PI / 2;
  return -Math.PI / 2 + (2 * Math.PI * index) / axisCount;
}

export function angleFromOrigin(
  point: { x: number; y: number },
  origin: { x: number; y: number },
  fallbackRad: number,
): number {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  if (dx * dx + dy * dy < 1) return fallbackRad;
  return Math.atan2(dy, dx);
}

export function valueAlongRadarAxis({
  pointer,
  origin,
  axisAngleRad,
  maxRadius,
  domainMax,
  min = 0,
  step = 0.5,
}: {
  pointer: { x: number; y: number };
  origin: { x: number; y: number };
  axisAngleRad: number;
  maxRadius: number;
  domainMax: number;
  min?: number;
  step?: number;
}): number {
  if (maxRadius <= 0 || domainMax <= 0) return min;
  const ux = Math.cos(axisAngleRad);
  const uy = Math.sin(axisAngleRad);
  const projected = (pointer.x - origin.x) * ux + (pointer.y - origin.y) * uy;
  const raw = (projected / maxRadius) * domainMax;
  const clamped = Math.min(domainMax, Math.max(min, raw));
  const stepped = Math.round(clamped / step) * step;
  return Math.min(domainMax, Math.max(min, Number(stepped.toFixed(2))));
}

/**
 * Convert a pointer movement along a locked axis into a new radar value.
 * A zero-length move returns `startValue` (clicks on a vertex must not snap).
 */
export function valueAlongRadarAxisFromDelta({
  startValue,
  pointer,
  startPointer,
  axisAngleRad,
  maxRadius,
  domainMax,
  min = 0,
  step = 0.5,
}: {
  startValue: number;
  pointer: { x: number; y: number };
  startPointer: { x: number; y: number };
  axisAngleRad: number;
  maxRadius: number;
  domainMax: number;
  min?: number;
  step?: number;
}): number {
  if (maxRadius <= 0 || domainMax <= 0) return min;
  const ux = Math.cos(axisAngleRad);
  const uy = Math.sin(axisAngleRad);
  const dProj = (pointer.x - startPointer.x) * ux + (pointer.y - startPointer.y) * uy;
  const raw = startValue + (dProj / maxRadius) * domainMax;
  const clamped = Math.min(domainMax, Math.max(min, raw));
  const stepped = Math.round(clamped / step) * step;
  return Math.min(domainMax, Math.max(min, Number(stepped.toFixed(2))));
}

export function nudgeRadarValue(
  current: number,
  key: string,
  shiftKey: boolean,
  domainMax: number,
  { step = 0.5, largeStep = 5 }: { step?: number; largeStep?: number } = {},
): number | null {
  const delta = shiftKey ? largeStep : step;
  let next = current;
  if (key === 'ArrowUp' || key === 'ArrowRight') next = current + delta;
  else if (key === 'ArrowDown' || key === 'ArrowLeft') next = current - delta;
  else if (key === 'Home') next = domainMax;
  else if (key === 'End') next = 0;
  else return null;
  return Math.min(domainMax, Math.max(0, Number(next.toFixed(2))));
}
