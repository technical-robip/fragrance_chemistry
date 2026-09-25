import { useEffect, useRef, useState } from 'react';

export const WEIGH_TARGET_GRAMS = 0.62;
export const WEIGH_ACTUAL_GRAMS = 0.684;
/** Pour duration when motion is allowed (ms). */
export const WEIGH_POUR_MS = 2800;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Ease-in-out cubic: readable growth through the middle of the pour. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** @deprecated prefer easeInOutCubic — kept for tests that named the old curve. */
export function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

export function pourGramsAt(progress01: number, finalGrams = WEIGH_ACTUAL_GRAMS): number {
  return finalGrams * easeInOutCubic(progress01);
}

/**
 * When `active` becomes true (section in view), eases pan grams from 0 → final.
 * Reduced motion jumps to the final reading. Leaving the section (`active`
 * false) resets to 0 so returning to Weigh replays the pour.
 */
export function usePourGrams(
  active: boolean,
  finalGrams = WEIGH_ACTUAL_GRAMS,
  durationMs = WEIGH_POUR_MS,
): number {
  const [grams, setGrams] = useState(() => (prefersReducedMotion() ? finalGrams : 0));
  const started = useRef(false);

  useEffect(() => {
    if (!active) {
      started.current = false;
      if (!prefersReducedMotion()) setGrams(0);
      return;
    }
    if (started.current) return;
    started.current = true;

    if (prefersReducedMotion()) {
      setGrams(finalGrams);
      return;
    }

    setGrams(0);
    const start = performance.now();
    let raf = 0;

    function frame(now: number) {
      const t = (now - start) / durationMs;
      if (t >= 1) {
        setGrams(finalGrams);
        return;
      }
      setGrams(pourGramsAt(t, finalGrams));
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, finalGrams, durationMs]);

  return grams;
}
