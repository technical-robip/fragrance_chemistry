export type ScaleUnit = 'g' | 'mg' | 'kg';

export type ScaleReading = {
  value: number;
  unit: ScaleUnit;
  stable: boolean;
  timestamp: number;
};

export type ScaleConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ScaleAdapter {
  readonly id: string;
  readonly label: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getState(): ScaleConnectionState;
  onReading(callback: (reading: ScaleReading) => void): () => void;
  onStateChange(callback: (state: ScaleConnectionState) => void): () => void;
  tare(): Promise<void>;
}

export type SerialScaleOptions = {
  baudRate?: number;
  path?: string;
};

export type BluetoothScaleOptions = {
  deviceNamePrefix?: string;
  serviceUuid?: string;
};
