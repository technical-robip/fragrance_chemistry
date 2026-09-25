import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateIfraCompliance, formulaCost } from '@fc/formula-engine';
import { CompliancePanel } from '@/components/viz/CompliancePanel';
import { ScalePulseReadout } from '@/components/viz/ScalePulseReadout';
import { CssPerfumeVessel } from '@/components/viz/CssPerfumeVessel';
import {
  allergenSourceCount,
  DEMO_BATCH_GRAMS,
  DEMO_IFRA_CATEGORY,
  DEMO_LINES,
  ILLUSTRATIVE_LIMITS,
} from './demo-formula';
import { grams, percent } from './manual';
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

/** Weighing: the reading, the deviation, and what the engine did with the rest. */
export function WeighLeaf() {
  const { t } = useTranslation();
  const target = 0.62;
  const actual = 0.684;
  const deviation = actual - target;

  return (
    <Leaf label={t('landing.divisions.weigh.leafLabel')}>
      <ScalePulseReadout grams={actual} connected label={t('landing.divisions.weigh.actual')} />

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

/** Costing: the three levels, computed from the same lines. */
export function CostLeaf() {
  const { t } = useTranslation();
  const [view, setView] = useState<'concentrate' | 'packaged'>('packaged');
  const units = 250;
  const bottleMl = 50;

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

  // Illustrative packaging and dilution figures; the juice cost is computed.
  const juicePerBottle = cost.costPerGramBatch * bottleMl * 0.87;
  const packaging = 2.4;
  const cogs = juicePerBottle + packaging;
  const wholesale = cogs * 2.6;
  const retail = wholesale * 2.4;
  const margin = ((wholesale - cogs) / wholesale) * 100;

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

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt className={styles.rowTerm}>{t('landing.divisions.cost.volume')}</dt>
          <dd className={styles.rowValue}>{units}</dd>
          <dd className={styles.rowMuted}>{bottleMl} ml</dd>
        </div>
        <div className={`${styles.row} ${view === 'concentrate' ? leaves.rowLit : ''}`}>
          <dt className={styles.rowTerm}>{t('landing.divisions.cost.concentrate')}</dt>
          <dd className={styles.rowValue}>{cost.totalCost.toFixed(2)}</dd>
          <dd className={styles.rowMuted}>/ {DEMO_BATCH_GRAMS} g</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowTerm}>{t('landing.divisions.cost.juice')}</dt>
          <dd className={styles.rowValue}>{juicePerBottle.toFixed(2)}</dd>
          <dd className={styles.rowMuted}>/ {bottleMl} ml</dd>
        </div>
        <div className={`${styles.row} ${view === 'packaged' ? leaves.rowLit : ''}`}>
          <dt className={styles.rowTerm}>{t('landing.divisions.cost.cogs')}</dt>
          <dd className={styles.rowValue}>{cogs.toFixed(2)}</dd>
          <dd className={styles.rowMuted}>{t('landing.divisions.cost.packaged')}</dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowTerm}>{t('landing.divisions.cost.wholesale')}</dt>
          <dd className={styles.rowValue}>{wholesale.toFixed(2)}</dd>
          <dd className={styles.rowMuted}>
            {t('landing.divisions.cost.retail')} {retail.toFixed(2)}
          </dd>
        </div>
        <div className={styles.row}>
          <dt className={styles.rowTerm}>{t('landing.divisions.cost.margin')}</dt>
          <dd className={`${styles.rowValue} ${leaves.emphasis}`}>{percent(margin)} %</dd>
          <dd className={styles.rowMuted} />
        </div>
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
