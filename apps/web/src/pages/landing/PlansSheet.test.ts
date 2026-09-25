import { describe, expect, it } from 'vitest';
import { FEATURE_KEYS, PLAN_FEATURE_PRESETS, QUOTA_KEYS } from '@fc/shared';
import { planGrantsFeature, planQuota } from './PlansSheet';

/**
 * The comparison table is derived from the shared presets rather than restated,
 * so these tests guard the derivation, not a copy of the data.
 */
describe('plan comparison derivation', () => {
  it('grants exactly the features the shared preset lists', () => {
    for (const slug of ['free', 'pro', 'enterprise'] as const) {
      const granted = FEATURE_KEYS.filter((feature) => planGrantsFeature(slug, feature));
      expect(granted).toEqual(PLAN_FEATURE_PRESETS[slug]);
    }
  });

  it('caps Free at three formulas and leaves the paid plans unlimited', () => {
    expect(planQuota('free', 'maxFormulas')).toBe(3);
    expect(planQuota('pro', 'maxFormulas')).toBeNull();
    expect(planQuota('enterprise', 'maxFormulas')).toBeNull();
  });

  it('withholds sponsored listings from every plan below Enterprise', () => {
    expect(planGrantsFeature('free', 'sponsored_listings')).toBe(false);
    expect(planGrantsFeature('pro', 'sponsored_listings')).toBe(false);
    expect(planGrantsFeature('enterprise', 'sponsored_listings')).toBe(true);
  });

  it('reports every quota key so no limit silently disappears from the table', () => {
    for (const quota of QUOTA_KEYS) {
      expect(() => planQuota('free', quota)).not.toThrow();
    }
  });
});
