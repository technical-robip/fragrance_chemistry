export type {
  BluetoothScaleOptions,
  ScaleAdapter,
  ScaleConnectionState,
  ScaleReading,
  ScaleUnit,
  SerialScaleOptions,
} from './types';
export { MockScale, type MockScaleOptions } from './mock-scale';
export { connectSerial, isSerialSupported } from './serial';
export { connectBluetooth, isBluetoothSupported } from './bluetooth';
