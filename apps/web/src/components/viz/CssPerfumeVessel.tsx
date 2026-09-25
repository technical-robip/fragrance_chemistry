import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { pctFromPointer } from '@/lib/pyramid-geometry';
import styles from './CssPerfumeVessel.module.css';

const LIQUID_OVERHANG_PX = 14;
const SPLASH_MS = 1900;

export function CssPerfumeVessel({
  levelPct,
  label = 'FRAGRANCE CHEMISTRY',
  juiceClassLabel,
  costLabel,
  costHref,
  editable = false,
  onLevelChange,
  onCommit,
  min = 1,
  max = 100,
  step = 0.5,
  compact = false,
  open = false,
}: {
  levelPct: number;
  label?: string;
  juiceClassLabel?: string;
  costLabel?: string;
  costHref?: string;
  editable?: boolean;
  onLevelChange?: (pct: number) => void;
  onCommit?: (pct: number) => void;
  min?: number;
  max?: number;
  step?: number;
  compact?: boolean;
  /** Lift the cap so the CSS fallback can show concentrate vs a packaged unit. */
  open?: boolean;
  /** @deprecated percentage is shown via the liquid-level callout */
  meta?: string;
}) {
  const level = Math.max(min, Math.min(max, levelPct));
  const bottleRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const hovered = useRef(false);
  const latest = useRef(level);
  const skipLevelSplash = useRef(true);
  const splashTimer = useRef<number>(0);
  const settleTimer = useRef<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [stirring, setStirring] = useState(false);
  const [splash, setSplash] = useState(false);

  useEffect(() => {
    latest.current = level;
  }, [level]);

  const triggerSplash = useCallback(() => {
    setSplash(false);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSplash(true));
    });
    window.clearTimeout(splashTimer.current);
    splashTimer.current = window.setTimeout(() => setSplash(false), SPLASH_MS);
  }, []);

  const startStir = useCallback(
    (withSplash: boolean) => {
      setStirring(true);
      if (withSplash) triggerSplash();
    },
    [triggerSplash],
  );

  const stopStirIfIdle = useCallback(() => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!dragging.current) setStirring(false);
    }, 480);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(splashTimer.current);
      window.clearTimeout(settleTimer.current);
    };
  }, []);

  useEffect(() => {
    if (skipLevelSplash.current) {
      skipLevelSplash.current = false;
      return;
    }
    if (dragging.current || hovered.current) return;
    startStir(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!dragging.current) setStirring(false);
    }, SPLASH_MS);
  }, [level, startStir]);

  const applyFromClientY = useCallback(
    (clientY: number) => {
      const rect = bottleRef.current?.getBoundingClientRect();
      if (!rect) return latest.current;
      const next = pctFromPointer(clientY, rect, { min, max, step });
      latest.current = next;
      onLevelChange?.(next);
      return next;
    },
    [max, min, onLevelChange, step],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    startStir(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    applyFromClientY(e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!editable || !dragging.current) return;
    applyFromClientY(e.clientY);
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!editable || !dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    onCommit?.(latest.current);
    stopStirIfIdle();
  };

  const onPointerEnter = () => {
    hovered.current = true;
    startStir(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!dragging.current) setStirring(false);
    }, SPLASH_MS);
  };

  const onPointerLeave = () => {
    hovered.current = false;
    if (!dragging.current) stopStirIfIdle();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!editable) return;
    let next = latest.current;
    if (e.key === 'ArrowUp') next = Math.min(max, next + (e.shiftKey ? 5 : step));
    else if (e.key === 'ArrowDown') next = Math.max(min, next - (e.shiftKey ? 5 : step));
    else if (e.key === 'Home') next = max;
    else if (e.key === 'End') next = min;
    else return;
    e.preventDefault();
    const changed = Number(next.toFixed(2)) !== latest.current;
    latest.current = Number(next.toFixed(2));
    if (changed) skipLevelSplash.current = true;
    onLevelChange?.(latest.current);
    onCommit?.(latest.current);
    startStir(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      if (!dragging.current) setStirring(false);
    }, SPLASH_MS);
  };

  return (
    <div
      className={`${styles.wrap} ${compact ? styles.wrapCompact : ''}`}
      aria-label={`Concentrate ${level.toFixed(0)} percent`}
    >
      <div className={styles.stage}>
        <div className={`${styles.cap} ${open ? styles.capOpen : ''}`.trim()} />
        <div className={styles.neck} />
        <div
          className={`${styles.bottle} ${editable ? styles.bottleEditable : ''} ${stirring ? styles.bottleStirring : ''}`}
          ref={bottleRef}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onPointerDown={editable ? onPointerDown : undefined}
          onPointerMove={editable ? onPointerMove : undefined}
          onPointerUp={editable ? endDrag : undefined}
          onPointerCancel={editable ? endDrag : undefined}
        >
          <div className={styles.bottleClip}>
            <div
              className={`${styles.liquid} ${splash ? styles.liquidSplash : ''}`}
              style={{
                height: `calc(${level}% + ${LIQUID_OVERHANG_PX}px)`,
                transition: isDragging ? 'none' : undefined,
              }}
            >
              <span className={styles.waveYellow} aria-hidden />
            </div>
          </div>
          <div className={styles.shine} />
          <div className={styles.label}>
            <span>{label}</span>
          </div>
          <div
            className={`${styles.levelCallout} ${editable ? styles.levelCalloutEditable : ''}`}
            style={{ bottom: `${level}%` }}
            role={editable ? 'slider' : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-valuemin={editable ? min : undefined}
            aria-valuemax={editable ? max : undefined}
            aria-valuenow={editable ? level : undefined}
            aria-label={editable ? 'Concentrate percent' : undefined}
            onKeyDown={editable ? onKeyDown : undefined}
            onPointerDown={
              editable
                ? (e) => {
                    e.stopPropagation();
                    onPointerDown(e);
                  }
                : undefined
            }
          >
            <span className={styles.levelDot} />
            <span className={styles.levelLine} aria-hidden />
            <strong className={styles.levelValue}>{level.toFixed(0)}%</strong>
          </div>
        </div>
        <div className={styles.shadow} />
      </div>
      {(juiceClassLabel || costLabel) && (
        <div className={styles.productMeta}>
          {juiceClassLabel ? <span className={styles.metaText}>{juiceClassLabel}</span> : null}
          {costHref && costLabel ? (
            <Link to={costHref} className={styles.costChip}>
              {costLabel}
            </Link>
          ) : costLabel ? (
            <span className={styles.costChip}>{costLabel}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
