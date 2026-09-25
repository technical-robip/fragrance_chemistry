import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormulasService } from './formulas.service';

const uuid = '11111111-1111-1111-1111-111111111111';
const user = { sub: 'u1', email: 'a@b.co' };

describe('FormulasService', () => {
  let svc: FormulasService;
  let client: any;
  let redis: {
    formulaDetailKey: ReturnType<typeof vi.fn>;
    cacheGet: ReturnType<typeof vi.fn>;
    cacheSet: ReturnType<typeof vi.fn>;
    cacheDel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    client = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    redis = {
      formulaDetailKey: vi.fn((owner: string, id: string) => `formula:detail:${owner}:${id}`),
      dashboardBriefingKey: vi.fn(
        (owner: string, id: string) => `dashboard:briefing:${owner}:${id}`,
      ),
      cacheGet: vi.fn(async () => null),
      cacheSet: vi.fn(async () => undefined),
      cacheDel: vi.fn(async () => 1),
    };
    svc = new FormulasService(
      { client: () => client } as any,
      {
        assertQuota: vi.fn(async () => undefined),
      } as any,
      redis as any,
    );
  });

  it('allows draft create without 100% total', async () => {
    const formula = { id: 'f1', name: 'Draft', slug: 'draft', status: 'draft', ownerId: 'u1' };
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          // allocateSlug + resolveOwned + lines
          limit: async () => [],
        }),
      }),
    });
    // allocateSlug select
    client.select
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [],
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [formula],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => {
          const chain = {
            innerJoin: () => chain,
            leftJoin: () => chain,
            where: () => ({
              orderBy: async () => [],
            }),
          };
          return chain;
        },
      });

    client.insert
      .mockReturnValueOnce({
        values: () => ({
          returning: async () => [formula],
        }),
      })
      .mockReturnValueOnce({
        values: async () => undefined,
      });

    const created = await svc.create(user, {
      name: 'Draft',
      status: 'draft',
      lines: [{ materialId: uuid, percent: 40 }],
    });
    expect(created.id).toBe('f1');
    expect(redis.cacheSet).toHaveBeenCalled();
  });

  it('rejects non-draft when lines do not total 100%', async () => {
    await expect(
      svc.create(user, {
        name: 'Ready',
        status: 'ready',
        lines: [{ materialId: uuid, percent: 40 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaceLines enforces 100% for ready formulas', async () => {
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [
            { id: 'f1', slug: 'f1', status: 'ready', ownerId: 'u1', name: 'Ready' },
          ],
        }),
      }),
    });
    await expect(
      svc.replaceLines(user, 'f1', {
        lines: [{ materialId: uuid, percent: 20 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when formula missing on get', async () => {
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
    await expect(svc.get(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns cached formula detail without hitting lines query', async () => {
    const formula = {
      id: 'f1',
      slug: 'rose-oud',
      name: 'Rose Oud',
      ownerId: 'u1',
      status: 'draft',
    };
    const cached = { ...formula, lines: [] };
    redis.cacheGet.mockResolvedValueOnce(cached);
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [formula],
        }),
      }),
    });
    const result = await svc.get(user, 'rose-oud');
    expect(result).toEqual(cached);
    expect(redis.cacheSet).not.toHaveBeenCalled();
  });

  it('invalidates formula detail, briefing, and parent caches on remove', async () => {
    client.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: 'f1', slug: 'f1', ownerId: 'u1', name: 'Child' }],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [{ formulaId: 'parent1' }],
        }),
      });
    client.delete.mockReturnValue({
      where: () => ({
        returning: async () => [{ id: 'f1' }],
      }),
    });

    const result = await svc.remove(user, 'f1');
    expect(result).toEqual({ id: 'f1', deleted: true });
    expect(redis.cacheDel).toHaveBeenCalledWith(
      'formula:detail:u1:f1',
      'dashboard:briefing:u1:f1',
      'formula:detail:u1:parent1',
      'dashboard:briefing:u1:parent1',
    );
  });

  it('blocks create when formula quota is exhausted', async () => {
    const entitlements = {
      assertQuota: vi.fn(async () => {
        throw new ForbiddenException('Quota reached for maxFormulas (3/3)');
      }),
    };
    svc = new FormulasService({ client: () => client } as any, entitlements as any, redis as any);
    await expect(
      svc.create(user, { name: 'X', status: 'draft', lines: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
