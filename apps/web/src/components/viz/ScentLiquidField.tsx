import { useEffect, useRef } from 'react';
import styles from './ScentLiquidField.module.css';

/**
 * Dashboard header atmosphere: luminous orbs parked at the corners, plus
 * slow glass rings. Pointer parallax is tiny so type never gets covered.
 */
export function ScentLiquidField() {
  const layerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0.5, y: 0.28 });

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const layer = layerRef.current;
    if (!layer || reduced) return;

    const onMove = (e: PointerEvent) => {
      const rect = layer.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pointer.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    const nodes = [...layer.querySelectorAll<HTMLElement>('[data-shift]')];
    const depths = nodes.map((n) => Number(n.dataset.depth ?? 0.02));

    const frame = () => {
      const px = pointer.current.x - 0.5;
      const py = pointer.current.y - 0.35;
      nodes.forEach((node, i) => {
        const d = depths[i] ?? 0.02;
        node.style.setProperty('--shift-x', `${px * d * 90}px`);
        node.style.setProperty('--shift-y', `${py * d * 50}px`);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <div className={styles.wrap} ref={layerRef} aria-hidden>
      <span data-shift data-depth="0.04" className={`${styles.orb} ${styles.orbTop}`} />
      <span data-shift data-depth="0.025" className={`${styles.orb} ${styles.orbHeart}`} />
      <span data-shift data-depth="0.018" className={`${styles.orb} ${styles.orbBase}`} />
      <span data-shift data-depth="0.03" className={`${styles.ring} ${styles.ringOuter}`} />
      <span data-shift data-depth="0.02" className={`${styles.ring} ${styles.ringInner}`} />
      <div className={styles.veil} />
    </div>
  );
}
