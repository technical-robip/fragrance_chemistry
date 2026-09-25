import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('prevents demoting the last admin', async () => {
    const db = {
      db: {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                limit: async () => [
                  { id: 'a1', role: 'admin', status: 'active', email: 'admin@demo.local' },
                ],
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: async () => [{ value: 0 }],
            }),
          }),
      },
    };
    const svc = new AdminService(db as any, { logoutAll: vi.fn() } as any, {} as any);
    await expect(
      svc.updateUser({ sub: 'other', email: 'x@y.z' }, 'a1', { role: 'enthusiast' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents self-demotion', async () => {
    const db = {
      db: {
        select: vi.fn().mockReturnValue({
          from: () => ({
            where: () => ({
              limit: async () => [
                { id: 'a1', role: 'admin', status: 'active', email: 'admin@demo.local' },
              ],
            }),
          }),
        }),
      },
    };
    const svc = new AdminService(db as any, { logoutAll: vi.fn() } as any, {} as any);
    await expect(
      svc.updateUser({ sub: 'a1', email: 'admin@demo.local' }, 'a1', { role: 'enthusiast' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('assigns a subscription and syncs users.plan', async () => {
    const inserted: unknown[] = [];
    const updates: unknown[] = [];
    const db = {
      db: {
        select: vi
          .fn()
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: 'u1' }],
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: 'p-pro', slug: 'pro' }],
              }),
            }),
          })
          .mockReturnValueOnce({
            from: () => ({
              where: () => ({
                limit: async () => [
                  {
                    id: 'u1',
                    email: 'a@b.co',
                    displayName: 'A',
                    role: 'perfumer',
                    plan: 'pro',
                    status: 'active',
                    locale: 'en',
                    theme: 'dark',
                    createdAt: new Date(),
                  },
                ],
              }),
            }),
          }),
        update: vi.fn(() => ({
          set: (values: unknown) => {
            updates.push(values);
            return {
              where: async () => undefined,
            };
          },
        })),
        insert: vi.fn(() => ({
          values: (values: unknown) => {
            inserted.push(values);
            return { returning: async () => [values] };
          },
        })),
      },
    };
    const entitlements = {
      resolve: vi.fn(async () => ({ plan: { slug: 'pro', name: 'Pro' } })),
    };
    const svc = new AdminService(db as any, { logoutAll: vi.fn() } as any, entitlements as any);
    const result = await svc.assignSubscription('u1', {
      planId: 'p-pro',
      status: 'active',
      quotaOverrides: {},
    });
    expect(inserted.length).toBe(1);
    expect(updates.some((u) => (u as { plan?: string }).plan === 'pro')).toBe(true);
    expect(result.entitlements.plan.slug).toBe('pro');
  });

  it('rejects duplicate plan slugs', async () => {
    const svc = new AdminService(
      {
        db: {
          select: vi.fn().mockReturnValue({
            from: () => ({
              where: () => ({
                limit: async () => [{ id: 'p1', slug: 'pro' }],
              }),
            }),
          }),
        },
      } as any,
      { logoutAll: vi.fn() } as any,
      {} as any,
    );
    await expect(
      svc.createPlan({ slug: 'pro', name: 'Pro', isActive: true, sortOrder: 100 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
