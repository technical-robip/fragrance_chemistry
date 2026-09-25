import { useEffect, useRef } from 'react';
import styles from './AuthAtmosphere.module.css';

type Molecule = {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  phase: number;
  swaySpeed: number;
  swayAmp: number;
  color: string;
  alpha: number;
};

type Mote = {
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  twinkleSpeed: number;
  baseAlpha: number;
};

/** RGB triplets matching FC note / accent tokens (canvas can't use CSS vars). */
const PALETTE = [
  '42,157,143', // teal accent
  '110,207,154', // note top
  '232,184,109', // note heart / amber
  '155,123,184', // note base
  '232,236,239', // paper
];

function counts(w: number, compact: boolean) {
  if (compact) return { molecules: 32, motes: 16, link: 96 };
  if (w < 480) return { molecules: 18, motes: 10, link: 88 };
  if (w < 900) return { molecules: 34, motes: 18, link: 110 };
  return { molecules: 52, motes: 28, link: 128 };
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Login-stage atmosphere: olfactory auras + molecular constellation particles.
 * `compact` is for the app sidebar — fewer stars, no full-page fill.
 */
export function AuthAtmosphere({ compact = false }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const noiseId = compact ? 'fc-noise-nav' : 'fc-noise-auth';

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const stageEl = stageRef.current;
    if (!canvasEl || !stageEl) return;
    const ctxEl = canvasEl.getContext('2d');
    if (!ctxEl) return;
    const canvas = canvasEl;
    const stage = stageEl;
    const ctx = ctxEl;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let molecules: Molecule[] = [];
    let motes: Mote[] = [];
    let rafId: number | null = null;
    let lastTime = performance.now();
    let linkDist = 110;

    function makeMolecule(): Molecule {
      return {
        x: rand(0, width),
        y: rand(0, height),
        r: compact ? rand(0.7, 1.7) : rand(1, 2.6),
        vy: compact ? -rand(1.2, 4) : -rand(3, 9),
        vx: compact ? rand(-0.8, 0.8) : rand(-2, 2),
        phase: rand(0, Math.PI * 2),
        swaySpeed: rand(0.3, 0.7),
        swayAmp: compact ? rand(3, 10) : rand(6, 22),
        color: PALETTE[Math.floor(rand(0, PALETTE.length))]!,
        alpha: compact ? rand(0.28, 0.7) : rand(0.35, 0.85),
      };
    }

    function makeMote(): Mote {
      return {
        x: rand(0, width),
        y: rand(0, height),
        r: compact ? rand(0.6, 1.3) : rand(0.8, 1.8),
        vy: compact ? -rand(1.6, 5) : -rand(4, 10),
        phase: rand(0, Math.PI * 2),
        twinkleSpeed: rand(0.8, 1.8),
        baseAlpha: compact ? rand(0.28, 0.75) : rand(0.4, 1),
      };
    }

    function buildParticles() {
      const c = counts(width, compact);
      molecules = Array.from({ length: c.molecules }, makeMolecule);
      motes = Array.from({ length: c.motes }, makeMote);
      linkDist = c.link;
    }

    function resize() {
      const rect = stage.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    }

    function step(dt: number) {
      const t = performance.now() / 1000;
      for (const m of molecules) {
        m.y += m.vy * dt;
        m.x += m.vx * dt + Math.sin(t * m.swaySpeed + m.phase) * 0.15;
        if (m.y < -10) {
          m.y = height + 10;
          m.x = rand(0, width);
        }
        if (m.x < -10) m.x = width + 10;
        if (m.x > width + 10) m.x = -10;
      }
      for (const p of motes) {
        p.y += p.vy * dt;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = rand(0, width);
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      for (let i = 0; i < molecules.length; i++) {
        for (let j = i + 1; j < molecules.length; j++) {
          const a = molecules[i]!;
          const b = molecules[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDist) {
            const o = (1 - dist / linkDist) * (compact ? 0.26 : 0.14);
            ctx.strokeStyle = `rgba(232,236,239,${o})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const m of molecules) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(${m.color},${m.alpha})`;
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      const t = performance.now() / 1000;
      for (const p of motes) {
        const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * p.twinkleSpeed + p.phase));
        const a = p.baseAlpha * twinkle;
        ctx.beginPath();
        ctx.fillStyle = `rgba(240,207,150,${a})`;
        ctx.shadowColor = 'rgba(232,184,109,0.85)';
        ctx.shadowBlur = 6;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    function loop(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      step(dt);
      draw();
      rafId = requestAnimationFrame(loop);
    }

    function start() {
      if (rafId != null) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    }

    function stop() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    resize();
    if (reduceMotion) {
      draw();
    } else {
      start();
    }

    const onVisibility = () => {
      if (reduceMotion) return;
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    let resizeTimer: number | null = null;
    const onResize = () => {
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resize();
        if (reduceMotion) draw();
      }, 150);
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);

    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let ticking = false;

    function updateParallax() {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      stage.style.setProperty('--mx', `${curX * 16}px`);
      stage.style.setProperty('--my', `${curY * 12}px`);
      if (Math.abs(targetX - curX) > 0.001 || Math.abs(targetY - curY) > 0.001) {
        requestAnimationFrame(updateParallax);
      } else {
        ticking = false;
      }
    }

    const onMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    if (canHover && !reduceMotion && !compact) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseleave', onLeave);
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      if (resizeTimer) window.clearTimeout(resizeTimer);
    };
  }, [compact]);

  return (
    <div
      className={`${styles.stage} ${compact ? styles.stageCompact : ''}`}
      ref={stageRef}
      aria-hidden
    >
      <div className={styles.auraLayer}>
        <div className={`${styles.aura} ${styles.auraTop}`} />
        <div className={`${styles.aura} ${styles.auraHeart}`} />
        <div className={`${styles.aura} ${styles.auraBase}`} />
      </div>

      <canvas ref={canvasRef} className={styles.scene} />

      <svg className={styles.grain}>
        <filter id={noiseId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${noiseId})`} />
      </svg>
      <div className={styles.vignette} />
    </div>
  );
}
