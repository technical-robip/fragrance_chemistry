import { useState } from 'react';
import { pyramidSlices } from '@/lib/pyramid-geometry';
import { CompositionLegend } from './CompositionLegend';
import styles from './FragrancePyramid.module.css';

export type FragrancePyramidTier = {
  id: 'top' | 'middle' | 'base';
  label: string;
  percent: number;
  notes?: string[];
};

type Props = {
  tiers: FragrancePyramidTier[];
  /** @deprecated kept for call-site compatibility */
  mode?: 'blocks' | 'svg';
  className?: string;
  legendPlacement?: 'below' | 'beside';
  /** Controlled sticky selection (click). When omitted, component manages its own. */
  activeId?: string | null;
  onSelect?: (id: string | null) => void;
  hoverId?: string | null;
  onHover?: (id: string | null) => void;
  showLegend?: boolean;
  /** Concatenated material names under the silhouette. Default: on when a selected tier has notes. */
  showNotes?: boolean;
  /** Juice-style percent callouts on the right edge. */
  showCallouts?: boolean;
  /** Smaller silhouette for dense cards (encyclopedia). */
  compact?: boolean;
};

const TIER_META = {
  top: { fill: 'var(--fc-note-top)', legend: 'var(--fc-note-top)' },
  middle: { fill: 'var(--fc-note-heart)', legend: 'var(--fc-note-heart)' },
  base: { fill: 'var(--fc-note-base)', legend: 'var(--fc-note-base)' },
} as const;

const VIEW_W = 240;
const VIEW_H = 200;
const CX = 120;

/**
 * Flat olfactory pyramid: tier heights proportional to percent share.
 * Tier names sit inside; percentages call out from the right edge like the juice bottle.
 */
export function FragrancePyramid({
  tiers,
  className,
  legendPlacement = 'below',
  activeId: controlledActive,
  onSelect,
  hoverId: controlledHover,
  onHover,
  showLegend = true,
  showCallouts = true,
  compact = false,
  showNotes: showNotesProp,
}: Props) {
  const [internalActive, setInternalActive] = useState<string | null>(null);
  const [internalHover, setInternalHover] = useState<string | null>(null);
  const active = controlledActive !== undefined ? controlledActive : internalActive;
  const hover =
    onHover || controlledHover !== undefined ? (controlledHover ?? null) : internalHover;
  const highlight = hover ?? active;

  const ordered = (['top', 'middle', 'base'] as const).map(
    (id) => tiers.find((t) => t.id === id) ?? { id, label: id, percent: 0, notes: [] as string[] },
  );
  const activeTier = ordered.find((t) => t.id === active);
  const showNotes = showNotesProp ?? (!compact && Boolean(activeTier?.notes?.length));

  const slices = pyramidSlices(
    ordered.map((t) => ({ id: t.id, percent: t.percent })),
    { height: 168, halfWidth: 96, apexY: 16, gap: 3, cx: CX },
  );

  function select(id: string) {
    const next = active === id ? null : id;
    if (onSelect) onSelect(next);
    else setInternalActive(next);
  }

  return (
    <div
      className={`${styles.wrap} ${compact ? styles.wrapCompact : ''} ${className ?? ''}`.trim()}
    >
      <div
        className={`${styles.layout} ${legendPlacement === 'beside' ? styles.layoutBeside : ''}`}
      >
        <div className={`${styles.stage} ${showCallouts ? '' : styles.stageNoCallouts}`.trim()}>
          <div className={styles.frame}>
            <svg
              className={styles.svg}
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              role="img"
              aria-label="Olfactory pyramid"
            >
              {slices.map((slice) => {
                const id = slice.id as 'top' | 'middle' | 'base';
                const dimmed = highlight != null && highlight !== id;
                const selected = active === id;
                const tier = ordered.find((t) => t.id === id);
                return (
                  <g
                    key={id}
                    className={styles.tier}
                    opacity={dimmed ? 0.4 : 1}
                    onMouseEnter={() => {
                      if (onHover) onHover(id);
                      else setInternalHover(id);
                    }}
                    onMouseLeave={() => {
                      if (onHover) onHover(null);
                      else setInternalHover(null);
                    }}
                    onClick={() => select(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        select(id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-pressed={selected}
                    aria-label={`${tier?.label ?? id} ${tier?.percent.toFixed(1) ?? 0}%`}
                  >
                    <polygon
                      points={slice.points}
                      fill={TIER_META[id].fill}
                      stroke={selected ? 'rgba(255,255,255,0.55)' : 'transparent'}
                      strokeWidth={selected ? 2 : 0}
                    />
                    {slice.showLabel && !compact ? (
                      <text x={CX} y={slice.labelY} textAnchor="middle" className={styles.tierName}>
                        {tier?.label ?? id}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {showCallouts
              ? slices.map((slice) => {
                  const id = slice.id as 'top' | 'middle' | 'base';
                  const tier = ordered.find((t) => t.id === id);
                  if (!tier || tier.percent <= 0) return null;
                  /* Dot sits on this tier’s right edge at mid-height — same idea as the bottle wall. */
                  const midHalf = (slice.halfTop + slice.halfBottom) / 2;
                  const edgeLeftPct = ((CX + midHalf) / VIEW_W) * 100;
                  const midTop = ((slice.y0 + slice.height / 2) / VIEW_H) * 100;
                  const dimmed = highlight != null && highlight !== id;
                  return (
                    <div
                      key={`callout-${id}`}
                      className={styles.callout}
                      style={{
                        left: `${edgeLeftPct}%`,
                        top: `${midTop}%`,
                        opacity: dimmed ? 0.4 : 1,
                      }}
                      aria-hidden
                    >
                      <span className={styles.calloutDot} />
                      <span className={styles.calloutLine} />
                      <strong className={styles.calloutValue}>{tier.percent.toFixed(1)}%</strong>
                    </div>
                  );
                })
              : null}
          </div>
        </div>

        {showLegend ? (
          <CompositionLegend
            items={ordered.map((tier) => ({
              id: tier.id,
              label: tier.label,
              percent: tier.percent,
              color: TIER_META[tier.id].legend,
            }))}
            activeId={active}
            onSelect={select}
            onHover={(id) => {
              if (onHover) onHover(id);
              else setInternalHover(id);
            }}
          />
        ) : null}
      </div>

      {showNotes ? (
        <div className={styles.notes} aria-live="polite">
          <strong>{activeTier?.label}</strong>
          <p>{activeTier?.notes?.join(' · ')}</p>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated use FragrancePyramid — kept so existing imports keep working */
export function OlfactoryPyramid(props: Props) {
  return <FragrancePyramid {...props} />;
}

export type PyramidTier = FragrancePyramidTier;
