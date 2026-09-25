import { describe, expect, it, vi } from 'vitest';
import { IfraController } from './ifra.controller';

describe('IfraController.analyze', () => {
  it('aggregates allergens and flags red over limit', () => {
    const ctrl = new IfraController({} as any);
    const report = ctrl.analyze({
      category: 4,
      limits: { Linalool: 5 },
      lines: [
        {
          id: '1',
          materialId: 'm1',
          label: 'Bergamot',
          amountGrams: 10,
          allergens: [{ name: 'Linalool', fraction: 0.5 }],
        },
      ],
    });
    expect(report.overallStatus).toBe('red');
    expect(report.allergens[0]?.name).toBe('Linalool');
  });
});
