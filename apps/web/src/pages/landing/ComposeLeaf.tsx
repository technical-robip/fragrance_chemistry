import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { activeGrams } from '@fc/formula-engine';
import { FragrancePyramid } from '@/components/viz/FragrancePyramid';
import { NotesRadar } from '@/components/viz/NotesRadar';
import { DEMO_ADJUSTABLE_IDS, SCALE_RESOLUTION_GRAMS } from './demo-formula';
import {
  BASELINE,
  clampAmount,
  demoRadarAxes,
  deriveComposeDemo,
  sliderCeiling,
  type Amounts,
} from './compose-demo';
import { grams, percent } from './manual';
import styles from './LandingPage.module.css';
import compose from './ComposeLeaf.module.css';

/**
 * The Live Engine leaf is an acetate overlay hinged at its punch holes.
 * The drop plays once when the leaf enters the viewport; slider ticks must
 * never remount it, or the right edge looks like it is flapping forever.
 */
export function ComposeLeaf() {
  const { t } = useTranslation();
  const [amounts, setAmounts] = useState<Amounts>(BASELINE);
  const state = useMemo(() => deriveComposeDemo(amounts), [amounts]);
  const leafRef = useRef<HTMLDivElement>(null);
  const dropPlayed = useRef(false);
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    const node = leafRef.current;
    if (!node || dropPlayed.current) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      dropPlayed.current = true;
      return;
    }

    const play = () => {
      if (dropPlayed.current) return;
      dropPlayed.current = true;
      setDropping(true);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.32, rootMargin: '0px 0px -10% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function set(id: keyof Amounts, value: number) {
    setAmounts((prev) => {
      const next = { ...prev, [id]: clampAmount(id, value, prev) };
      for (const other of DEMO_ADJUSTABLE_IDS) {
        if (other === id) continue;
        next[other] = clampAmount(other, next[other], next);
      }
      return next;
    });
  }

  const tiers = [
    {
      id: 'top' as const,
      label: t('landing.divisions.compose.notes.top'),
      percent: state.pyramid.top,
    },
    {
      id: 'middle' as const,
      label: t('landing.divisions.compose.notes.middle'),
      percent: state.pyramid.middle,
    },
    {
      id: 'base' as const,
      label: t('landing.divisions.compose.notes.base'),
      percent: state.pyramid.base,
    },
  ];

  const dominantKey =
    state.dominant === 'unassigned'
      ? 'landing.divisions.compose.notes.unassigned'
      : `landing.divisions.compose.notes.${state.dominant}`;
  const dominantLabel = t(dominantKey);
  const isBaseline = DEMO_ADJUSTABLE_IDS.every((id) => amounts[id] === BASELINE[id]);
  const radarAxes = demoRadarAxes(state.concentrate);

  return (
    <div className={compose.wrap}>
      <div className={`${styles.board} ${compose.board}`}>
        <span className={styles.leafLabel}>{t('landing.divisions.compose.controls')}</span>

        {DEMO_ADJUSTABLE_IDS.map((id) => {
          const line = state.concentrate.find((entry) => entry.id === id);
          if (!line) return null;
          const ceiling = sliderCeiling(id, amounts);
          const rangeMax = Math.max(ceiling, 0.01);
          const value = Math.min(amounts[id], ceiling);
          return (
            <label key={id} className={compose.control}>
              <span className={compose.controlHead}>
                <span className={compose.controlName}>{line.label}</span>
                <output className={styles.rowValue}>{grams(value)} g</output>
              </span>
              <input
                type="range"
                className={compose.slider}
                min={0}
                max={rangeMax}
                step={0.01}
                value={value}
                onChange={(e) => set(id, Number(e.target.value))}
                aria-label={`${line.label} — ${t('landing.divisions.compose.controls')}`}
                aria-valuetext={`${grams(value)} g`}
                aria-valuemin={0}
                aria-valuemax={ceiling}
                disabled={ceiling <= 0}
              />
            </label>
          );
        })}

        <button
          type="button"
          className={`${styles.actionQuiet} ${compose.reset}`}
          onClick={() => setAmounts(BASELINE)}
          disabled={isBaseline}
        >
          {t('landing.divisions.compose.reset')}
        </button>

        <p className={compose.hint}>{t('landing.divisions.compose.interactiveHint')}</p>
      </div>

      <div
        ref={leafRef}
        className={`${styles.leaf} ${compose.leaf} ${dropping ? compose.drop : ''}`.trim()}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          setDropping(false);
        }}
      >
        <span className={styles.leafHoles} aria-hidden>
          <span className={styles.leafHole} />
          <span className={styles.leafHole} />
        </span>
        <span className={styles.leafLabel}>{t('landing.divisions.compose.leafLabel')}</span>

        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt className={styles.rowTerm}>{t('landing.divisions.compose.totalMass')}</dt>
            <dd className={styles.rowValue}>{grams(state.batchGrams)} g</dd>
            <dd className={styles.rowMuted}>100 %</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowTerm}>{t('landing.divisions.compose.totalActive')}</dt>
            <dd className={styles.rowValue}>{grams(state.neatGrams, 4)} g</dd>
            <dd className={styles.rowMuted}>
              {percent((state.neatGrams / state.batchGrams) * 100)} %
            </dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowTerm}>{t('landing.divisions.compose.dominant')}</dt>
            <dd className={styles.rowValue}>{dominantLabel}</dd>
            <dd className={styles.rowMuted}>
              {percent(Math.max(state.pyramid.top, state.pyramid.middle, state.pyramid.base))} %
            </dd>
          </div>
        </dl>

        <div className={compose.viz}>
          <FragrancePyramid tiers={tiers} compact showLegend={false} className={compose.pyramid} />
          <NotesRadar axes={radarAxes} compact showLegend={false} animate={false} valueMax={100} />
        </div>

        {state.edge === 'allMin' ? (
          <p className={compose.edge} role="status">
            {t('landing.divisions.compose.edgeAllMin')}
          </p>
        ) : null}
        {state.edge === 'remainderZero' ? (
          <p className={compose.edge} role="status">
            {t('landing.divisions.compose.edgeRemainderZero')}
          </p>
        ) : null}

        {state.concentrate
          .filter((line) => {
            const neat = activeGrams(line);
            return (
              line.concentrationKind === 'dilution' && neat > 0 && neat < SCALE_RESOLUTION_GRAMS
            );
          })
          .map((line) => (
            <p key={line.id} className={compose.resolution}>
              <span className={compose.resolutionName}>{line.label}</span>
              <span>{t('landing.divisions.compose.belowResolution')}</span>
              <span className={compose.resolutionValue}>
                {t('landing.divisions.compose.diluted', {
                  pct: (line.activeFraction ?? 0) * 100,
                })}
              </span>
            </p>
          ))}
      </div>
    </div>
  );
}
