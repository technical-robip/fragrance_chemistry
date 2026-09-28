import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateIfraCompliance, formulaCost } from '@fc/formula-engine';
import { CompliancePanel } from '@/components/viz/CompliancePanel';
import { ScalePulseReadout } from '@/components/viz/ScalePulseReadout';
import { CssPerfumeVessel } from '@/components/viz/CssPerfumeVessel';
import {
  allergenSourceCount,
  DEMO_BATCH_GRAMS,
  DEMO_CONCENTRATION_PCT,
  DEMO_IFRA_CATEGORY,
  DEMO_LINES,
  ILLUSTRATIVE_LIMITS,
} from './demo-formula';
import { grams, percent } from './manual';
import { usePourGrams, WEIGH_ACTUAL_GRAMS, WEIGH_TARGET_GRAMS } from './use-pour-grams';
import styles from './LandingPage.module.css';
import leaves from './DivisionLeaves.module.css';

function Leaf({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={`${styles.leaf} ${leaves.leaf} leafFlip`}>
      <span className={styles.leafHoles} aria-hidden>
        <span className={styles.leafHole} />
        <span className={styles.leafHole} />
      </span>
      <span className={styles.leafLabel}>{label}</span>
      {children}
    </div>
  );
}

const WeighScaleFigure = lazy(() =>
  import('@/components/viz/three/WeighScaleFigure').then((m) => ({ default: m.WeighScaleFigure })),
);

/** Map fill ratio so CSS vessel shows a readable slug (~22% at target). */
const CONCENTRATE_AS_PCT = 22;

/** Weighing: the reading, the deviation, and what the engine did with the rest. */
export function WeighLeaf() {
  const { t } = useTranslation();
  const target = WEIGH_TARGET_GRAMS;
  const actual = WEIGH_ACTUAL_GRAMS;
  const deviation = actual - target;
  const leafRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  // Wait for WebGL first frame (or CSS fallback) so juice and grams rise together.
  const pourActive = inView && (sceneReady || webglFailed);
  const panGrams = usePourGrams(pourActive, actual);

  useEffect(() => {
    const node = leafRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Toggle so leaving and returning to Weigh replays the pour.
        setInView(entries.some((e) => e.isIntersecting));
      },
      { rootMargin: '40px', threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const fillPct = Math.min(100, (panGrams / target) * CONCENTRATE_AS_PCT);

  return (
    <div ref={leafRef}>
      <Leaf label={t('landing.divisions.weigh.leafLabel')}>
        <ScalePulseReadout
          grams={panGrams}
          connected
          label={t('landing.divisions.weigh.actual')}
          stage={
            webglFailed ? (
              <div className={leaves.figure}>
                <CssPerfumeVessel levelPct={fillPct} compact open label={t('common.appName')} />
              </div>
            ) : (
              <Suspense fallback={null}>
                <WeighScaleFigure
                  panGrams={panGrams}
                  targetGrams={target}
                  label={t('landing.divisions.weigh.leafLabel')}
                  onReady={() => setSceneReady(true)}
                  onUnavailable={() => setWebglFailed(true)}
                />
              </Suspense>
            )
          }
        />

        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt className={styles.rowTerm}>{t('landing.divisions.weigh.target')}</dt>
            <dd className={styles.rowValue}>{grams(target)} g</dd>
            <dd className={styles.rowMuted}>Bergamot EO</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.rowTerm}>{t('landing.divisions.weigh.deviation')}</dt>
            <dd className={`${styles.rowValue} ${leaves.over}`}>+{grams(deviation)} g</dd>
            <dd className={styles.rowMuted}>+{percent((deviation / target) * 100)} %</dd>
          </div>
        </dl>

        <p className={leaves.consequence}>{t('landing.divisions.weigh.rebalanced')}</p>

        <dl className={styles.rows}>
          {[
            { label: 'Petitgrain Bigarade EO', before: 0.28, after: 0.2673 },
            { label: 'Hedione', before: 0.42, after: 0.4009 },
            { label: 'Iso E Super', before: 0.22, after: 0.21 },
          ].map((row) => (
            <div key={row.label} className={styles.row}>
              <dt className={styles.rowTerm}>{row.label}</dt>
              <dd className={styles.ghost}>{grams(row.before)}</dd>
              <dd className={styles.rowValue}>{grams(row.after)}</dd>
            </div>
          ))}
        </dl>
      </Leaf>
    </div>
  );
}

/** Compliance: allergens summed across sources, checked against the category. */
export function ComplyLeaf() {
  const { t } = useTranslation();
  const report = useMemo(
    () => evaluateIfraCompliance(DEMO_LINES, DEMO_IFRA_CATEGORY, ILLUSTRATIVE_LIMITS),
    [],
  );

  const statusLabel = {
    green: t('landing.divisions.comply.statusGreen'),
    yellow: t('landing.divisions.comply.statusYellow'),
    red: t('landing.divisions.comply.statusRed'),
  } as const;

  return (
    <Leaf label={t('landing.divisions.comply.leafLabel')}>
      <CompliancePanel
        compliance={{
          category: report.category,
          categoryLabel: t('landing.hero.categoryValue'),
          overallStatus: report.overallStatus,
          allergens: report.allergens,
          labelAllergens: report.allergens
            .filter((allergen) => allergen.status !== 'green')
            .map((allergen) => allergen.name),
        }}
      />
      <table className={leaves.table}>
        <thead>
          <tr>
            <th scope="col">{t('landing.divisions.comply.allergen')}</th>
            <th scope="col">{t('landing.divisions.comply.sources')}</th>
            <th scope="col">{t('landing.divisions.comply.inBatch')}</th>
            <th scope="col">{t('landing.divisions.comply.limit')}</th>
          </tr>
        </thead>
        <tbody>
          {report.allergens.map((allergen) => (
            <tr key={allergen.name} className={leaves[allergen.status]}>
              <th scope="row">{allergen.name}</th>
              <td>{allergenSourceCount(DEMO_LINES, allergen.name)}</td>
              <td>{percent(allergen.percentOfBatch, 3)} %</td>
              <td>
                {allergen.limitPercent != null ? (
                  `${percent(allergen.limitPercent)} %`
                ) : (
                  <span className={styles.ghost}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Compliance recolours the surface of the row it describes, not a badge. */}
      <p className={`${leaves.verdict} ${leaves[`verdict_${report.overallStatus}`]}`}>
        {statusLabel[report.overallStatus]}
      </p>

      <p className={leaves.footnote}>{t('landing.divisions.comply.note')}</p>
    </Leaf>
  );
}

const FlaconFigure = lazy(() =>
  import('@/components/viz/three/FlaconFigure').then((m) => ({ default: m.FlaconFigure })),
);

/**
 * The manual's illustrated plate: the flacon fills and caps between concentrate
 * and the packaged unit. Reconstructed procedurally from a reference photograph
 * through the img2threejs pipeline; the measured spec lives in
 * `.img2threejs/object-sculpt-spec.json`.
 */
function PackagedUnitFigure({ view }: { view: 'concentrate' | 'packaged' }) {
  const { t } = useTranslation();
  const [unavailable, setUnavailable] = useState(false);
  const label = t('landing.divisions.cost.leafLabel');

  // The CSS vessel stands in only once WebGL has actually been ruled out;
  // rendering both would show two bottles through one another.
  if (unavailable) {
    return (
      <div className={leaves.figure}>
        <CssPerfumeVessel
          levelPct={view === 'packaged' ? 80 : 20}
          compact
          open={view === 'concentrate'}
        />
      </div>
    );
  }

  return (
    <div className={leaves.figure}>
      <Suspense fallback={null}>
        <FlaconFigure view={view} label={label} onUnavailable={() => setUnavailable(true)} />
      </Suspense>
    </div>
  );
}

/** Same defaults and unit math as the signed-in costing page. */
const UNIT_WASTE_PCT = 3;
const UNIT_MARGIN_PCT = 28;
const UNIT_BOTTLE_ML = 50;
const UNIT_PACKAGING = 1.2;

function formatMoney(amount: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Costing: concentrate cost, then the finished bottle the lab page shows. */
export function CostLeaf() {
  const { t } = useTranslation();
  const [view, setView] = useState<'concentrate' | 'packaged'>('packaged');

  const cost = useMemo(
    () =>
      formulaCost({
        id: 'demo',
        name: 'demo',
        lines: DEMO_LINES,
        batchSizeGrams: DEMO_BATCH_GRAMS,
      }),
    [],
  );

  const concentrateJuice = cost.costPerGramBatch * UNIT_BOTTLE_ML * 0.87;
  const materialCost = cost.totalCost;
  const concentrateWithMargin =
    (materialCost + materialCost * (UNIT_WASTE_PCT / 100)) * (1 + UNIT_MARGIN_PCT / 100);
  const dilutedCostPerGram =
    concentrateWithMargin / (DEMO_BATCH_GRAMS / (DEMO_CONCENTRATION_PCT / 100));
  const juiceCost = dilutedCostPerGram * UNIT_BOTTLE_ML * 0.9;
  const wholesale = juiceCost + UNIT_PACKAGING;
  const rrp = wholesale * (1 + UNIT_MARGIN_PCT / 100);
  const breakEvenUnits =
    UNIT_PACKAGING > 0 ? Math.ceil(concentrateWithMargin / (rrp - UNIT_PACKAGING || 1)) : null;

  return (
    <Leaf label={t('landing.divisions.cost.leafLabel')}>
      <PackagedUnitFigure view={view} />

      <div
        className={leaves.viewSwitch}
        role="group"
        aria-label={t('landing.divisions.cost.viewSwitch')}
      >
        <button
          type="button"
          className={`${styles.actionQuiet} ${leaves.viewOption} ${view === 'concentrate' ? leaves.viewOptionOn : ''}`}
          aria-pressed={view === 'concentrate'}
          onClick={() => setView('concentrate')}
        >
          {t('landing.divisions.cost.concentrate')}
        </button>
        <button
          type="button"
          className={`${styles.actionQuiet} ${leaves.viewOption} ${view === 'packaged' ? leaves.viewOptionOn : ''}`}
          aria-pressed={view === 'packaged'}
          onClick={() => setView('packaged')}
        >
          {t('landing.divisions.cost.packaged')}
        </button>
      </div>

      {view === 'packaged' ? (
        <p className={leaves.unitHint}>{t('costing.tierUnitHint', { ml: UNIT_BOTTLE_ML })}</p>
      ) : null}

      <dl className={styles.rows}>
        {view === 'concentrate' ? (
          <>
            <div className={styles.row}>
              <dt className={styles.rowTerm}>{t('landing.divisions.cost.batch')}</dt>
              <dd className={styles.rowValue}>{DEMO_BATCH_GRAMS}</dd>
              <dd className={styles.rowMuted}>g</dd>
            </div>
            <div className={`${styles.row} ${leaves.rowLit}`}>
              <dt className={styles.rowTerm}>{t('landing.divisions.cost.concentrate')}</dt>
              <dd className={styles.rowValue}>{cost.totalCost.toFixed(2)}</dd>
              <dd className={styles.rowMuted} />
            </div>
            <div className={styles.row}>
              <dt className={styles.rowTerm}>{t('landing.divisions.cost.perGram')}</dt>
              <dd className={styles.rowValue}>{cost.costPerGramBatch.toFixed(3)}</dd>
              <dd className={styles.rowMuted}>/ g</dd>
            </div>
            <div className={styles.row}>
              <dt className={styles.rowTerm}>{t('landing.divisions.cost.juice')}</dt>
              <dd className={styles.rowValue}>{concentrateJuice.toFixed(2)}</dd>
              <dd className={styles.rowMuted}>/ {UNIT_BOTTLE_ML} ml</dd>
            </div>
          </>
        ) : (
          <>
            <div className={styles.row}>
              <dt className={styles.rowTerm}>{t('costing.juice')}</dt>
              <dd className={styles.rowValue}>{formatMoney(juiceCost)}</dd>
              <dd className={styles.rowMuted} />
            </div>
            <div className={styles.row}>
              <dt className={styles.rowTerm}>{t('costing.packaging')}</dt>
              <dd className={styles.rowValue}>{formatMoney(UNIT_PACKAGING)}</dd>
              <dd className={styles.rowMuted} />
            </div>
            <div className={`${styles.row} ${leaves.rowLit}`}>
              <dt className={styles.rowTerm}>{t('costing.wholesale')}</dt>
              <dd className={styles.rowValue}>{formatMoney(wholesale)}</dd>
              <dd className={styles.rowMuted} />
            </div>
            <div className={`${styles.row} ${leaves.rowLit}`}>
              <dt className={styles.rowTerm}>{t('costing.rrp')}</dt>
              <dd className={styles.rowValue}>{formatMoney(rrp)}</dd>
              <dd className={styles.rowMuted} />
            </div>
            <div className={styles.row}>
              <dt className={styles.rowTerm}>{t('costing.breakEven')}</dt>
              <dd className={styles.rowValue}>{breakEvenUnits ?? '—'}</dd>
              <dd className={styles.rowMuted} />
            </div>
          </>
        )}
      </dl>
    </Leaf>
  );
}

/** Evaluation: the maceration clock and the organoleptic checkpoints. */
export function EvaluateLeaf() {
  const { t } = useTranslation();

  const days = [
    { day: 1, logged: true },
    { day: 7, logged: true },
    { day: 14, logged: false, due: true },
    { day: 30, logged: false },
  ];

  const checkpoints = [
    { at: 'T+0', logged: true },
    { at: 'T+30min', logged: true },
    { at: 'T+4h', logged: true },
    { at: 'T+24h', logged: false },
  ];

  return (
    <Leaf label={t('landing.divisions.evaluate.leafLabel')}>
      <span className={leaves.subLabel}>{t('landing.divisions.evaluate.day')}</span>
      <ol className={leaves.cells}>
        {days.map((entry) => (
          <li
            key={entry.day}
            className={`${leaves.cell} ${entry.logged ? leaves.cellLit : ''} ${
              entry.due ? leaves.cellDue : ''
            }`}
          >
            <span className={leaves.cellValue}>{entry.day}</span>
            <span className={leaves.cellState}>
              {entry.logged
                ? t('landing.divisions.evaluate.logged')
                : entry.due
                  ? t('landing.divisions.evaluate.due')
                  : t('landing.divisions.evaluate.pending')}
            </span>
          </li>
        ))}
      </ol>

      <span className={leaves.subLabel}>{t('landing.divisions.evaluate.checkpoint')}</span>
      <ol className={leaves.cells}>
        {checkpoints.map((entry) => (
          <li key={entry.at} className={`${leaves.cell} ${entry.logged ? leaves.cellLit : ''}`}>
            <span className={leaves.cellValue}>{entry.at}</span>
            <span className={leaves.cellState}>
              {entry.logged
                ? t('landing.divisions.evaluate.logged')
                : t('landing.divisions.evaluate.pending')}
            </span>
          </li>
        ))}
      </ol>
    </Leaf>
  );
}
