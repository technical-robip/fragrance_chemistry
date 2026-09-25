import { describe, expect, it, vi } from 'vitest';

vi.mock('../../config/env', () => ({
  getEnv: () => ({
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: 6380,
    REDIS_DB: 1,
    REDIS_USERNAME: 'u',
    REDIS_PASSWORD: 'p',
    REDIS_KEY_PREFIX: 'fc:',
  }),
}));

vi.mock('ioredis', () => {
  return {
    default: class RedisMock {
      constructor(public opts: unknown) {}
      quit = vi.fn(async () => 'OK');
    },
  };
});

import { RedisService } from './redis.service';

describe('RedisService', () => {
  it('builds refresh keys and quits', async () => {
    const svc = new RedisService();
    expect(svc.refreshKey('u1', 'j1')).toBe('auth:refresh:u1:j1');
    expect(svc.pdfExportCountKey('u1', '2026-01')).toBe('entitlements:pdf:u1:2026-01');
    expect(svc.formulaDetailKey('u1', 'f1')).toBe('formula:detail:v2:u1:f1');
    expect(svc.dashboardBriefingKey('u1', 'f1')).toBe('dashboard:briefing:v2:u1:f1');
    expect(svc.ifraLimitsKey('4')).toBe('ifra:limits:4');
    expect(svc.catalogPublicIndexKey()).toBe('catalog:index:public');
    expect(svc.catalogPrivateIndexKey('u1')).toBe('catalog:index:private:u1');
    const client = svc.client as any;
    client.scan = vi.fn(async () => ['0', ['auth:refresh:u1:a']]);
    client.del = vi.fn(async () => 1);
    client.get = vi.fn(async () => '2');
    client.incr = vi.fn(async () => 1);
    client.expire = vi.fn(async () => 1);
    client.set = vi.fn(async () => 'OK');
    await svc.deleteRefreshTokensForUser('u1');
    expect(client.del).toHaveBeenCalled();
    expect(await svc.getPdfExportCount('u1')).toBe(2);
    await svc.incrementPdfExportCount('u1');
    expect(client.incr).toHaveBeenCalled();
    await svc.cacheSet('k', { a: 1 }, 30);
    expect(client.set).toHaveBeenCalledWith('k', JSON.stringify({ a: 1 }), 'EX', 30);
    client.get = vi.fn(async () => JSON.stringify({ a: 1 }));
    expect(await svc.cacheGet('k')).toEqual({ a: 1 });
    await svc.onModuleDestroy();
    expect(svc.client.quit).toHaveBeenCalled();
  });
});
