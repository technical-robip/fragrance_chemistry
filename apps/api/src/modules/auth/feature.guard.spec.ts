import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { FeatureGuard } from './feature.guard';

function ctx(user?: { sub: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('FeatureGuard', () => {
  it('allows when no feature is required', async () => {
    const guard = new FeatureGuard({ getAllAndOverride: () => undefined } as any, {} as any);
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).resolves.toBe(true);
  });

  it('forbids weighing when the plan does not include it', async () => {
    const entitlements = {
      assertFeature: vi.fn(async () => {
        throw new ForbiddenException('Your plan does not include weighing');
      }),
    };
    const guard = new FeatureGuard(
      { getAllAndOverride: () => 'weighing' } as any,
      entitlements as any,
    );
    await expect(guard.canActivate(ctx({ sub: 'u1' }))).rejects.toBeInstanceOf(ForbiddenException);
    expect(entitlements.assertFeature).toHaveBeenCalledWith('u1', 'weighing');
  });
});
