import { useEffect, useRef, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import type { RadarAxis } from '@/lib/formula-viz';
import { familyHue } from '@/lib/formula-viz';
import {
  angleFromOrigin,
  nudgeRadarValue,
  radarAxisAngleRad,
  radarMaxRadius,
  radarPolarOrigin,
  valueAlongRadarAxisFromDelta,
  type RadarMargin,
} from '@/lib/radar-geometry';
import styles from './NotesRadar.module.css';

export type RadarOverlaySeries = {
  id: string;
  label: string;
  values: Record<string, number>;
  stroke: string;
  fill: string;
  fillOpacity: number;
  strokeDasharray?: string;
  strokeWidth?: number;
};

const CHART_MARGIN: RadarMargin = { top: 16, right: 24, bottom: 16, left: 24 };
const CHART_MARGIN_COMPACT: RadarMargin = { top: 12, right: 16, bottom: 12, left: 16 };
const CHART_MARGIN_MINI: RadarMargin = { top: 4, right: 4, bottom: 4, left: 4 };

type RadarDotProps = {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: RadarAxis;
};

function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: pt.x, y: pt.y };
}

export function NotesRadar({
  axes,
  series,
  showLegend = true,
  hideLabels = false,
  activeId = null,
  highlightIds,
  onSelect,
  emptyLabel,
  compact = false,
  mini = false,
  editable = false,
  animate,
  onAxisChange,
  onAxisCommit,
  valueMax,
}: {
  axes: RadarAxis[];
  series?: RadarOverlaySeries[];
  showLegend?: boolean;
  hideLabels?: boolean;
  activeId?: string | null;
  highlightIds?: string[] | null;
  onSelect?: (id: string | null) => void;
  emptyLabel?: string;
  compact?: boolean;
  mini?: boolean;
  editable?: boolean;
  /** Defaults to on for read-only charts, off while a visitor is dragging. */
  animate?: boolean;
  onAxisChange?: (id: string, value: number) => void;
  onAxisCommit?: (id: string, value: number) => void;
  valueMax?: number;
}) {
  const overlay = !editable && series && series.length > 0;
  const data = axes.map((a) => {
    const row: Record<string, string | number> = {
      ...a,
      axis: a.label,
      color: familyHue(a.id),
      value: a.value,
    };
    if (overlay) {
      for (const layer of series) {
        row[layer.id] = layer.values[a.id] ?? 0;
      }
    }
    return row;
  });
  const highlightSet = new Set(highlightIds ?? []);
  const highlighting = highlightSet.size > 0;
  const overlayPeak = overlay ? series.flatMap((layer) => Object.values(layer.values)) : [];
  const domainMax =
    valueMax ??
    (editable ? 100 : Math.max(...data.map((d) => Number(d.value) || 0), ...overlayPeak, 1));
  const margin = mini ? CHART_MARGIN_MINI : compact ? CHART_MARGIN_COMPACT : CHART_MARGIN;
  const [dragging, setDragging] = useState(false);
  const axisCount = data.length;
  const onAxisChangeRef = useRef(onAxisChange);
  const onAxisCommitRef = useRef(onAxisCommit);
  onAxisChangeRef.current = onAxisChange;
  onAxisCommitRef.current = onAxisCommit;

  const drag = useRef<{
    id: string;
    axisAngleRad: number;
    maxRadius: number;
    svg: SVGSVGElement;
    startValue: number;
    startPointer: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const dragListeners = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  function detachDrag() {
    if (dragListeners.current) {
      window.removeEventListener('pointermove', dragListeners.current.move);
      window.removeEventListener('pointerup', dragListeners.current.up);
      window.removeEventListener('pointercancel', dragListeners.current.up);
      dragListeners.current = null;
    }
    drag.current = null;
    setDragging(false);
  }

  useEffect(() => detachDrag, []);

  function valueFromPointer(e: PointerEvent | React.PointerEvent) {
    const session = drag.current;
    if (!session) return null;
    const pointer = clientToSvg(session.svg, e.clientX, e.clientY);
    return valueAlongRadarAxisFromDelta({
      startValue: session.startValue,
      pointer,
      startPointer: session.startPointer,
      axisAngleRad: session.axisAngleRad,
      maxRadius: session.maxRadius,
      domainMax,
    });
  }

  function beginDrag(e: React.PointerEvent<SVGGElement>, dot: RadarDotProps) {
    if (!editable) return;
    const { cx, cy, payload, index = 0 } = dot;
    if (
      payload == null ||
      cx == null ||
      cy == null ||
      !Number.isFinite(cx) ||
      !Number.isFinite(cy)
    ) {
      return;
    }
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus();

    const size = {
      width: svg.clientWidth || svg.getBoundingClientRect().width,
      height: svg.clientHeight || svg.getBoundingClientRect().height,
    };
    const origin = radarPolarOrigin(size, margin);
    const fallback = radarAxisAngleRad(index, axisCount);
    const axisAngleRad = angleFromOrigin({ x: cx, y: cy }, origin, fallback);
    const layoutMax = radarMaxRadius(size, margin);
    const dist = Math.hypot(cx - origin.x, cy - origin.y);
    const maxRadius = payload.value > 0.5 ? (dist * domainMax) / payload.value : layoutMax;
    const startPointer = clientToSvg(svg, e.clientX, e.clientY);

    drag.current = {
      id: payload.id,
      axisAngleRad,
      maxRadius,
      svg,
      startValue: payload.value,
      startPointer,
      moved: false,
    };
    setDragging(true);

    const move = (ev: PointerEvent) => {
      const session = drag.current;
      if (!session) return;
      const travel = Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY);
      if (!session.moved && travel < 4) return;
      session.moved = true;
      const next = valueFromPointer(ev);
      if (next == null) return;
      onAxisChangeRef.current?.(session.id, next);
    };
    const up = (ev: PointerEvent) => {
      const session = drag.current;
      const moved = session?.moved ?? false;
      const id = session?.id;
      const next = moved ? valueFromPointer(ev) : null;
      detachDrag();
      if (!moved || next == null || !id) return;
      onAxisCommitRef.current?.(id, next);
    };
    dragListeners.current = { move, up };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function onDotKeyDown(e: React.KeyboardEvent<SVGGElement>, payload: RadarAxis) {
    if (!editable) return;
    const next = nudgeRadarValue(payload.value, e.key, e.shiftKey, domainMax);
    if (next == null) return;
    e.preventDefault();
    onAxisChangeRef.current?.(payload.id, next);
    onAxisCommitRef.current?.(payload.id, next);
  }

  function isLit(id: string) {
    return highlighting && highlightSet.has(id);
  }
  function isDim(id: string) {
    return highlighting && !highlightSet.has(id);
  }

  function renderDot(props: RadarDotProps) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || payload == null) return null;
    const dim = isDim(payload.id);
    const lit = isLit(payload.id);
    if (!editable) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={lit ? 5 : 3}
          fill="var(--fc-accent-soft)"
          opacity={dim ? 0.28 : 1}
        />
      );
    }
    return (
      <g
        className={styles.dotHit}
        tabIndex={0}
        focusable="true"
        role="slider"
        aria-label={payload.label}
        aria-valuemin={0}
        aria-valuemax={domainMax}
        aria-valuenow={Number(payload.value.toFixed(1))}
        aria-valuetext={`${payload.value.toFixed(1)}%`}
        opacity={dim ? 0.28 : 1}
        onPointerDown={(e) => beginDrag(e, props)}
        onKeyDown={(e) => onDotKeyDown(e, payload)}
      >
        <circle className={styles.dotHitArea} cx={cx} cy={cy} r={14} />
        <circle className={styles.dot} cx={cx} cy={cy} r={lit ? 7 : 5} />
      </g>
    );
  }

  if (data.length === 0) {
    return <p className={styles.empty}>{emptyLabel ?? '—'}</p>;
  }

  return (
    <div
      className={`${styles.wrap} ${compact ? styles.wrapCompact : ''} ${mini ? styles.wrapMini : ''} ${dragging ? styles.dragging : ''}`.trim()}
    >
      <div className={`${styles.chart} ${editable ? styles.chartInteractive : ''}`.trim()}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={margin}>
            <PolarGrid stroke="color-mix(in srgb, var(--fc-text) 22%, transparent)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={
                hideLabels || mini
                  ? false
                  : (((props: {
                      x?: number;
                      y?: number;
                      textAnchor?: string;
                      index?: number;
                      payload?: { value?: string };
                    }) => {
                      const item = axes[props.index ?? 0];
                      const dim = item ? isDim(item.id) : false;
                      return (
                        <text
                          x={props.x}
                          y={props.y}
                          textAnchor={
                            props.textAnchor === 'start' ||
                            props.textAnchor === 'middle' ||
                            props.textAnchor === 'end'
                              ? props.textAnchor
                              : 'middle'
                          }
                          fill={item ? familyHue(item.id) : 'var(--fc-text)'}
                          fontSize={compact ? 10 : 12}
                          fontWeight={600}
                          opacity={dim ? 0.32 : 1}
                        >
                          {props.payload?.value}
                        </text>
                      );
                    }) as never)
              }
            />
            <PolarRadiusAxis angle={30} domain={[0, domainMax]} tick={false} axisLine={false} />
            {overlay && series ? (
              series.map((layer) => (
                <Radar
                  key={layer.id}
                  name={layer.label}
                  dataKey={layer.id}
                  stroke={layer.stroke}
                  fill={layer.fill}
                  fillOpacity={layer.fillOpacity}
                  strokeWidth={layer.strokeWidth ?? 2}
                  strokeDasharray={layer.strokeDasharray}
                  isAnimationActive={animate ?? true}
                  dot={false}
                  legendType="none"
                />
              ))
            ) : (
              <Radar
                name="Families"
                dataKey="value"
                stroke="var(--fc-accent-soft)"
                fill="var(--fc-accent)"
                fillOpacity={mini ? 0.45 : 0.35}
                strokeWidth={mini ? 1.5 : 2}
                isAnimationActive={animate ?? !editable}
                dot={editable ? renderDot : false}
                activeDot={editable ? false : undefined}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      {showLegend ? (
        <ul className={styles.legend}>
          {axes.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={`${styles.legendBtn} ${activeId === d.id ? styles.legendActive : ''} ${isLit(d.id) ? styles.legendLit : ''} ${isDim(d.id) ? styles.legendDim : ''}`.trim()}
                data-highlighted={isLit(d.id) ? 'true' : undefined}
                onClick={() => onSelect?.(activeId === d.id ? null : d.id)}
                aria-pressed={activeId === d.id}
              >
                <span style={{ background: familyHue(d.id) }} />
                <strong>{d.label}</strong>
                <em>{d.value.toFixed(1)}%</em>
              </button>
            </li>
          ))}
        </ul>
      ) : onSelect ? (
        <div className={styles.hitRow} role="group" aria-label="Family filters">
          {axes.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`${styles.hit} ${activeId === d.id ? styles.legendActive : ''} ${isLit(d.id) ? styles.legendLit : ''} ${isDim(d.id) ? styles.legendDim : ''}`.trim()}
              onClick={() => onSelect(activeId === d.id ? null : d.id)}
              aria-pressed={activeId === d.id}
            >
              {d.label} {d.value.toFixed(0)}%
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
