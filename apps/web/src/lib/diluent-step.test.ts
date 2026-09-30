import { describe, expect, it } from 'vitest';
import { diluentEditorState, diluentStep, diluentStoredLabel } from './diluent-step';

const names = { alcoholName: 'Alcohol', oilName: 'Oil' };

describe('diluentStep', () => {
  it('uses a custom name and the complement of the concentration', () => {
    const step = diluentStep({
      label: 'Jojoba',
      concentrationPct: 20,
      batchGrams: 10,
      ...names,
    });
    expect(step.open).toBe(true);
    expect(step.name).toBe('Jojoba');
    expect(step.percent).toBe(80);
    expect(step.grams).toBeCloseTo(40, 5);
    expect(step.stored).toBe('Jojoba');
  });

  it('translates the oil preset and treats a blank label as alcohol', () => {
    expect(diluentStep({ label: 'oil', concentrationPct: 15, batchGrams: 10, ...names }).name).toBe(
      'Oil',
    );
    expect(diluentStep({ label: '  ', concentrationPct: 20, batchGrams: 10, ...names }).name).toBe(
      'Alcohol',
    );
    expect(diluentStep({ label: null, concentrationPct: 20, batchGrams: 5, ...names }).stored).toBe(
      null,
    );
  });

  it('closes the step at full concentration and at zero', () => {
    expect(
      diluentStep({ label: 'oil', concentrationPct: 100, batchGrams: 10, ...names }).open,
    ).toBe(false);
    expect(diluentStep({ label: null, concentrationPct: 0, batchGrams: 10, ...names }).grams).toBe(
      0,
    );
  });
});

describe('diluent editor', () => {
  it('keeps a typed name ahead of the preset and stores oil only when chosen', () => {
    expect(diluentStoredLabel('alcohol', 'IPM')).toBe('IPM');
    expect(diluentStoredLabel('oil', '')).toBe('oil');
    expect(diluentStoredLabel('alcohol', '  ')).toBeNull();
    expect(diluentEditorState('Jojoba')).toEqual({ preset: 'alcohol', custom: 'Jojoba' });
    expect(diluentEditorState('Oil')).toEqual({ preset: 'oil', custom: '' });
  });
});
