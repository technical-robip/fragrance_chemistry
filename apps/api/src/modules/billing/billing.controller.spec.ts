import { describe, expect, it } from 'vitest';
import { BillingController } from './billing.controller';

describe('BillingController', () => {
  it('returns the active plan slug from entitlements', async () => {
    const ctl = new BillingController({
      resolve: async () => ({
        plan: { slug: 'pro', name: 'Pro' },
        subscription: { status: 'active' },
      }),
    } as any);
    const res = await ctl.status({ user: { sub: 'u1' } } as any);
    expect(res.enabled).toBe(false);
    expect(res.plan).toBe('pro');
    expect(res.status).toBe('active');
  });
});
