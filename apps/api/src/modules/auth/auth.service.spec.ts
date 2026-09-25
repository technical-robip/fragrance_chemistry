import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('argon2', () => ({
  hash: vi.fn(async () => 'hashed'),
  verify: vi.fn(async () => true),
}));

vi.mock('../../config/env', () => ({
  getEnv: () => ({
    JWT_SECRET: 'test-secret-key-16chars',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL: '7d',
  }),
}));

import * as argon2 from 'argon2';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService, parseRefreshTtlSeconds } from './auth.service';

const sampleUser = {
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  passwordHash: 'hashed',
};

function makeDb(user?: Record<string, unknown>) {
  const returning = vi.fn(async () => (user ? [user] : []));
  const limit = vi.fn(async () => (user ? [user] : []));
  const where = vi.fn(() => ({ limit, returning }));
  const from = vi.fn(() => ({ where, values: vi.fn(() => ({ returning })) }));
  const insert = vi.fn(() => ({ values: vi.fn(() => ({ returning })) }));
  const select = vi.fn(() => ({ from }));
  return {
    db: { select, insert, update: vi.fn() },
  } as any;
}

function makeJwt() {
  return {
    signAsync: vi.fn(async (payload: unknown) => `tok:${JSON.stringify(payload)}`),
    verify: vi.fn((token: string) => {
      if (token === 'bad') throw new Error('bad');
      return { sub: 'u1', email: 'a@b.co', typ: 'refresh', jti: 'j1' };
    }),
  } as any;
}

function makeRedis() {
  return {
    client: {
      set: vi.fn(async () => 'OK'),
      get: vi.fn(async () => '1'),
      del: vi.fn(async () => 1),
    },
    refreshKey: (userId: string, jti: string) => `auth:refresh:${userId}:${jti}`,
    deleteRefreshTokensForUser: vi.fn(async () => undefined),
  } as any;
}

function makeEntitlements() {
  return {
    provisionFreePlan: vi.fn(async () => undefined),
    resolve: vi.fn(async () => ({
      plan: { id: 'p1', slug: 'free', name: 'Free', description: null, isActive: true },
      subscription: null,
      features: ['dashboard', 'catalog', 'workbench'],
      quotas: {
        maxFormulas: 3,
        maxInventoryItems: null,
        maxEvaluations: null,
        maxWeighingSessions: null,
        maxPdfExportsPerMonth: null,
      },
      usage: {
        maxFormulas: 0,
        maxInventoryItems: 0,
        maxEvaluations: 0,
        maxWeighingSessions: 0,
        maxPdfExportsPerMonth: 0,
      },
    })),
  } as any;
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(argon2.verify).mockResolvedValue(true);
  });

  it('registers and returns session with user', async () => {
    const db = makeDb();
    let selects = 0;
    db.db.select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            selects += 1;
            return selects === 1 ? [] : [sampleUser];
          }),
        })),
      })),
    }));
    db.db.insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [sampleUser]),
      })),
    }));
    const entitlements = makeEntitlements();
    const svc = new AuthService(db, makeJwt(), makeRedis(), entitlements);
    const session = await svc.register({
      email: 'a@b.co',
      password: 'password1',
      displayName: 'Alice',
    });
    expect(session.user.email).toBe('a@b.co');
    expect(session.user.entitlements.plan.slug).toBe('free');
    expect(session.accessToken).toBeTruthy();
    expect(entitlements.provisionFreePlan).toHaveBeenCalled();
  });

  it('rejects duplicate register', async () => {
    const db = makeDb(sampleUser);
    const svc = new AuthService(db, makeJwt(), makeRedis(), makeEntitlements());
    await expect(
      svc.register({ email: 'a@b.co', password: 'password1', displayName: 'A' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in and returns me', async () => {
    const db = makeDb(sampleUser);
    const svc = new AuthService(db, makeJwt(), makeRedis(), makeEntitlements());
    const session = await svc.login({ email: 'a@b.co', password: 'password1' });
    expect(session.user.displayName).toBe('Alice');
    const me = await svc.me({ sub: 'u1', email: 'a@b.co' });
    expect(me.id).toBe('u1');
    expect(me.defaultIfraCategory).toBe(4);
  });

  it('rejects disabled accounts', async () => {
    const db = makeDb({ ...sampleUser, status: 'disabled' });
    const svc = new AuthService(db, makeJwt(), makeRedis(), makeEntitlements());
    await expect(svc.login({ email: 'a@b.co', password: 'password1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects bad password', async () => {
    vi.mocked(argon2.verify).mockResolvedValue(false);
    const db = makeDb(sampleUser);
    const svc = new AuthService(db, makeJwt(), makeRedis(), makeEntitlements());
    await expect(svc.login({ email: 'a@b.co', password: 'nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refreshes rotating tokens', async () => {
    const db = makeDb(sampleUser);
    const redis = makeRedis();
    const svc = new AuthService(db, makeJwt(), redis, makeEntitlements());
    const session = await svc.refresh({ refreshToken: 'ok' });
    expect(session.refreshToken).toBeTruthy();
    expect(redis.client.del).toHaveBeenCalled();
  });

  it('rejects invalid refresh', async () => {
    const svc = new AuthService(makeDb(), makeJwt(), makeRedis(), makeEntitlements());
    await expect(svc.refresh({ refreshToken: 'bad' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout deletes refresh when valid', async () => {
    const redis = makeRedis();
    const svc = new AuthService(makeDb(), makeJwt(), redis, makeEntitlements());
    await svc.logout({ sub: 'u1', email: 'a@b.co' }, 'ok');
    expect(redis.client.del).toHaveBeenCalled();
  });
});

describe('parseRefreshTtlSeconds', () => {
  it('parses units', () => {
    expect(parseRefreshTtlSeconds('30s')).toBe(30);
    expect(parseRefreshTtlSeconds('15m')).toBe(900);
    expect(parseRefreshTtlSeconds('2h')).toBe(7200);
    expect(parseRefreshTtlSeconds('7d')).toBe(604800);
    expect(parseRefreshTtlSeconds('nope')).toBe(7 * 24 * 3600);
  });
});
