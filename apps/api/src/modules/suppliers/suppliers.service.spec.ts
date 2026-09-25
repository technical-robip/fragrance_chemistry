import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SuppliersService } from './suppliers.service';

const uuid = '11111111-1111-1111-1111-111111111111';
const user = { sub: 'u1', email: 'a@b.co' };

describe('SuppliersService', () => {
  it('creates unsponsored prices without a feature check', async () => {
    const insert = vi.fn(() => ({
      values: () => ({
        returning: async () => [{ id: 'p1', sponsored: false }],
      }),
    }));
    const entitlements = { assertFeature: vi.fn() };
    const svc = new SuppliersService(
      { client: () => ({ insert, select: vi.fn() }) } as any,
      entitlements as any,
    );
    const row = await svc.createPrice(user, {
      supplierId: uuid,
      materialId: uuid,
      pricePerGram: 2,
      currency: 'USD',
      sponsored: false,
    });
    expect(row[0]?.sponsored).toBe(false);
    expect(entitlements.assertFeature).not.toHaveBeenCalled();
  });

  it('blocks sponsored prices without the feature', async () => {
    const entitlements = {
      assertFeature: vi.fn(async () => {
        throw new ForbiddenException('Your plan does not include sponsored_listings');
      }),
    };
    const svc = new SuppliersService(
      { client: () => ({ insert: vi.fn() }) } as any,
      entitlements as any,
    );
    await expect(
      svc.createPrice(user, {
        supplierId: uuid,
        materialId: uuid,
        pricePerGram: 2,
        currency: 'USD',
        sponsored: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
