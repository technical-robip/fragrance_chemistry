import { delay, StubScaleAdapter } from './stub-adapter';
import type { BluetoothScaleOptions, ScaleAdapter } from './types';

/**
 * Bluetooth LE scale bridge stub — wire to Web Bluetooth or native bridge later.
 */
export async function connectBluetooth(
  _options: BluetoothScaleOptions = {},
): Promise<ScaleAdapter> {
  await delay(500);
  return new StubScaleAdapter('bluetooth-stub', 'Bluetooth scale (stub)', {
    baseWeight: 5.5,
    unit: 'g',
  });
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}
