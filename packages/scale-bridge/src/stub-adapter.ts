import { MockScale, type MockScaleOptions } from './mock-scale';
import type { ScaleAdapter } from './types';

export class StubScaleAdapter extends MockScale {
  constructor(id: string, label: string, options?: MockScaleOptions) {
    super(options, { id, label });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { delay };
