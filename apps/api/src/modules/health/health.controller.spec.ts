import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok when db and redis work', async () => {
    const db = {
      db: { execute: vi.fn(async () => ({ rows: [{ ok: 1 }] })) },
    };
    const redis = {
      client: {
        set: vi.fn(async () => 'OK'),
        get: vi.fn(async () => '1'),
      },
    };
    const ctrl = new HealthController(db as any, redis as any);
    const res = await ctrl.check();
    expect(res.status).toBe('ok');
    expect(res.checks.database).toBe('ok');
    expect(res.checks.redis).toBe('ok');
  });

  it('returns degraded on failures', async () => {
    const db = {
      db: {
        execute: vi.fn(async () => {
          throw new Error('db');
        }),
      },
    };
    const redis = {
      client: {
        set: vi.fn(async () => {
          throw new Error('redis');
        }),
        get: vi.fn(),
      },
    };
    const ctrl = new HealthController(db as any, redis as any);
    const res = await ctrl.check();
    expect(res.status).toBe('degraded');
  });
});
