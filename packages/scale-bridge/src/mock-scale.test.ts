import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectBluetooth, isBluetoothSupported } from './bluetooth';
import { MockScale } from './mock-scale';
import { connectSerial, isSerialSupported } from './serial';

describe('MockScale', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects, streams readings, tares, and disconnects', async () => {
    vi.useFakeTimers();
    const scale = new MockScale({ baseWeight: 10, driftAmplitude: 0.001, settleMs: 100 });
    const states: string[] = [];
    const readings: number[] = [];
    scale.onStateChange((s) => states.push(s));
    scale.onReading((r) => readings.push(r.value));

    const connectPromise = scale.connect();
    await vi.advanceTimersByTimeAsync(400);
    await connectPromise;
    expect(scale.getState()).toBe('connected');

    await vi.advanceTimersByTimeAsync(250);
    expect(readings.length).toBeGreaterThan(0);

    const tarePromise = scale.tare();
    await vi.advanceTimersByTimeAsync(200);
    await tarePromise;

    await scale.disconnect();
    expect(scale.getState()).toBe('disconnected');
    expect(states).toContain('connecting');
    expect(states).toContain('connected');
    expect(states).toContain('disconnected');
  });

  it('setNetGrams replaces the idle sine with the poured mass', async () => {
    vi.useFakeTimers();
    const scale = new MockScale({ baseWeight: 12.345, driftAmplitude: 0.008 });
    const readings: number[] = [];
    scale.onReading((reading) => readings.push(reading.value));
    const connectPromise = scale.connect();
    await vi.advanceTimersByTimeAsync(400);
    await connectPromise;

    scale.setNetGrams(0.684);
    expect(readings.at(-1)).toBeCloseTo(0.684, 3);

    await vi.advanceTimersByTimeAsync(400);
    expect(readings.at(-1)).toBeCloseTo(0.684, 3);
    expect(readings.at(-1)).not.toBeCloseTo(12.345, 2);

    const tarePromise = scale.tare();
    await vi.advanceTimersByTimeAsync(200);
    await tarePromise;
    expect(readings.at(-1)).toBe(0);

    await scale.disconnect();
  });

  it('is idempotent on double connect', async () => {
    vi.useFakeTimers();
    const scale = new MockScale();
    const p = scale.connect();
    await vi.advanceTimersByTimeAsync(400);
    await p;
    await scale.connect();
    expect(scale.getState()).toBe('connected');
    await scale.disconnect();
  });
});

describe('stubs', () => {
  it('reports serial/bluetooth support from navigator', () => {
    expect(typeof isSerialSupported()).toBe('boolean');
    expect(typeof isBluetoothSupported()).toBe('boolean');
  });

  it('connectSerial and connectBluetooth return adapters', async () => {
    vi.useFakeTimers();
    const serialP = connectSerial();
    await vi.advanceTimersByTimeAsync(300);
    const serial = await serialP;
    expect(serial.id).toBe('serial-stub');

    const btP = connectBluetooth();
    await vi.advanceTimersByTimeAsync(500);
    const bt = await btP;
    expect(bt.id).toBe('bluetooth-stub');
  });
});
