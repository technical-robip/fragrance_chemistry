import { describe, expect, it } from 'vitest';
import {
  capRadarAxes,
  familyBuckets,
  linePyramidBand,
  pyramidDrydownDrifts,
  previewLayerMaterials,
  pyramidLayerBreakdown,
  pyramidPercents,
  radarFamilyAxes,
  familyIdsForPyramidLayer,
  scaleFamilyLinePercents,
  familyHue,
} from './formula-viz';

describe('formula-viz', () => {
  it('builds proportional pyramid percents', () => {
    const result = pyramidPercents([
      { targetPct: 20, pyramidNote: 'top' },
      { targetPct: 30, pyramidNote: 'heart' },
      { targetPct: 50, pyramidNote: 'base' },
    ]);
    expect(result.top).toBeCloseTo(20);
    expect(result.middle).toBeCloseTo(30);
    expect(result.base).toBeCloseTo(50);
    expect(result.raw.middle).toBe(30);
  });

  it('handles empty lines without NaN', () => {
    const result = pyramidPercents([]);
    expect(result.top + result.middle + result.base).toBe(0);
  });

  it('maps tagged notes vs tenacity for pyramid bands', () => {
    const line = { pyramidNote: 'base' as const, tenacityHours: 2 };
    expect(linePyramidBand(line, 'note')).toBe('base');
    expect(linePyramidBand(line, 'volatility')).toBe('top');
    expect(linePyramidBand({ pyramidNote: 'top', tenacityHours: null }, 'volatility')).toBe('top');
  });

  it('lists materials that flash or linger vs their tagged step', () => {
    const drifts = pyramidDrydownDrifts([
      { key: 'a', name: 'Linalool', percent: 10, pyramidNote: 'heart', tenacityHours: 2 },
      { key: 'b', name: 'Ambroxan', percent: 20, pyramidNote: 'base', tenacityHours: 48 },
      { key: 'c', name: 'Hedione', percent: 15, pyramidNote: 'heart', tenacityHours: 12 },
    ]);
    expect(drifts).toHaveLength(1);
    expect(drifts[0]).toMatchObject({
      name: 'Linalool',
      tagged: 'middle',
      evaporates: 'top',
      direction: 'faster',
    });
  });

  it('buckets families by percent', () => {
    const buckets = familyBuckets([
      { targetPct: 40, olfactoryFamily: 'Floral' },
      { targetPct: 10, olfactoryFamily: 'Floral' },
      { targetPct: 25, olfactoryFamily: null },
    ]);
    expect(buckets[0]).toEqual({ name: 'Floral', value: 50 });
    expect(buckets[1]?.name).toBe('Special');
  });

  it('caps radar axes with an Other bucket', () => {
    const axes = capRadarAxes(
      Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, label: `f${i}`, value: 10 - i })),
      8,
      'Other',
    );
    expect(axes).toHaveLength(8);
    expect(axes.at(-1)).toEqual({ id: 'Other', label: 'Other', value: 6 });
  });

  it('builds family radar axes from lines', () => {
    const axes = radarFamilyAxes(
      [
        { targetPct: 40, olfactoryFamily: 'Floral' },
        { targetPct: 20, olfactoryFamily: 'Woody' },
      ],
      { otherLabel: 'Altele' },
    );
    expect(axes[0]).toEqual({ id: 'Floral', label: 'Floral', value: 40 });
    expect(axes[1]).toEqual({ id: 'Woody', label: 'Woody', value: 20 });
  });
});

describe('pyramidLayerBreakdown', () => {
  it('groups by note, aliases heart, and sorts by percent desc', () => {
    const result = pyramidLayerBreakdown([
      { key: 'a', name: 'Bergamot', percent: 8, pyramidNote: 'top' },
      { key: 'b', name: 'Hedione', percent: 18, pyramidNote: 'heart' },
      { key: 'c', name: 'Rose', percent: 7, pyramidNote: 'middle' },
      { key: 'd', name: 'Vetiver', percent: 12, pyramidNote: 'base' },
    ]);
    expect(result.top.map((i) => i.name)).toEqual(['Bergamot']);
    expect(result.middle.map((i) => i.name)).toEqual(['Hedione', 'Rose']);
    expect(result.base.map((i) => i.name)).toEqual(['Vetiver']);
    expect(result.modifier).toEqual([]);
  });

  it('returns empty buckets without NaN', () => {
    const result = pyramidLayerBreakdown([]);
    expect(result).toEqual({ top: [], middle: [], base: [], modifier: [] });
  });

  it('keeps names when every percent is 0', () => {
    const result = pyramidLayerBreakdown([
      { key: 'a', name: 'Linalool', percent: 0, pyramidNote: 'top' },
    ]);
    expect(result.top).toEqual([{ key: 'a', name: 'Linalool', percent: 0 }]);
  });

  it('leaves other tiers empty when the formula is a single base', () => {
    const result = pyramidLayerBreakdown([
      { key: 'b', name: 'Ambroxan', percent: 100, pyramidNote: 'base' },
    ]);
    expect(result.top).toEqual([]);
    expect(result.middle).toEqual([]);
    expect(result.base).toHaveLength(1);
    expect(result.modifier).toEqual([]);
  });

  it('puts modifier on Other and leaves pyramidPercents T/H/B untouched by it', () => {
    const lines = [
      { key: 'a', name: 'Hedione', percent: 80, pyramidNote: 'middle' },
      { key: 'b', name: 'Iso E Super', percent: 20, pyramidNote: 'modifier' },
    ];
    const layers = pyramidLayerBreakdown(lines);
    expect(layers.modifier.map((i) => i.name)).toEqual(['Iso E Super']);
    expect(layers.middle.map((i) => i.name)).toEqual(['Hedione']);
    const percents = pyramidPercents(
      lines.map((l) => ({ targetPct: l.percent, pyramidNote: l.pyramidNote })),
    );
    expect(percents.middle).toBeCloseTo(100);
    expect(percents.top).toBeCloseTo(0);
    expect(percents.base).toBeCloseTo(0);
    expect(percents.modifier).toBe(20);
  });

  it('ignores null pyramid notes instead of sending them to Other', () => {
    const result = pyramidLayerBreakdown([
      { key: 'a', name: 'Mystery', percent: 10, pyramidNote: null },
      { key: 'b', name: 'Hedione', percent: 10, pyramidNote: 'middle' },
    ]);
    expect(result.modifier).toEqual([]);
    expect(result.middle).toHaveLength(1);
  });

  it('keeps duplicate names as separate entries', () => {
    const result = pyramidLayerBreakdown([
      { key: 'a', name: 'Bergamot', percent: 6, pyramidNote: 'top' },
      { key: 'b', name: 'Bergamot', percent: 4, pyramidNote: 'top' },
    ]);
    expect(result.top).toHaveLength(2);
    expect(result.top.map((i) => i.key)).toEqual(['a', 'b']);
  });
});

describe('previewLayerMaterials', () => {
  it('returns the first N items and the remainder count', () => {
    const items = [
      { key: '1', name: 'A', percent: 5 },
      { key: '2', name: 'B', percent: 4 },
      { key: '3', name: 'C', percent: 3 },
      { key: '4', name: 'D', percent: 2 },
      { key: '5', name: 'E', percent: 1 },
    ];
    expect(previewLayerMaterials(items, 2)).toEqual({
      shown: items.slice(0, 2),
      rest: 3,
    });
  });
});

describe('familyIdsForPyramidLayer', () => {
  it('returns families that sit on the hovered pyramid layer', () => {
    const lines = [
      { name: 'Bergamot', percent: 16, pyramidNote: 'top', olfactoryFamily: 'Fresh' },
      { name: 'Lemon', percent: 16, pyramidNote: 'top', olfactoryFamily: 'Fresh' },
      { name: 'Lavender', percent: 24, pyramidNote: 'middle', olfactoryFamily: 'Floral' },
      { name: 'Ambroxan', percent: 28, pyramidNote: 'base', olfactoryFamily: 'Woody' },
    ];
    expect(familyIdsForPyramidLayer(lines, 'top').sort()).toEqual(['Fresh']);
    expect(familyIdsForPyramidLayer(lines, 'heart').sort()).toEqual(['Floral']);
    expect(familyIdsForPyramidLayer(lines, 'base').sort()).toEqual(['Woody']);
  });

  it('maps overflow families onto the Other radar bucket', () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({
      percent: 10 - i,
      pyramidNote: 'top' as const,
      olfactoryFamily: `f${i}`,
    }));
    expect(familyIdsForPyramidLayer(lines, 'top', { maxAxes: 8, otherLabel: 'Altele' })).toContain(
      'Altele',
    );
  });

  it('returns an empty list when the layer has no lines', () => {
    expect(
      familyIdsForPyramidLayer(
        [{ percent: 10, pyramidNote: 'base', olfactoryFamily: 'Woody' }],
        'top',
      ),
    ).toEqual([]);
    expect(familyIdsForPyramidLayer([], 'middle')).toEqual([]);
  });
});

describe('scaleFamilyLinePercents', () => {
  const mix = [
    { id: 'f1', olfactoryFamily: 'Floral', percent: 20 },
    { id: 'f2', olfactoryFamily: 'Floral', percent: 18 },
    { id: 'fr', olfactoryFamily: 'Fresh', percent: 30 },
    { id: 'w', olfactoryFamily: 'Woody', percent: 22 },
    { id: 'a', olfactoryFamily: 'Amber', percent: 10 },
  ];

  it('raises one family and shrinks the others, keeping total and intra-family ratios', () => {
    const next = scaleFamilyLinePercents(mix, 'Floral', 50);
    const floral = next.filter((l) => l.olfactoryFamily === 'Floral');
    expect(floral[0]!.percent / floral[1]!.percent).toBeCloseTo(20 / 18);
    expect(floral.reduce((s, l) => s + l.percent, 0)).toBeCloseTo(50, 3);

    const rest = next.filter((l) => l.olfactoryFamily !== 'Floral');
    expect(rest.find((l) => l.id === 'fr')!.percent).toBeCloseTo(30 * (50 / 62), 3);
    expect(rest.find((l) => l.id === 'w')!.percent).toBeCloseTo(22 * (50 / 62), 3);
    expect(rest.find((l) => l.id === 'a')!.percent).toBeCloseTo(10 * (50 / 62), 3);
    expect(next.reduce((s, l) => s + l.percent, 0)).toBeCloseTo(100, 3);
  });

  it('treats the Other radar bucket as one group', () => {
    const lines = Array.from({ length: 10 }, (_, i) => ({
      olfactoryFamily: `f${i}`,
      percent: 10 - i,
    }));
    const next = scaleFamilyLinePercents(lines, 'Other', 12, { maxAxes: 8, otherLabel: 'Other' });
    const otherIds = new Set(['f7', 'f8', 'f9']);
    const otherSum = next
      .filter((l) => otherIds.has(l.olfactoryFamily))
      .reduce((s, l) => s + l.percent, 0);
    expect(otherSum).toBeCloseTo(12, 3);
    expect(next.reduce((s, l) => s + l.percent, 0)).toBeCloseTo(55, 3);
  });

  it('clamps to 0 and to the formula total', () => {
    const toZero = scaleFamilyLinePercents(mix, 'Floral', -10);
    expect(toZero.filter((l) => l.olfactoryFamily === 'Floral').every((l) => l.percent === 0)).toBe(
      true,
    );
    expect(toZero.reduce((s, l) => s + l.percent, 0)).toBeCloseTo(100, 3);

    const toTotal = scaleFamilyLinePercents(mix, 'Floral', 400);
    expect(
      toTotal.filter((l) => l.olfactoryFamily !== 'Floral').every((l) => l.percent === 0),
    ).toBe(true);
    expect(toTotal.reduce((s, l) => s + l.percent, 0)).toBeCloseTo(100, 3);
  });

  it('is a no-op for an empty family, a solo family, or an unchanged value', () => {
    expect(scaleFamilyLinePercents(mix, 'Musk', 20)).toEqual(mix);
    expect(
      scaleFamilyLinePercents([{ olfactoryFamily: 'Floral', percent: 80 }], 'Floral', 40),
    ).toEqual([{ olfactoryFamily: 'Floral', percent: 80 }]);
    expect(scaleFamilyLinePercents(mix, 'Floral', 38)).toBe(mix);
  });

  it('keeps Fresh, Citrus, and Green on distinct family tokens', () => {
    expect(familyHue('Fresh')).toBe('var(--fc-family-fresh)');
    expect(familyHue('Citrus')).toBe('var(--fc-family-citrus)');
    expect(familyHue('Green')).toBe('var(--fc-family-green)');
    expect(familyHue('Citrus')).not.toBe(familyHue('Fresh'));
    expect(familyHue('Green')).not.toBe(familyHue('Fresh'));
    expect(familyHue('Gourmand')).toBe('var(--fc-family-gourmand)');
    expect(familyHue('Unknown')).toBe('var(--fc-accent)');
  });
});
