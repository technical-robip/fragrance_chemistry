import { describe, expect, it } from 'vitest';
import { evaluateEuAnnexRestrictions } from './eu-annex';
import { evaluateEuLabelAllergens } from './eu-label';
import { EU_LABEL_ALLERGENS, EU_LABEL_THRESHOLD_PERCENT } from './eu-data';
import type { FormulaLine } from './types';

const linaloolNeat = (grams: number): FormulaLine => ({
  id: 'l1',
  materialId: 'mat-linalool',
  label: 'Linalool',
  amountGrams: grams,
  concentrationKind: 'neat',
  allergens: [{ name: 'Linalool', fraction: 1 }],
});

describe('evaluateEuLabelAllergens', () => {
  it('declares leave-on allergens above 0.001% and keeps rinse-off at 0.01%', () => {
    const lines: FormulaLine[] = [
      linaloolNeat(0.002),
      {
        id: 'eth',
        materialId: 'eth',
        label: 'Ethanol',
        amountGrams: 99.998,
        concentrationKind: 'neat',
      },
    ];
    const leaveOn = evaluateEuLabelAllergens(lines, 'leave_on');
    expect(leaveOn.thresholdPercent).toBe(EU_LABEL_THRESHOLD_PERCENT.leave_on);
    expect(leaveOn.declared.map((d) => d.inci)).toContain('Linalool');
    expect(leaveOn.coverage).toBe('subset');

    const rinseOff = evaluateEuLabelAllergens(lines, 'rinse_off');
    expect(rinseOff.declared).toHaveLength(0);
    expect(rinseOff.undeclared.some((d) => d.inci === 'Linalool')).toBe(true);
  });

  it('maps catalog aliases such as Cinnamic Aldehyde onto Cinnamal', () => {
    const lines: FormulaLine[] = [
      {
        id: 'c',
        materialId: 'cinn',
        label: 'Cinnamic Aldehyde',
        amountGrams: 1,
        concentrationKind: 'neat',
        allergens: [{ name: 'Cinnamic Aldehyde', fraction: 1 }],
      },
      {
        id: 'eth',
        materialId: 'eth',
        label: 'Ethanol',
        amountGrams: 99,
        concentrationKind: 'neat',
      },
    ];
    const report = evaluateEuLabelAllergens(lines, 'leave_on');
    expect(report.declared.map((d) => d.inci)).toEqual(['Cinnamal']);
  });

  it('ships the original 26 label allergens', () => {
    expect(EU_LABEL_ALLERGENS).toHaveLength(26);
  });
});

describe('evaluateEuAnnexRestrictions', () => {
  it('flags Lilial by CAS as a prohibited annex hit', () => {
    const report = evaluateEuAnnexRestrictions([
      {
        id: 'lilial',
        materialId: 'm',
        label: 'Lilial',
        amountGrams: 0.5,
        concentrationKind: 'neat',
        casNumber: '80-54-6',
      },
      {
        id: 'eth',
        materialId: 'eth',
        label: 'Ethanol',
        amountGrams: 99.5,
        concentrationKind: 'neat',
      },
    ]);
    expect(report.coverage).toBe('subset');
    expect(report.hits).toHaveLength(1);
    expect(report.hits[0]?.status).toBe('red');
    expect(report.hits[0]?.restriction).toBe('ban');
  });
});
