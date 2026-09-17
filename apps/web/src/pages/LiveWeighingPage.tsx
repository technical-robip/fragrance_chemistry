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
import styles from './LiveWeighingPage.module.css';

export function LiveWeighingPage() {
  const [adapter, setAdapter] = useState<ScaleAdapter | null>(null);
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [state, setState] = useState<string>('disconnected');
  const [busy, setBusy] = useState(false);

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

  return (
    <div>
      <h1 className="fc-page-title">Live weighing</h1>
      <p className="fc-muted">
        Scale bridge via <code>@fc/scale-bridge</code> — mock, serial stub, or Bluetooth stub.
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className="fc-btn fc-btn--primary"
          disabled={busy}
          onClick={() => void connect('mock')}
        >
          Mock scale
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--ghost"
          disabled={busy || !isSerialSupported()}
          title={isSerialSupported() ? 'Serial stub' : 'Web Serial not available in this browser'}
          onClick={() => void connect('serial')}
        >
          Serial (stub)
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--ghost"
          disabled={busy || !isBluetoothSupported()}
          onClick={() => void connect('bluetooth')}
        >
          Bluetooth (stub)
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--amber"
          disabled={!adapter}
          onClick={() => void adapter?.tare()}
        >
          Tare
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--ghost"
          disabled={!adapter}
          onClick={() => void disconnect()}
        >
          Disconnect
        </button>
      </div>

      <div className={`fc-card ${styles.display}`}>
        <span className={styles.state}>{state}</span>
        <strong className={styles.value}>{reading ? reading.value.toFixed(4) : '—'}</strong>
        <span className={styles.unit}>{reading?.unit ?? 'g'}</span>
        {reading ? (
          <span className={reading.stable ? styles.stable : styles.unstable}>
            {reading.stable ? 'Stable' : 'Settling…'}
          </span>
        ) : null}
      </div>
    </div>
  );
}
