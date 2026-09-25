import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('argon2', () => ({
  hash: vi.fn(async () => 'hashed'),
  verify: vi.fn(async () => true),
}));

import * as argon2 from 'argon2';
import { AccountService } from './account.service';

const userRow = {
  id: 'u1',
  email: 'a@b.co',
  displayName: 'Alice',
  role: 'perfumer',
  plan: 'pro',
  status: 'active',
  locale: 'en',
  theme: 'dark',
  defaultBatchTargetGrams: '10',
  defaultConcentrationPct: '20',
  defaultIfraCategory: 4,
  createdAt: new Date(),
  passwordHash: 'hashed',
};

const dto = {
  id: 'u1',
  email: 'a@b.co',
  displayName: 'Alice',
  role: 'perfumer',
  plan: 'pro',
  entitlements: { plan: { slug: 'pro', name: 'Pro' }, subscription: { status: 'active' } },
};

describe('AccountService', () => {
  let db: any;
  let auth: any;
  let dashboard: any;
  let svc: AccountService;

  beforeEach(() => {
    vi.mocked(argon2.verify).mockResolvedValue(true);
    db = {
      db: {
        select: vi.fn(() => ({
          from: () => ({
            where: () => ({
              limit: async () => [userRow],
            }),
          }),
        })),
        update: vi.fn(() => ({
          set: () => ({
            where: () => ({
              returning: async () => [{ ...userRow, displayName: 'Ada' }],
            }),
          }),
        })),
      },
    };
    auth = {
      me: vi.fn(async () => dto),
      toUserDto: vi.fn(async (row: typeof userRow) => ({ ...dto, displayName: row.displayName })),
      logoutAll: vi.fn(async () => undefined),
    };
    dashboard = {
      stats: vi.fn(async () => ({
        formulaCount: 2,
        evaluationCount: 1,
        lowStockItems: 0,
        weighingSessionCount: 0,
        catalogSize: 10,
      })),
    };
    svc = new AccountService(db, auth, { resolve: vi.fn() } as any, dashboard);
  });

  it('returns profile plus lab snapshot', async () => {
    const account = await svc.get({ sub: 'u1', email: 'a@b.co' });
    expect(account.lab.formulaCount).toBe(2);
    expect(account.billing.plan).toBe('pro');
  });

  it('updates display name', async () => {
    const updated = await svc.update({ sub: 'u1', email: 'a@b.co' }, { displayName: 'Ada' });
    expect(updated.displayName).toBe('Ada');
  });

  it('rejects taken email', async () => {
    let n = 0;
    db.db.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            n += 1;
            return n === 1 ? [userRow] : [{ id: 'other' }];
          },
        }),
      }),
    }));
    await expect(
      svc.update({ sub: 'u1', email: 'a@b.co' }, { email: 'taken@b.co' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects wrong current password', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(false);
    await expect(
      svc.changePassword(
        { sub: 'u1', email: 'a@b.co' },
        { currentPassword: 'x', newPassword: 'newpass12' },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes all sessions', async () => {
    await svc.logoutAll({ sub: 'u1', email: 'a@b.co' });
    expect(auth.logoutAll).toHaveBeenCalledWith('u1');
  });

  it('does not let an admin demote themselves via account patch', async () => {
    const sets: unknown[] = [];
    db.db.select = vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ ...userRow, role: 'admin' }],
        }),
      }),
    }));
    db.db.update = vi.fn(() => ({
      set: (values: unknown) => {
        sets.push(values);
        return {
          where: () => ({
            returning: async () => [{ ...userRow, role: 'admin' }],
          }),
        };
      },
    }));
    await svc.update({ sub: 'u1', email: 'a@b.co' }, { displayName: 'Ada', role: 'enthusiast' });
    expect((sets[0] as { role?: string }).role).toBeUndefined();
  });
});
