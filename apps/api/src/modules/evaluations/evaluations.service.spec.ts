import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EvaluationsService } from './evaluations.service';

const uuid = '11111111-1111-1111-1111-111111111111';
const user = { sub: 'u1', email: 'a@b.co' };

function redisMock() {
  return {
    dashboardBriefingKey: vi.fn((owner: string, id: string) => `dashboard:briefing:${owner}:${id}`),
    cacheDel: vi.fn(async () => 1),
  };
}

function chain(rows: unknown[]) {
  const api: Record<string, unknown> = {};
  const next = () => api;
  api.from = vi.fn(next);
  api.where = vi.fn(next);
  api.orderBy = vi.fn(next);
  api.limit = vi.fn(async () => rows);
  api.values = vi.fn(next);
  api.set = vi.fn(next);
  api.returning = vi.fn(async () => rows);
  return api;
}

describe('EvaluationsService', () => {
  it('creates evaluation with organoleptic fields', async () => {
    const formula = { id: uuid, name: 'Rose study', ownerId: 'u1' };
    const inserted = {
      id: 'e1',
      formulaId: uuid,
      rating: 4,
      macerationDay: 7,
      t0Notes: 'bright',
      clarity: 'clear',
    };
    const formulaChain = chain([formula]);
    const sittingChain = chain([]);
    const insertChain = chain([inserted]);
    const client = {
      select: vi.fn().mockReturnValueOnce(formulaChain).mockReturnValueOnce(sittingChain),
      insert: vi.fn().mockReturnValue(insertChain),
      update: vi.fn(),
    };
    const redis = redisMock();
    const entitlements = { assertQuota: vi.fn(async () => undefined) };
    const svc = new EvaluationsService(
      { client: () => client } as any,
      entitlements as any,
      redis as any,
    );
    const row = await svc.create(user, {
      formulaId: uuid,
      rating: 4,
      macerationDay: 7,
      t0Notes: 'bright',
      clarity: 'clear',
    });
    expect(row.formulaName).toBe('Rose study');
    expect(row.rating).toBe(4);
    expect(client.insert).toHaveBeenCalled();
    expect(client.update).not.toHaveBeenCalled();
    expect(entitlements.assertQuota).toHaveBeenCalledWith('u1', 'maxEvaluations');
    expect(redis.cacheDel).toHaveBeenCalledWith(`dashboard:briefing:u1:${uuid}`);
  });

  it('throws when formula missing', async () => {
    const client = {
      select: vi.fn().mockReturnValue(chain([])),
    };
    const redis = redisMock();
    const svc = new EvaluationsService(
      { client: () => client } as any,
      {
        assertQuota: vi.fn(async () => undefined),
      } as any,
      redis as any,
    );
    await expect(svc.create(user, { formulaId: uuid, rating: 3 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(redis.cacheDel).not.toHaveBeenCalled();
  });

  it('updates an existing sitting without consuming quota', async () => {
    const existing = {
      id: 'e1',
      ownerId: 'u1',
      formulaId: uuid,
      rating: 3,
      macerationDay: 1,
      t0Notes: 'lift',
      t30mNotes: null,
      t4hNotes: null,
      t24hNotes: null,
      notes: 'lift',
      clarity: 'clear',
      opalescence: 'none',
      solubility: 'complete',
      lineMarks: null,
    };
    const formula = { id: uuid, name: 'Rose study', ownerId: 'u1' };
    const updated = {
      ...existing,
      t30mNotes: 'drier',
      rating: 4,
      lineMarks: [{ materialId: uuid, mark: 'weak' }],
    };
    const client = {
      select: vi
        .fn()
        .mockReturnValueOnce(chain([existing]))
        .mockReturnValueOnce(chain([formula])),
      update: vi.fn().mockReturnValue(chain([updated])),
      insert: vi.fn(),
    };
    const redis = redisMock();
    const entitlements = { assertQuota: vi.fn(async () => undefined) };
    const svc = new EvaluationsService(
      { client: () => client } as any,
      entitlements as any,
      redis as any,
    );
    const row = await svc.update(user, 'e1', {
      t30mNotes: 'drier',
      rating: 4,
      lineMarks: [{ materialId: uuid, mark: 'weak' }],
    });
    expect(row.t30mNotes).toBe('drier');
    expect(row.lineMarks).toEqual([{ materialId: uuid, mark: 'weak' }]);
    expect(client.insert).not.toHaveBeenCalled();
    expect(entitlements.assertQuota).not.toHaveBeenCalled();
    expect(redis.cacheDel).toHaveBeenCalledWith(`dashboard:briefing:u1:${uuid}`);
  });

  it('upserts the most recent sitting for the same formula and day on create', async () => {
    const formula = { id: uuid, name: 'Rose study', ownerId: 'u1' };
    const latest = { id: 'newest' };
    const existing = {
      id: 'newest',
      ownerId: 'u1',
      formulaId: uuid,
      rating: 3,
      macerationDay: 1,
      t0Notes: 'first',
      t30mNotes: null,
      t4hNotes: null,
      t24hNotes: null,
      notes: 'first',
      clarity: 'clear',
      opalescence: 'none',
      solubility: 'complete',
      lineMarks: null,
    };
    const updated = { ...existing, t30mNotes: 'later' };
    const client = {
      select: vi
        .fn()
        .mockReturnValueOnce(chain([formula]))
        .mockReturnValueOnce(chain([latest]))
        .mockReturnValueOnce(chain([existing]))
        .mockReturnValueOnce(chain([formula])),
      update: vi.fn().mockReturnValue(chain([updated])),
      insert: vi.fn(),
    };
    const redis = redisMock();
    const entitlements = { assertQuota: vi.fn(async () => undefined) };
    const svc = new EvaluationsService(
      { client: () => client } as any,
      entitlements as any,
      redis as any,
    );
    const row = await svc.create(user, {
      formulaId: uuid,
      rating: 3,
      macerationDay: 1,
      t0Notes: 'first',
      t30mNotes: 'later',
    });
    expect(row.id).toBe('newest');
    expect(row.t30mNotes).toBe('later');
    expect(client.insert).not.toHaveBeenCalled();
    expect(entitlements.assertQuota).not.toHaveBeenCalled();
  });

  it('does not update a sitting owned by someone else', async () => {
    const client = {
      select: vi.fn().mockReturnValue(chain([])),
      update: vi.fn(),
    };
    const redis = redisMock();
    const entitlements = { assertQuota: vi.fn(async () => undefined) };
    const svc = new EvaluationsService(
      { client: () => client } as any,
      entitlements as any,
      redis as any,
    );
    await expect(svc.update(user, 'missing', { t30mNotes: 'nope' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(client.update).not.toHaveBeenCalled();
    expect(redis.cacheDel).not.toHaveBeenCalled();
  });

  it('asks the notification engine to sync after a day-1 save', async () => {
    const formula = { id: uuid, name: 'Rose study', ownerId: 'u1' };
    const inserted = { id: 'e1', formulaId: uuid, rating: 4, macerationDay: 1 };
    const client = {
      select: vi
        .fn()
        .mockReturnValueOnce(chain([formula]))
        .mockReturnValueOnce(chain([])),
      insert: vi.fn().mockReturnValue(chain([inserted])),
      update: vi.fn(),
    };
    const notifications = { onEvaluationSaved: vi.fn(async () => undefined) };
    const svc = new EvaluationsService(
      { client: () => client } as any,
      { assertQuota: vi.fn(async () => undefined) } as any,
      redisMock() as any,
      notifications as any,
    );
    await svc.create(user, { formulaId: uuid, rating: 4, macerationDay: 1 });
    expect(notifications.onEvaluationSaved).toHaveBeenCalledWith('u1', uuid, 1);
  });
});
