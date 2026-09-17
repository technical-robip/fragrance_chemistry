import type { ScaleAdapter, ScaleConnectionState, ScaleReading, ScaleUnit } from './types';

export type MockScaleOptions = {
  unit?: ScaleUnit;
  baseWeight?: number;
  driftAmplitude?: number;
  settleMs?: number;
};

export class MockScale implements ScaleAdapter {
  readonly id: string;
  readonly label: string;

  private state: ScaleConnectionState = 'disconnected';
  private readingCallbacks = new Set<(r: ScaleReading) => void>();
  private stateCallbacks = new Set<(s: ScaleConnectionState) => void>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tareOffset = 0;
  private readonly unit: ScaleUnit;
  private readonly baseWeight: number;
  private readonly driftAmplitude: number;
  private readonly settleMs: number;
  private connectStartedAt = 0;

  constructor(options: MockScaleOptions = {}, meta: { id?: string; label?: string } = {}) {
    this.id = meta.id ?? 'mock-scale';
    this.label = meta.label ?? 'Mock laboratory scale';
    this.unit = options.unit ?? 'g';
    this.baseWeight = options.baseWeight ?? 12.345;
    this.driftAmplitude = options.driftAmplitude ?? 0.008;
    this.settleMs = options.settleMs ?? 800;
  }

  getState(): ScaleConnectionState {
    return this.state;
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') return;
    this.setState('connecting');
    this.connectStartedAt = Date.now();
    await delay(400);
    this.setState('connected');
    this.startStream();
  }

  async disconnect(): Promise<void> {
    this.stopStream();
    this.setState('disconnected');
  }

  async tare(): Promise<void> {
    const current = this.sampleRaw();
    this.tareOffset += current;
    this.emitReading(this.buildReading(current - this.tareOffset, false));
    await delay(200);
    this.emitReading(this.buildReading(current - this.tareOffset, true));
  }

  onReading(callback: (reading: ScaleReading) => void): () => void {
    this.readingCallbacks.add(callback);
    return () => this.readingCallbacks.delete(callback);
  }

  onStateChange(callback: (state: ScaleConnectionState) => void): () => void {
    this.stateCallbacks.add(callback);
    callback(this.state);
    return () => this.stateCallbacks.delete(callback);
  }

  private setState(next: ScaleConnectionState): void {
    this.state = next;
    for (const cb of this.stateCallbacks) cb(next);
  }

  private startStream(): void {
    this.stopStream();
    this.intervalId = setInterval(() => {
      const raw = this.sampleRaw();
      const net = raw - this.tareOffset;
      const stable =
        Date.now() - this.connectStartedAt > this.settleMs &&
        Math.abs(net - this.baseWeight) < this.driftAmplitude * 2;
      this.emitReading(this.buildReading(net, stable));
    }, 120);
  }

  private stopStream(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private sampleRaw(): number {
    const t = Date.now() / 1000;
    const noise = Math.sin(t * 3.7) * this.driftAmplitude;
    return this.baseWeight + noise;
  }

  private buildReading(value: number, stable: boolean): ScaleReading {
    return {
      value: Math.max(0, Number(value.toFixed(4))),
      unit: this.unit,
      stable,
      timestamp: Date.now(),
    };
  }

  private emitReading(reading: ScaleReading): void {
    for (const cb of this.readingCallbacks) cb(reading);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
