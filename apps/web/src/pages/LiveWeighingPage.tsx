import {
  connectBluetooth,
  connectSerial,
  isBluetoothSupported,
  isSerialSupported,
  MockScale,
  type ScaleAdapter,
  type ScaleReading,
} from '@fc/scale-bridge';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FormulaSelector,
  useSelectedFormulaId,
  useSelectedFormulaRouteKey,
} from '@/components/FormulaSelector';
import { ScalePulseReadout } from '@/components/viz/ScalePulseReadout';
import { api } from '@/lib/api-client';
import styles from './LiveWeighingPage.module.css';

type FormulaDetail = {
  id: string;
  name: string;
  batchTargetGrams: string;
  concentrationPct?: string;
  lines: Array<{
    materialName: string;
    percent: string;
  }>;
};

export function LiveWeighingPage() {
  const { t } = useTranslation();
  const formulaId = useSelectedFormulaId();
  const formulaRouteKey = useSelectedFormulaRouteKey();
  const [adapter, setAdapter] = useState<ScaleAdapter | null>(null);
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [state, setState] = useState<string>('disconnected');
  const [busy, setBusy] = useState(false);

  const { data: formula } = useQuery({
    queryKey: ['formulas', formulaRouteKey],
    queryFn: () => api.get<FormulaDetail>(`/formulas/${formulaRouteKey}`),
    enabled: !!formulaRouteKey,
  });

  useEffect(() => {
    if (!formulaId) return;
    void api.post('/weighing/sessions', { formulaId }).catch(() => undefined);
  }, [formulaId]);

  const batch = Number(formula?.batchTargetGrams ?? 100);
  const concentrationPct = Number(
    (formula as { concentrationPct?: string })?.concentrationPct ?? 20,
  );
  const targets =
    formula?.lines.map((l) => ({
      name: l.materialName,
      grams: (Number(l.percent) / 100) * batch,
    })) ?? [];
  const diluentGrams = Math.max(0, batch / (concentrationPct / 100) - batch);

  useEffect(() => {
    if (!adapter) return;
    const offReading = adapter.onReading(setReading);
    const offState = adapter.onStateChange((s) => setState(s));
    return () => {
      offReading();
      offState();
    };
  }, [adapter]);

  async function connect(kind: 'mock' | 'serial' | 'bluetooth') {
    setBusy(true);
    try {
      if (adapter) await adapter.disconnect();
      let next: ScaleAdapter;
      if (kind === 'mock') next = new MockScale();
      else if (kind === 'serial') next = await connectSerial();
      else next = await connectBluetooth();
      setAdapter(next);
      await next.connect();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (adapter) await adapter.disconnect();
    setAdapter(null);
    setReading(null);
    setState('disconnected');
  }

  const connected = state !== 'disconnected' && !!adapter;

  return (
    <div>
      <h1 className="fc-page-title">{t('weighing.title')}</h1>
      <p className="fc-muted">{t('weighing.subtitle')}</p>

      <div className={styles.formulaBar}>
        <FormulaSelector showCreate={false} />
      </div>

      {targets.length > 0 ? (
        <div className={`fc-card ${styles.targets}`}>
          <h2>{t('weighing.targets')}</h2>
          <ul>
            {targets.map((row) => (
              <li key={row.name}>
                <strong>{row.name}</strong>
                <em>{row.grams.toFixed(2)} g</em>
              </li>
            ))}
            <li>
              <strong>{t('weighing.diluent')}</strong>
              <em>{diluentGrams.toFixed(2)} g</em>
            </li>
          </ul>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className="fc-btn fc-btn--primary"
          disabled={busy}
          onClick={() => void connect('mock')}
        >
          {t('weighing.mock')}
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--ghost"
          disabled={busy || !isSerialSupported()}
          onClick={() => void connect('serial')}
        >
          {t('weighing.serial')}
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--ghost"
          disabled={busy || !isBluetoothSupported()}
          onClick={() => void connect('bluetooth')}
        >
          {t('weighing.bluetooth')}
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--amber"
          disabled={!adapter}
          onClick={() => void adapter?.tare()}
        >
          {t('weighing.tare')}
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--ghost"
          disabled={!adapter}
          onClick={() => void disconnect()}
        >
          {t('weighing.disconnect')}
        </button>
      </div>

      <ScalePulseReadout
        connected={connected}
        grams={reading?.value ?? null}
        label={connected ? state : t('weighing.disconnected')}
      />
    </div>
  );
}
