import {
  connectBluetooth,
  connectSerial,
  isBluetoothSupported,
  isSerialSupported,
  MockScale,
  type ScaleAdapter,
  type ScaleReading,
} from '@fc/scale-bridge';
import {
  applyDiluentPour,
  applyPour,
  scaleOpenBatch,
  sessionDiluentGrams,
  type PourAdjustMode,
  type SessionLine,
} from '@fc/formula-engine';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FormulaSelector,
  useSelectedFormulaId,
  useSelectedFormulaRouteKey,
} from '@/components/FormulaSelector';
import { LineListControls } from '@/components/LineListControls';
import { ScalePulseReadout } from '@/components/viz/ScalePulseReadout';
import { api } from '@/lib/api-client';
import { displayToGrams, gramsToDisplay, type AmountUnit } from '@/lib/batch-units';
import { familyHue } from '@/lib/formula-viz';
import { useLineListPrefs } from '@/lib/line-list-prefs';
import {
  acceptedPourGrams,
  formatWeighAmount,
  groupWeighLines,
  isPoured,
  lineTargetGrams,
  nextOpenStep,
} from '@/lib/weigh-session';
import styles from './LiveWeighingPage.module.css';

type PyramidNote = 'top' | 'middle' | 'base' | 'modifier';

type FormulaLine = {
  materialId: string;
  materialName: string;
  olfactoryFamily?: string | null;
  percent: string;
  weighedGrams?: string | null;
  sortOrder: number;
  pyramidNote?: string | null;
  childFormulaId?: string | null;
  stockConcentrationPct?: string | null;
  solvent?: string | null;
};

type FormulaDetail = {
  id: string;
  name: string;
  batchTargetGrams: string;
  concentrationPct?: string;
  lines: FormulaLine[];
};

type StepLine = SessionLine & {
  materialName: string;
  olfactoryFamily?: string | null;
  sortOrder: number;
  pyramidNote?: PyramidNote;
  childFormulaId?: string;
  stockConcentrationPct?: number;
  solvent?: string;
};

type Session = {
  formulaId: string;
  name: string;
  lines: StepLine[];
  batchGrams: number;
  concentrationPct: number;
  step: number;
  diluentActual: number | null;
  adjust: boolean;
  mode: PourAdjustMode;
};

const NOTES = new Set<PyramidNote>(['top', 'middle', 'base', 'modifier']);

function asNote(value: string | null | undefined): PyramidNote | undefined {
  return value && NOTES.has(value as PyramidNote) ? (value as PyramidNote) : undefined;
}

function sessionFromFormula(formula: FormulaDetail): Session {
  const batchGrams = Number(formula.batchTargetGrams) || 0;
  const concentrationPct = Number(formula.concentrationPct ?? 20);
  const lines = formula.lines.map((line, index) => {
    const percent = Number(line.percent);
    return {
      key: `${line.materialId}:${index}`,
      materialId: line.materialId,
      materialName: line.materialName,
      olfactoryFamily: line.olfactoryFamily,
      percent,
      targetGrams: lineTargetGrams(percent, batchGrams),
      actualGrams: acceptedPourGrams(line.weighedGrams),
      sortOrder: index,
      pyramidNote: asNote(line.pyramidNote),
      childFormulaId: line.childFormulaId ?? undefined,
      stockConcentrationPct:
        line.stockConcentrationPct != null && line.stockConcentrationPct !== ''
          ? Number(line.stockConcentrationPct)
          : undefined,
      solvent: line.solvent ?? undefined,
    };
  });
  const firstOpen = lines.findIndex((line) => !isPoured(line.actualGrams));
  return {
    formulaId: formula.id,
    name: formula.name,
    batchGrams,
    concentrationPct,
    step: firstOpen === -1 ? lines.length : firstOpen,
    diluentActual: null,
    adjust: true,
    mode: 'keepRatios',
    lines,
  };
}

function diluentTarget(session: Session): number {
  return sessionDiluentGrams(session.batchGrams, session.concentrationPct);
}

function hasDiluent(session: Session): boolean {
  return diluentTarget(session) > 0.0005;
}

function phase(session: Session): 'line' | 'diluent' | 'done' {
  if (session.step < session.lines.length) return 'line';
  if (session.step === session.lines.length && hasDiluent(session)) return 'diluent';
  return 'done';
}

function pourStarted(session: Session): boolean {
  return (
    session.lines.some((line) => isPoured(line.actualGrams)) || isPoured(session.diluentActual)
  );
}

function mergeLines(prev: StepLine[], next: SessionLine[]): StepLine[] {
  return prev.map((line, index) => {
    const updated = next[index];
    if (!updated) return line;
    return {
      ...line,
      percent: updated.percent,
      targetGrams: updated.targetGrams,
      actualGrams: updated.actualGrams,
    };
  });
}

function linePayload(lines: StepLine[]) {
  return {
    lines: lines.map((line, index) => ({
      materialId: line.materialId,
      percent: line.percent,
      sortOrder: index,
      pyramidNote: line.pyramidNote,
      weighedGrams: isPoured(line.actualGrams) ? line.actualGrams! : undefined,
      targetGrams: line.targetGrams,
      childFormulaId: line.childFormulaId,
      stockConcentrationPct: line.stockConcentrationPct,
      solvent: line.solvent,
    })),
  };
}

function forceTouchAvailable(): boolean {
  return typeof MouseEvent !== 'undefined' && 'webkitForce' in MouseEvent.prototype;
}

function readForce(event: Event): number | null {
  const force = (event as MouseEvent & { webkitForce?: number }).webkitForce;
  return typeof force === 'number' && Number.isFinite(force) ? force : null;
}

export function LiveWeighingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const formulaId = useSelectedFormulaId();
  const formulaRouteKey = useSelectedFormulaRouteKey();
  const [adapter, setAdapter] = useState<ScaleAdapter | null>(null);
  const [reading, setReading] = useState<ScaleReading | null>(null);
  const [state, setState] = useState<string>('disconnected');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [batchDraft, setBatchDraft] = useState('');
  const [batchUnit, setBatchUnit] = useState<AmountUnit>('grams');
  const [blocked, setBlocked] = useState(false);
  const [tip, setTip] = useState<'adjust' | 'ratios' | 'batch' | null>(null);
  const [stepQuery, setStepQuery] = useState('');
  const { sort, showFamily, chooseSort, toggleFamily } = useLineListPrefs();
  const [setupOpen, setSetupOpen] = useState(true);
  const [connectOpen, setConnectOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [pouring, setPouring] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const history = useRef<Session[]>([]);
  const batchFocused = useRef(false);
  const batchUnitRef = useRef(batchUnit);
  batchUnitRef.current = batchUnit;
  const pourCap = useRef(0);
  const readingRef = useRef<number | null>(null);
  const pourGrams = useRef(0);
  const pourForce = useRef<number | null>(null);
  const pourTimer = useRef<number | null>(null);
  const forceListener = useRef<((event: Event) => void) | null>(null);
  const adapterRef = useRef<ScaleAdapter | null>(null);
  adapterRef.current = adapter;
  readingRef.current = reading?.value ?? null;

  const { data: formula, isLoading } = useQuery({
    queryKey: ['formulas', formulaRouteKey],
    queryFn: () => api.get<FormulaDetail>(`/formulas/${formulaRouteKey}`),
    enabled: !!formulaRouteKey,
  });

  useEffect(() => {
    if (!formulaId) return;
    void api.post('/weighing/sessions', { formulaId }).catch(() => undefined);
  }, [formulaId]);

  useEffect(() => {
    if (!formula) return;
    setSession((prev) => (prev?.formulaId === formula.id ? prev : sessionFromFormula(formula)));
  }, [formula]);

  useEffect(() => {
    history.current = [];
    setCanUndo(false);
    setBlocked(false);
    setNotice(null);
    setStepQuery('');
    setSetupOpen(true);
  }, [formula?.id]);

  useEffect(() => {
    if (!session || batchFocused.current) return;
    setBatchDraft(gramsToDisplay(roundBatch(session.batchGrams), batchUnitRef.current));
  }, [session]);

  useEffect(() => {
    if (!adapter) return;
    const offReading = adapter.onReading(setReading);
    const offState = adapter.onStateChange((next) => setState(next));
    return () => {
      offReading();
      offState();
    };
  }, [adapter]);

  useEffect(() => {
    return () => {
      if (pourTimer.current != null) window.clearInterval(pourTimer.current);
    };
  }, []);

  const persist = useMutation({
    mutationFn: async (next: Session) => {
      await api.patch(`/formulas/${next.formulaId}`, {
        batchTargetGrams: next.batchGrams,
        concentrationPct: next.concentrationPct,
      });
      await api.put(`/formulas/${next.formulaId}/lines`, linePayload(next.lines));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['formulas'] });
    },
  });

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
      if (next instanceof MockScale) next.setNetGrams(0);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    stopPour();
    if (adapter) await adapter.disconnect();
    setAdapter(null);
    setReading(null);
    setState('disconnected');
  }

  function stopPour() {
    if (pourTimer.current != null) window.clearInterval(pourTimer.current);
    pourTimer.current = null;
    if (forceListener.current) {
      window.removeEventListener('webkitmouseforcechanged', forceListener.current);
      forceListener.current = null;
    }
    pourForce.current = null;
    setPouring(false);
  }

  function onPourDown(event: ReactPointerEvent<HTMLButtonElement>) {
    const current = adapterRef.current;
    if (!(current instanceof MockScale) || pourTimer.current != null) return;
    const force = readForce(event.nativeEvent);
    if (force != null) pourForce.current = force;
    const cap = pourCap.current;
    pourGrams.current = readingRef.current ?? 0;
    if (cap > 0 && pourGrams.current >= cap - 0.0005) {
      pourGrams.current = cap;
      current.setNetGrams(cap);
      return;
    }
    setPouring(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    const onForce = (native: Event) => {
      const next = readForce(native);
      if (next != null) pourForce.current = next;
    };
    forceListener.current = onForce;
    window.addEventListener('webkitmouseforcechanged', onForce);
    pourTimer.current = window.setInterval(() => {
      const rate = pourForce.current != null ? 0.08 * Math.max(0.4, pourForce.current) : 0.12;
      const cap = pourCap.current;
      const next = pourGrams.current + rate;
      if (cap > 0 && next >= cap - 0.0005) {
        pourGrams.current = cap;
        const scale = adapterRef.current;
        if (scale instanceof MockScale) scale.setNetGrams(cap);
        stopPour();
        return;
      }
      pourGrams.current = Math.min(5000, next);
      const scale = adapterRef.current;
      if (scale instanceof MockScale) scale.setNetGrams(pourGrams.current);
    }, 50);
  }

  async function commitBatch() {
    if (!session || pourStarted(session)) return;
    const parsed = Number(batchDraft.trim().replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBatchDraft(gramsToDisplay(roundBatch(session.batchGrams), batchUnitRef.current));
      return;
    }
    const grams = displayToGrams(parsed, batchUnit);
    const scaled = scaleOpenBatch(session.lines, grams, session.concentrationPct);
    const next: Session = {
      ...session,
      batchGrams: scaled.batchGrams,
      lines: mergeLines(session.lines, scaled.lines),
    };
    setSession(next);
    setNotice(null);
    try {
      await persist.mutateAsync(next);
    } catch {
      setNotice(t('weighing.saveFailed'));
    }
  }

  function changeBatchUnit(nextUnit: AmountUnit) {
    if (!session) return;
    const parsed = Number(batchDraft.trim().replace(',', '.'));
    const grams =
      Number.isFinite(parsed) && parsed > 0
        ? displayToGrams(parsed, batchUnit)
        : session.batchGrams;
    setBatchUnit(nextUnit);
    setBatchDraft(gramsToDisplay(grams, nextUnit));
    if (pourStarted(session) || Math.abs(grams - session.batchGrams) < 0.0001) return;
    const scaled = scaleOpenBatch(session.lines, grams, session.concentrationPct);
    const updated: Session = {
      ...session,
      batchGrams: scaled.batchGrams,
      lines: mergeLines(session.lines, scaled.lines),
    };
    setSession(updated);
    void persist.mutateAsync(updated).catch(() => setNotice(t('weighing.saveFailed')));
  }

  function selectStep(index: number) {
    setSession((prev) => {
      if (!prev || index < 0) return prev;
      if (index < prev.lines.length && isPoured(prev.lines[index]?.actualGrams)) return prev;
      if (index === prev.lines.length && isPoured(prev.diluentActual)) return prev;
      if (index > prev.lines.length) return prev;
      return { ...prev, step: index };
    });
  }

  async function acceptPour() {
    if (!session) return;
    const actual = readingRef.current;
    if (actual == null || actual <= 0) return;
    const kind = phase(session);
    if (kind === 'done') return;
    const previous = {
      ...session,
      lines: session.lines.map((line) => ({ ...line })),
    };

    if (kind === 'diluent') {
      const result = applyDiluentPour({
        actualGrams: actual,
        batchGrams: session.batchGrams,
        concentrationPct: session.concentrationPct,
        adjust: session.adjust,
      });
      const next: Session = {
        ...session,
        batchGrams: result.batchGrams,
        concentrationPct: result.concentrationPct,
        diluentActual: result.actualGrams,
        step: nextOpenStep(
          session.lines.map((line) => line.actualGrams),
          false,
        ),
      };
      history.current.push(previous);
      setCanUndo(true);
      setSession(next);
      setBlocked(false);
      setNotice(result.adjusted ? t('weighing.rescaled') : null);
      try {
        await persist.mutateAsync(next);
        if (adapter instanceof MockScale) adapter.setNetGrams(0);
      } catch {
        history.current.pop();
        setCanUndo(history.current.length > 0);
        setSession(previous);
        setNotice(t('weighing.saveFailed'));
      }
      return;
    }

    const current = session.lines[session.step];
    if (!current) return;
    const result = applyPour({
      lines: session.lines,
      lineKey: current.key,
      actualGrams: actual,
      batchGrams: session.batchGrams,
      concentrationPct: session.concentrationPct,
      adjust: session.adjust,
      mode: session.mode,
    });
    if (!result.ok) {
      setBlocked(true);
      setNotice(t('weighing.fixedExceed'));
      return;
    }
    const lines = mergeLines(session.lines, result.lines);
    const next: Session = {
      ...session,
      lines,
      batchGrams: result.batchGrams,
      concentrationPct: result.concentrationPct,
      step: nextOpenStep(
        lines.map((line) => line.actualGrams),
        session.diluentActual == null &&
          sessionDiluentGrams(result.batchGrams, result.concentrationPct) > 0.0005,
      ),
    };
    history.current.push(previous);
    setCanUndo(true);
    setSession(next);
    setBlocked(false);
    setNotice(result.adjusted ? t('weighing.rescaled') : null);
    try {
      await persist.mutateAsync(next);
      if (adapter instanceof MockScale) adapter.setNetGrams(0);
    } catch {
      history.current.pop();
      setCanUndo(history.current.length > 0);
      setSession(previous);
      setNotice(t('weighing.saveFailed'));
    }
  }

  async function undoPour() {
    const previous = history.current.pop();
    if (!previous || !session) return;
    setCanUndo(history.current.length > 0);
    setSession(previous);
    setBlocked(false);
    setNotice(null);
    try {
      await persist.mutateAsync(previous);
    } catch {
      history.current.push(previous);
      setCanUndo(true);
      setSession(session);
      setNotice(t('weighing.saveFailed'));
    }
  }

  const connected = state !== 'disconnected' && !!adapter;
  const mockConnected = adapter instanceof MockScale && connected;
  const kind = session ? phase(session) : 'done';
  const currentLine = session && kind === 'line' ? session.lines[session.step] : null;
  const target =
    kind === 'diluent' && session ? diluentTarget(session) : (currentLine?.targetGrams ?? null);
  const deviation = reading && target != null ? reading.value - target : null;
  pourCap.current = target ?? 0;

  useEffect(() => {
    if (!session) return;
    document
      .querySelector('[data-testid="weigh-steps"] [aria-current="step"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [session?.step, session?.formulaId]);
  const locked = session ? pourStarted(session) : false;

  useEffect(() => {
    if (locked) setSetupOpen(false);
  }, [locked]);

  useEffect(() => {
    setConnectOpen(!connected);
  }, [connected]);
  const forceTouch = forceTouchAvailable();

  return (
    <div className={styles.page} data-testid="weigh-session">
      <div className={styles.headerRow}>
        <header className={styles.header}>
          <h1 className="fc-page-title">{t('weighing.title')}</h1>
          <p className="fc-muted">{t('weighing.subtitle')}</p>
        </header>
        <div className={styles.formulaBar}>
          <FormulaSelector showCreate={false} />
        </div>
      </div>

      {isLoading ? (
        <p className="fc-muted">{t('common.loading')}</p>
      ) : !session || session.lines.length === 0 ? (
        <p className="fc-muted">{t('weighing.empty')}</p>
      ) : (
        <div className={styles.bench}>
          <div className={styles.columns}>
            <section className={styles.stage} aria-label={t('weighing.current')}>
              <ScalePulseReadout
                compact
                connected={connected}
                grams={reading?.value ?? null}
                label={connected ? state : t('weighing.disconnected')}
              />
              <div className={styles.now}>
                <p className={styles.kicker}>{t('weighing.current')}</p>
                <h2 data-testid="weigh-current">
                  {kind === 'diluent'
                    ? t('weighing.diluent')
                    : kind === 'done'
                      ? t('weighing.complete')
                      : currentLine?.materialName}
                </h2>
                {target != null && kind !== 'done' ? (
                  <p className={styles.aim}>
                    <span>{t('weighing.target')}</span>
                    <strong data-testid="weigh-target">
                      {formatWeighAmount(target, batchUnit)}
                    </strong>
                    {deviation != null ? (
                      <em className={deviation > 0.0005 ? styles.over : styles.delta}>
                        {deviation > 0 ? '+' : ''}
                        {formatWeighAmount(deviation, batchUnit)}
                      </em>
                    ) : null}
                  </p>
                ) : null}
              </div>

              {mockConnected ? (
                <button
                  type="button"
                  className={styles.pour}
                  data-testid="weigh-pour"
                  data-pouring={pouring ? 'true' : 'false'}
                  onPointerDown={onPourDown}
                  onPointerUp={stopPour}
                  onPointerCancel={stopPour}
                >
                  {t('weighing.pour')}
                </button>
              ) : null}
              {mockConnected ? (
                <p className={styles.hint}>
                  {forceTouch ? t('weighing.pourForce') : t('weighing.pourHold')}
                </p>
              ) : null}

              <div className={styles.acceptRow}>
                <button
                  type="button"
                  className={`fc-btn fc-btn--primary ${styles.accept}`}
                  data-testid="weigh-accept"
                  disabled={!connected || reading == null || kind === 'done' || persist.isPending}
                  onClick={() => void acceptPour()}
                >
                  {t('weighing.accept')}
                </button>
                <button
                  type="button"
                  className="fc-btn fc-btn--ghost"
                  disabled={!canUndo || persist.isPending}
                  onClick={() => void undoPour()}
                >
                  {t('weighing.undo')}
                </button>
              </div>

              {notice ? (
                <p className={styles.notice} role="status">
                  {notice}
                </p>
              ) : null}
              {blocked ? (
                <button
                  type="button"
                  className="fc-btn fc-btn--ghost"
                  onClick={() => {
                    setSession((prev) => (prev ? { ...prev, mode: 'keepRatios' } : prev));
                    setBlocked(false);
                    setNotice(null);
                  }}
                >
                  {t('weighing.useRatios')}
                </button>
              ) : null}

              <div className={styles.connect}>
                <button
                  type="button"
                  className={styles.connectToggle}
                  aria-expanded={connectOpen}
                  onClick={() => setConnectOpen((open) => !open)}
                >
                  {t('weighing.scaleLink')}
                </button>
                {connectOpen ? (
                  <div className={styles.links}>
                    <button
                      type="button"
                      className="fc-btn fc-btn--ghost"
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
                      className="fc-btn fc-btn--ghost"
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
                ) : null}
              </div>
            </section>

            <aside className={styles.queue}>
              <div className={styles.recipeSetup}>
                <div className={styles.recipeBar}>
                  <button
                    type="button"
                    className={styles.setupToggle}
                    aria-expanded={setupOpen}
                    onClick={() => setSetupOpen((open) => !open)}
                  >
                    <span>
                      {t('weighing.batch')} {batchDraft}{' '}
                      {batchUnit === 'grams'
                        ? 'g'
                        : batchUnit === 'ml'
                          ? 'ml'
                          : t('workbench.unitDrops')}
                    </span>
                    <span className={styles.setupMode}>
                      {session.adjust
                        ? session.mode === 'keepRatios'
                          ? t('weighing.modeRatios')
                          : t('weighing.modeBatch')
                        : t('weighing.adjustOff')}
                    </span>
                  </button>
                  <input
                    className={`fc-input ${styles.find}`}
                    value={stepQuery}
                    placeholder={t('weighing.findMaterial')}
                    aria-label={t('weighing.findMaterial')}
                    onChange={(event) => setStepQuery(event.target.value)}
                  />
                </div>
                {setupOpen ? (
                  <div className={styles.controls} data-locked={locked ? 'true' : 'false'}>
                    <label className="fc-label" htmlFor="weigh-batch">
                      {t('weighing.batch')}
                    </label>
                    <div className={styles.batchRow}>
                      <input
                        id="weigh-batch"
                        data-testid="weigh-batch"
                        className="fc-input"
                        inputMode="decimal"
                        value={batchDraft}
                        disabled={locked || persist.isPending}
                        onFocus={() => {
                          batchFocused.current = true;
                        }}
                        onChange={(event) => setBatchDraft(event.target.value)}
                        onBlur={() => {
                          batchFocused.current = false;
                          void commitBatch();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            (event.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                      />
                      <div
                        className={styles.units}
                        role="group"
                        aria-label={t('workbench.batchUnit')}
                      >
                        {(
                          [
                            ['grams', 'g'],
                            ['ml', 'ml'],
                            ['drops', t('workbench.unitDrops')],
                          ] as const
                        ).map(([id, label]) => (
                          <button
                            key={id}
                            type="button"
                            className={batchUnit === id ? styles.segOn : styles.seg}
                            aria-pressed={batchUnit === id}
                            onClick={() => changeBatchUnit(id)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {locked ? <p className={styles.hint}>{t('weighing.batchLocked')}</p> : null}
                    {batchUnit !== 'grams' ? (
                      <p className={styles.caveat} role="note">
                        {t('weighing.unitCaveat')}
                      </p>
                    ) : null}
                    <div className={styles.adjust} role="group" aria-label={t('weighing.adjust')}>
                      <Choice
                        pressed={session.adjust}
                        testId="weigh-adjust"
                        label={session.adjust ? t('weighing.adjustOn') : t('weighing.adjustOff')}
                        about={t('weighing.adjustAbout')}
                        help={t('weighing.adjustHelp')}
                        open={tip === 'adjust'}
                        onToggle={() =>
                          setSession((prev) => (prev ? { ...prev, adjust: !prev.adjust } : prev))
                        }
                        onInfo={() => setTip((current) => (current === 'adjust' ? null : 'adjust'))}
                      />
                      <Choice
                        pressed={session.mode === 'keepRatios'}
                        disabled={!session.adjust}
                        testId="weigh-mode-ratios"
                        label={t('weighing.modeRatios')}
                        about={t('weighing.ratiosAbout')}
                        help={t('weighing.ratiosHelp')}
                        open={tip === 'ratios'}
                        onToggle={() =>
                          setSession((prev) => (prev ? { ...prev, mode: 'keepRatios' } : prev))
                        }
                        onInfo={() => setTip((current) => (current === 'ratios' ? null : 'ratios'))}
                      />
                      <Choice
                        pressed={session.mode === 'keepBatch'}
                        disabled={!session.adjust}
                        testId="weigh-mode-batch"
                        label={t('weighing.modeBatch')}
                        about={t('weighing.batchModeAbout')}
                        help={t('weighing.batchModeHelp')}
                        open={tip === 'batch'}
                        onToggle={() =>
                          setSession((prev) => (prev ? { ...prev, mode: 'keepBatch' } : prev))
                        }
                        onInfo={() => setTip((current) => (current === 'batch' ? null : 'batch'))}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
              <div className={styles.listTools}>
                <LineListControls
                  sort={sort}
                  showFamily={showFamily}
                  onSort={chooseSort}
                  onToggleFamily={toggleFamily}
                  showSort={false}
                />
              </div>
              <div className={styles.colHead} aria-hidden>
                <span />
                <span>{t('weighing.colMaterial')}</span>
                <span className={styles.colTarget}>{t('weighing.target')}</span>
                <span className={styles.colActual}>{t('weighing.colWeighed')}</span>
                <span className={styles.colMobile} />
              </div>
              <ol
                className={styles.steps}
                data-testid="weigh-steps"
                aria-label={t('weighing.stepList')}
              >
                {(showFamily
                  ? groupWeighLines(session.lines, stepQuery)
                  : [
                      {
                        family: '',
                        items: session.lines.flatMap((line, index) => {
                          const needle = stepQuery.trim().toLowerCase();
                          if (needle && !line.materialName.toLowerCase().includes(needle)) {
                            return [];
                          }
                          return [{ line, index }];
                        }),
                      },
                    ]
                )
                  .filter((group) => group.items.length > 0)
                  .map((group) => (
                    <li key={group.family || 'flat'} className={styles.familyBlock}>
                      {showFamily ? (
                        <p className={styles.family}>
                          <span
                            className={styles.swatch}
                            style={{ background: familyHue(group.family) }}
                          />
                          <span>{group.family}</span>
                          <em>{group.items.length}</em>
                        </p>
                      ) : null}
                      <ol className={styles.familyLines}>
                        {group.items.map(({ line, index }) => {
                          const poured = isPoured(line.actualGrams);
                          const current = index === session.step;
                          const status = poured ? 'done' : current ? 'current' : 'upcoming';
                          const live = weighedCell(
                            poured,
                            current,
                            line.actualGrams,
                            reading,
                            connected,
                            batchUnit,
                          );
                          return (
                            <li key={line.key}>
                              <button
                                type="button"
                                className={
                                  status === 'current'
                                    ? styles.stepCurrent
                                    : status === 'done'
                                      ? styles.stepDone
                                      : styles.step
                                }
                                aria-current={status === 'current' ? 'step' : undefined}
                                disabled={poured}
                                onClick={() => selectStep(index)}
                              >
                                <AcceptedMark poured={poured} />
                                <span>{line.materialName}</span>
                                <span className={styles.colTarget}>
                                  {formatWeighAmount(line.targetGrams, batchUnit)}
                                </span>
                                <em
                                  className={`${styles.colActual} ${live.pending ? styles.liveFig : ''}`}
                                >
                                  {live.text}
                                </em>
                                <em
                                  className={`${styles.colMobile} ${live.pending ? styles.liveFig : ''}`}
                                >
                                  {poured || live.pending
                                    ? live.text
                                    : formatWeighAmount(line.targetGrams, batchUnit)}
                                </em>
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </li>
                  ))}
                {hasDiluent(session) && diluentMatches(t('weighing.diluent'), stepQuery) ? (
                  <li className={styles.familyBlock}>
                    {showFamily ? (
                      <p className={styles.family}>
                        <span
                          className={styles.swatch}
                          style={{ background: 'var(--fc-accent)' }}
                        />
                        <span>{t('weighing.diluent')}</span>
                      </p>
                    ) : null}
                    <ol className={styles.familyLines}>
                      <li>
                        <button
                          type="button"
                          className={
                            kind === 'diluent'
                              ? styles.stepCurrent
                              : isPoured(session.diluentActual)
                                ? styles.stepDone
                                : styles.step
                          }
                          aria-current={kind === 'diluent' ? 'step' : undefined}
                          disabled={isPoured(session.diluentActual)}
                          onClick={() => selectStep(session.lines.length)}
                        >
                          <AcceptedMark poured={isPoured(session.diluentActual)} />
                          <span>{t('weighing.diluent')}</span>
                          <span className={styles.colTarget}>
                            {formatWeighAmount(diluentTarget(session), batchUnit)}
                          </span>
                          <em
                            className={`${styles.colActual} ${kind === 'diluent' && !isPoured(session.diluentActual) ? styles.liveFig : ''}`}
                          >
                            {
                              weighedCell(
                                isPoured(session.diluentActual),
                                kind === 'diluent',
                                session.diluentActual,
                                reading,
                                connected,
                                batchUnit,
                              ).text
                            }
                          </em>
                          <em className={styles.colMobile}>
                            {isPoured(session.diluentActual)
                              ? formatWeighAmount(session.diluentActual ?? 0, batchUnit)
                              : kind === 'diluent' && connected && reading
                                ? formatWeighAmount(reading.value, batchUnit)
                                : formatWeighAmount(diluentTarget(session), batchUnit)}
                          </em>
                        </button>
                      </li>
                    </ol>
                  </li>
                ) : null}
              </ol>
              {stepQuery.trim() &&
              groupWeighLines(session.lines, stepQuery).length === 0 &&
              !diluentMatches(t('weighing.diluent'), stepQuery) ? (
                <p className={styles.hint}>{t('weighing.noMaterialMatch')}</p>
              ) : null}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

function weighedCell(
  poured: boolean,
  current: boolean,
  actual: number | null,
  reading: { value: number } | null,
  connected: boolean,
  unit: AmountUnit,
): { text: string; pending: boolean } {
  if (poured) return { text: formatWeighAmount(actual ?? 0, unit), pending: false };
  if (current && connected && reading) {
    return { text: formatWeighAmount(reading.value, unit), pending: true };
  }
  if (current) return { text: formatWeighAmount(0, unit), pending: true };
  return { text: '—', pending: false };
}

function diluentMatches(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || label.toLowerCase().includes(needle);
}

function AcceptedMark({ poured }: { poured: boolean }) {
  return (
    <span className={poured ? styles.markOn : styles.mark} aria-hidden>
      {poured ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5 9.2 17 19 7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function roundBatch(grams: number): number {
  return Math.round(grams * 1000) / 1000;
}

function Choice({
  pressed,
  disabled,
  testId,
  label,
  about,
  help,
  open,
  onToggle,
  onInfo,
}: {
  pressed: boolean;
  disabled?: boolean;
  testId: string;
  label: string;
  about: string;
  help: string;
  open: boolean;
  onToggle: () => void;
  onInfo: () => void;
}) {
  return (
    <span className={styles.choice}>
      <button
        type="button"
        className={pressed ? styles.segOn : styles.seg}
        aria-pressed={pressed}
        disabled={disabled}
        data-testid={testId}
        onClick={onToggle}
      >
        {label}
      </button>
      <button
        type="button"
        className={styles.info}
        aria-label={about}
        aria-expanded={disabled ? false : open}
        disabled={disabled}
        onClick={onInfo}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 10.5v6M12 7.75h.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && !disabled ? (
        <span role="tooltip" className={styles.tip}>
          <strong>{label}</strong>
          <p>{help}</p>
        </span>
      ) : null}
    </span>
  );
}
