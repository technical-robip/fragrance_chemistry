import { useMemo, useState } from 'react';
import styles from './CostingPage.module.css';

const BASE_BATCH_G = 1000;
const BASE_COST_PER_KG = 42.5;

export function CostingPage() {
  const [batchScale, setBatchScale] = useState(1);
  const [wastePct, setWastePct] = useState(3);
  const [marginPct, setMarginPct] = useState(28);

  const forecast = useMemo(() => {
    const batchG = BASE_BATCH_G * batchScale;
    const materialCost = (batchG / 1000) * BASE_COST_PER_KG;
    const wasteCost = materialCost * (wastePct / 100);
    const subtotal = materialCost + wasteCost;
    const withMargin = subtotal * (1 + marginPct / 100);
    return {
      batchG,
      materialCost,
      wasteCost,
      subtotal,
      withMargin,
      per100g: (withMargin / batchG) * 100,
    };
  }, [batchScale, wastePct, marginPct]);

  return (
    <div>
      <h1 className="fc-page-title">Costing forecast</h1>
      <p className="fc-muted">
        Interactive batch economics — connect to costing API when formulas are priced centrally.
      </p>

      <div className={`fc-card ${styles.panel}`}>
        <label className="fc-label" htmlFor="batch-scale">
          Batch scale ({forecast.batchG.toFixed(0)} g)
        </label>
        <input
          id="batch-scale"
          type="range"
          min={0.25}
          max={5}
          step={0.25}
          value={batchScale}
          onChange={(e) => setBatchScale(Number(e.target.value))}
          className={styles.slider}
        />

        <label className="fc-label" htmlFor="waste">
          Process waste ({wastePct}%)
        </label>
        <input
          id="waste"
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={wastePct}
          onChange={(e) => setWastePct(Number(e.target.value))}
          className={styles.slider}
        />

        <label className="fc-label" htmlFor="margin">
          Target margin ({marginPct}%)
        </label>
        <input
          id="margin"
          type="range"
          min={10}
          max={60}
          step={1}
          value={marginPct}
          onChange={(e) => setMarginPct(Number(e.target.value))}
          className={styles.slider}
        />
      </div>

      <dl className={`fc-card ${styles.summary}`}>
        <div>
          <dt>Material cost</dt>
          <dd>${forecast.materialCost.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Waste allowance</dt>
          <dd>${forecast.wasteCost.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>${forecast.subtotal.toFixed(2)}</dd>
        </div>
        <div>
          <dt>With margin</dt>
          <dd className={styles.highlight}>${forecast.withMargin.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Indicative / 100 g</dt>
          <dd>${forecast.per100g.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  );
}
