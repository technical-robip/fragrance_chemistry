import { describe, expect, it } from 'vitest';
import {
  acceptedPourGrams,
  formatWeighAmount,
  formatWeighGrams,
  groupWeighLines,
  isPoured,
  lineTargetGrams,
  nextOpenStep,
} from './weigh-session';

describe('accepted pours', () => {
  it('treats a stored zero as not poured', () => {
    expect(acceptedPourGrams(0)).toBeNull();
    expect(acceptedPourGrams('0')).toBeNull();
    expect(acceptedPourGrams('0.000')).toBeNull();
    expect(acceptedPourGrams(null)).toBeNull();
    expect(acceptedPourGrams('')).toBeNull();
    expect(isPoured(acceptedPourGrams(0))).toBe(false);
  });

  it('keeps a real pour', () => {
    expect(acceptedPourGrams('1.25')).toBe(1.25);
    expect(isPoured(1.25)).toBe(true);
  });

  it('keeps a 5 g batch target from the line percent', () => {
    expect(lineTargetGrams(11.11, 5)).toBeCloseTo(0.5555, 4);
    expect(lineTargetGrams(40, 5)).toBeCloseTo(2, 4);
    expect(formatWeighGrams(0.555)).toBe('0.555 g');
    expect(formatWeighGrams(25.44)).toBe('25.440 g');
  });

  it('opens on the first unpoured line when earlier cells are zero', () => {
    const actuals = [acceptedPourGrams(0), acceptedPourGrams(0), acceptedPourGrams(1.1)];
    expect(nextOpenStep(actuals, true)).toBe(0);
    expect(nextOpenStep([1.1, null], true)).toBe(1);
    expect(nextOpenStep([1.1, 2], true)).toBe(2);
    expect(nextOpenStep([1.1, 2], false)).toBe(3);
  });
});

describe('weigh list', () => {
  it('formats ml and drops from the same grams', () => {
    expect(formatWeighAmount(1, 'grams')).toBe('1.000 g');
    expect(formatWeighAmount(1, 'ml')).toBe('1.000 ml');
    expect(formatWeighAmount(1, 'drops')).toBe('20.0 drops');
  });

  it('groups by family in the catalog order and keeps the original index', () => {
    const groups = groupWeighLines(
      [
        { materialName: 'Rose', olfactoryFamily: 'Floral' },
        { materialName: 'Cedar', olfactoryFamily: 'Woody' },
        { materialName: 'Lemon', olfactoryFamily: 'Citrus' },
        { materialName: 'Mystery', olfactoryFamily: null },
      ],
      '',
    );
    expect(groups.map((group) => group.family)).toEqual(['Citrus', 'Floral', 'Woody', 'Special']);
    expect(groups[0]?.items[0]?.index).toBe(2);
  });

  it('filters by material name without dropping the index', () => {
    const groups = groupWeighLines(
      [
        { materialName: 'Rose', olfactoryFamily: 'Floral' },
        { materialName: 'Orange Sweet', olfactoryFamily: 'Citrus' },
      ],
      'orange',
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items[0]).toMatchObject({ index: 1 });
  });
});
