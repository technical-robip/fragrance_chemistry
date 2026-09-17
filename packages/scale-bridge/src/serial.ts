import { delay, StubScaleAdapter } from './stub-adapter';
import type { ScaleAdapter, SerialScaleOptions } from './types';

/**
 * Serial/USB scale bridge stub — wire to Web Serial or native Capacitor plugin later.
 */
export async function connectSerial(_options: SerialScaleOptions = {}): Promise<ScaleAdapter> {
  await delay(300);
  return new StubScaleAdapter('serial-stub', 'Serial scale (stub)', {
    baseWeight: 0,
    unit: 'g',
  });
}

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}
