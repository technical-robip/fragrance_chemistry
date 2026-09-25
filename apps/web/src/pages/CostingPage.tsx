import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FormulaSelector,
  useSelectedFormulaId,
  type FormulaSummary,
} from '@/components/FormulaSelector';
import { api } from '@/lib/api-client';
import styles from './CostingPage.module.css';

type CostingResponse = {
  formulaId: string;
  formulaName: string;
  concentrationPct: number;
  batchGrams: number;
  wastePct: number;
  marginPct: number;
  bottleMl: number;
  packagingCost: number;
  currency: string;
  lines: Array<{
    materialId: string;
    materialName: string;
    manufacturer: string | null;
    slug: string | null;
    stockConcentrationPct: number;
    solvent: string | null;
    percent: number;
    grams: number;
    costPerGram: number;
    lineCost: number;
  }>;
  concentrate: {
    batchGrams: number;
    materialCost: number;
    wasteCost: number;
    subtotal: number;
    withMargin: number;
    costPerGram: number;
  };
  diluted: {
    batchGrams: number;
    costPerGram: number;
    batchCost: number;
  };
  unit: {
    bottleMl: number;
    juiceCost: number;
    packagingCost: number;
    wholesale: number;
    rrp: number;
    breakEvenUnits: number | null;
  };
};

type Scenario = {
  formulaId: string;
  batchGrams: number;
  wastePct: number;
  marginPct: number;
  bottleMl: number;
  packagingCost: number;
};

const SCENARIO_PREFIX = 'fc.costing.scenario:';

function scenarioKey(formulaId: string) {
  return `${SCENARIO_PREFIX}${formulaId}`;
}

function loadScenario(formulaId: string): Scenario | null {
  try {
    const raw = window.localStorage.getItem(scenarioKey(formulaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Scenario>;
    if (
      typeof parsed.batchGrams !== 'number' ||
      typeof parsed.wastePct !== 'number' ||
      typeof parsed.marginPct !== 'number' ||
      typeof parsed.bottleMl !== 'number' ||
      typeof parsed.packagingCost !== 'number'
    ) {
      return null;
    }
    return {
      formulaId,
      batchGrams: parsed.batchGrams,
      wastePct: parsed.wastePct,
      marginPct: parsed.marginPct,
      bottleMl: parsed.bottleMl,
      packagingCost: parsed.packagingCost,
    };
  } catch {
    return null;
  }
}

function formatMoney(amount: number, currency: string) {
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

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function CostingPage() {
  const { t } = useTranslation();
  const formulaId = useSelectedFormulaId();
  const { data: formulas = [] } = useQuery({
    queryKey: ['formulas'],
    queryFn: () => api.get<FormulaSummary[]>('/formulas'),
  });
  const selected = formulas.find((f) => f.id === formulaId);

  const [batchGrams, setBatchGrams] = useState(100);
  const [wastePct, setWastePct] = useState(3);
  const [marginPct, setMarginPct] = useState(28);
  const [bottleMl, setBottleMl] = useState(50);
  const [packagingCost, setPackagingCost] = useState(1.2);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!formulaId) return;
    const saved = loadScenario(formulaId);
    if (saved) {
      setBatchGrams(saved.batchGrams);
      setWastePct(saved.wastePct);
      setMarginPct(saved.marginPct);
      setBottleMl(saved.bottleMl);
      setPackagingCost(saved.packagingCost);
      return;
    }
    const fromFormula = Number(selected?.batchTargetGrams);
    setBatchGrams(Number.isFinite(fromFormula) && fromFormula > 0 ? fromFormula : 100);
    setWastePct(3);
    setMarginPct(28);
    setBottleMl(50);
    setPackagingCost(1.2);
  }, [formulaId, selected?.batchTargetGrams]);

  const query = useMemo(() => {
    const p = new URLSearchParams({
      batchGrams: String(batchGrams),
      wastePct: String(wastePct),
      marginPct: String(marginPct),
      bottleMl: String(bottleMl),
      packagingCost: String(packagingCost),
    });
    return p.toString();
  }, [batchGrams, wastePct, marginPct, bottleMl, packagingCost]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['costing', formulaId, query],
    queryFn: () => api.get<CostingResponse>(`/costing/formulas/${formulaId}?${query}`),
    enabled: !!formulaId,
  });

  function saveScenario() {
    if (!data || !formulaId) return;
    window.localStorage.setItem(
      scenarioKey(formulaId),
      JSON.stringify({
        formulaId: data.formulaId,
        batchGrams,
        wastePct,
        marginPct,
        bottleMl,
        packagingCost,
        savedAt: new Date().toISOString(),
      }),
    );
    setSavedMsg(t('costing.saved'));
    window.setTimeout(() => setSavedMsg(null), 2000);
  }

  const currency = data?.currency ?? 'USD';

  return (
    <div>
      <header className={styles.header}>
        <div>
          <h1 className="fc-page-title">{t('costing.title')}</h1>
          <p className="fc-muted">{t('costing.subtitle')}</p>
        </div>
        <FormulaSelector />
      </header>

      {!formulaId ? (
        <div className={`fc-card ${styles.empty}`}>
          <p>{t('costing.empty')}</p>
        </div>
      ) : null}

      {formulaId && isLoading ? <p className="fc-muted">{t('costing.loading')}</p> : null}
      {formulaId && isError ? (
        <div className={`fc-card ${styles.empty}`}>
          <p>{t('costing.error')}</p>
        </div>
      ) : null}

      {data ? (
        <>
          <section className={`fc-card ${styles.panel}`}>
            <h2 className={styles.sectionTitle}>{t('costing.pricingTitle')}</h2>
            <dl className={styles.metaGrid}>
              <div>
                <dt>{t('costing.formula')}</dt>
                <dd>{data.formulaName}</dd>
              </div>
              <div>
                <dt>{t('costing.batch')}</dt>
                <dd>{t('costing.batchValue', { grams: data.batchGrams })}</dd>
              </div>
              <div>
                <dt>{t('costing.concentration')}</dt>
                <dd>{data.concentrationPct}%</dd>
              </div>
              <div>
                <dt>{t('costing.materials')}</dt>
                <dd>{data.lines.length}</dd>
              </div>
            </dl>
          </section>

          <section className={`fc-card ${styles.panel}`}>
            <h2 className={styles.sectionTitle}>{t('costing.lineCosts')}</h2>
            <div className="fc-table-wrap">
              <table className="fc-table">
                <thead>
                  <tr>
                    <th>{t('costing.material')}</th>
                    <th>{t('costing.percent')}</th>
                    <th>{t('costing.grams')}</th>
                    <th>{t('costing.costPerGram')}</th>
                    <th>{t('costing.lineCost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => {
                    const name = (
                      <>
                        {line.materialName}
                        {line.manufacturer ? (
                          <span className={styles.sub}>{line.manufacturer}</span>
                        ) : null}
                        {line.stockConcentrationPct < 99.9 ? (
                          <span className={styles.sub}>
                            {t('costing.dilutionLabel', {
                              pct: line.stockConcentrationPct.toFixed(0),
                              solvent: line.solvent ? ` ${line.solvent}` : '',
                            })}
                          </span>
                        ) : null}
                      </>
                    );
                    return (
                      <tr key={`${line.materialId}-${line.percent}`}>
                        <td>
                          {line.slug ? (
                            <Link to={`/catalog/${line.slug}`} className={styles.materialLink}>
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </td>
                        <td>{line.percent.toFixed(2)}</td>
                        <td>{line.grams.toFixed(2)}</td>
                        <td>{formatMoney(line.costPerGram, currency)}</td>
                        <td>{formatMoney(line.lineCost, currency)}</td>
                      </tr>
                    );
                  })}
                  {data.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5}>{t('costing.noLines')}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`fc-card ${styles.panel}`}>
            <h2 className={styles.sectionTitle}>{t('costing.scenarioInputs')}</h2>
            <SliderField
              id="batch-g"
              label={t('costing.concentrateBatch')}
              min={10}
              max={1000}
              step={10}
              value={batchGrams}
              onChange={setBatchGrams}
              suffix="g"
            />
            <SliderField
              id="waste"
              label={t('costing.processWaste')}
              min={0}
              max={15}
              step={0.5}
              value={wastePct}
              onChange={setWastePct}
              suffix="%"
            />
            <SliderField
              id="margin"
              label={t('costing.targetMargin')}
              min={10}
              max={60}
              step={1}
              value={marginPct}
              onChange={setMarginPct}
              suffix="%"
            />
            <SliderField
              id="bottle"
              label={t('costing.bottleSize')}
              min={10}
              max={200}
              step={5}
              value={bottleMl}
              onChange={setBottleMl}
              suffix="ml"
            />
            <SliderField
              id="pack"
              label={t('costing.packagingCost')}
              min={0}
              max={8}
              step={0.1}
              value={packagingCost}
              onChange={setPackagingCost}
              prefix={formatMoney(packagingCost, currency)}
            />
          </section>

          <p className={`fc-muted ${styles.note}`}>{t('costing.wholesaleNote')}</p>

          <section className={styles.tiers}>
            <article className={`fc-card ${styles.tier}`}>
              <h3>{t('costing.tierConcentrate')}</h3>
              <p className={styles.explain}>{t('costing.tierConcentrateHint')}</p>
              <dl className={styles.summary}>
                <div>
                  <dt>{t('costing.materialCost')}</dt>
                  <dd>{formatMoney(data.concentrate.materialCost, currency)}</dd>
                </div>
                <div>
                  <dt>{t('costing.waste')}</dt>
                  <dd>{formatMoney(data.concentrate.wasteCost, currency)}</dd>
                </div>
                <div>
                  <dt>{t('costing.costPerG')}</dt>
                  <dd className={styles.highlight}>
                    {formatMoney(data.concentrate.costPerGram, currency)}
                  </dd>
                </div>
                <div>
                  <dt>{t('costing.batchWithMargin')}</dt>
                  <dd>{formatMoney(data.concentrate.withMargin, currency)}</dd>
                </div>
              </dl>
            </article>
            <article className={`fc-card ${styles.tier}`}>
              <h3>{t('costing.tierDiluted')}</h3>
              <p className={styles.explain}>
                {t('costing.tierDilutedHint', { pct: data.concentrationPct })}
              </p>
              <dl className={styles.summary}>
                <div>
                  <dt>{t('costing.dilutedBatch')}</dt>
                  <dd>{data.diluted.batchGrams.toFixed(0)} g</dd>
                </div>
                <div>
                  <dt>{t('costing.costPerG')}</dt>
                  <dd className={styles.highlight}>
                    {formatMoney(data.diluted.costPerGram, currency)}
                  </dd>
                </div>
                <div>
                  <dt>{t('costing.batchCost')}</dt>
                  <dd>{formatMoney(data.diluted.batchCost, currency)}</dd>
                </div>
              </dl>
            </article>
            <article className={`fc-card ${styles.tier}`}>
              <h3>{t('costing.tierUnit')}</h3>
              <p className={styles.explain}>
                {t('costing.tierUnitHint', { ml: data.unit.bottleMl })}
              </p>
              <dl className={styles.summary}>
                <div>
                  <dt>{t('costing.juice')}</dt>
                  <dd>{formatMoney(data.unit.juiceCost, currency)}</dd>
                </div>
                <div>
                  <dt>{t('costing.packaging')}</dt>
                  <dd>{formatMoney(data.unit.packagingCost, currency)}</dd>
                </div>
                <div>
                  <dt>{t('costing.wholesale')}</dt>
                  <dd className={styles.highlight}>{formatMoney(data.unit.wholesale, currency)}</dd>
                </div>
                <div>
                  <dt>{t('costing.rrp')}</dt>
                  <dd className={styles.highlight}>{formatMoney(data.unit.rrp, currency)}</dd>
                </div>
                <div>
                  <dt>{t('costing.breakEven')}</dt>
                  <dd>{data.unit.breakEvenUnits ?? '—'}</dd>
                </div>
              </dl>
            </article>
          </section>

          <div className={styles.actions}>
            <button type="button" className="fc-btn fc-btn--primary" onClick={saveScenario}>
              {t('costing.saveScenario')}
            </button>
            {savedMsg ? <span className="fc-muted">{savedMsg}</span> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SliderField({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
  prefix,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div className={styles.control}>
      <label className="fc-label" htmlFor={id}>
        {label}
        {prefix ? <span className={styles.controlValue}>{prefix}</span> : null}
        {!prefix && suffix ? (
          <span className={styles.controlValue}>
            {value}
            {suffix ? ` ${suffix}` : ''}
          </span>
        ) : null}
      </label>
      <div className={styles.controlRow}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={styles.slider}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(clamp(Number(e.target.value), min, max))}
          className={styles.numeric}
        />
      </div>
    </div>
  );
}
