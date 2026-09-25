import { ForbiddenException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EntitlementsService } from './entitlements.service';

const entitlementsBase = {
  plan: { id: 'p1', slug: 'free', name: 'Free', description: null, isActive: true },
  subscription: null,
  features: ['dashboard', 'workbench'],
  quotas: {
    maxFormulas: 3,
    maxInventoryItems: null,
    maxEvaluations: 1,
    maxWeighingSessions: null,
    maxPdfExportsPerMonth: null,
  },
  usage: {
    maxFormulas: 3,
    maxInventoryItems: 0,
    maxEvaluations: 0,
    maxWeighingSessions: 0,
    maxPdfExportsPerMonth: 0,
  },
};

describe('EntitlementsService', () => {
  let svc: EntitlementsService;

  beforeEach(() => {
    svc = new EntitlementsService(
      { client: () => ({}), db: {} } as any,
      {
        getPdfExportCount: vi.fn(async () => 0),
        incrementPdfExportCount: vi.fn(async () => 1),
      } as any,
    );
    vi.spyOn(svc, 'resolve').mockResolvedValue(entitlementsBase as any);
  });

  it('forbids missing features', async () => {
    await expect(svc.assertFeature('u1', 'weighing')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertFeature('u1', 'workbench')).resolves.toBeUndefined();
  });

  it('forbids exhausted quotas and allows unlimited', async () => {
    await expect(svc.assertQuota('u1', 'maxFormulas')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.assertQuota('u1', 'maxInventoryItems')).resolves.toBeUndefined();
    await expect(svc.assertQuota('u1', 'maxEvaluations')).resolves.toBeUndefined();
  });

  it('forbids sponsored listings unless the plan includes them', async () => {
    await expect(svc.assertFeature('u1', 'sponsored_listings')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('increments pdf export after feature and quota checks', async () => {
    const redis = {
      getPdfExportCount: vi.fn(async () => 0),
      incrementPdfExportCount: vi.fn(async () => 1),
    };
    svc = new EntitlementsService({ client: () => ({}), db: {} } as any, redis as any);
    vi.spyOn(svc, 'resolve').mockResolvedValue({
      ...entitlementsBase,
      features: [...entitlementsBase.features, 'pdf_export'],
    } as any);
    await svc.incrementPdfExport('u1');
    expect(redis.incrementPdfExportCount).toHaveBeenCalledWith('u1');
  });
});
