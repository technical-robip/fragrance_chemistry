import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createMaterialBodySchema, listMaterialsQuerySchema } from '@fc/shared';
import { CatalogService } from './catalog.service';

const user = { sub: 'u1', email: 'a@b.co' };

const bergamot = {
  id: 'm1',
  name: 'Bergamot EO',
  casNumber: '8007-75-8',
  category: 'Essential Oil',
  origin: null,
  olfactoryFamily: 'Fresh',
  pyramidNote: 'top',
  manufacturer: 'Firmenich',
  costPerGram: '0.12',
  slug: 'bergamot-eo',
  imageUrl: null,
  searchText: 'bergamot eo 8007-75-8 firmenich fresh top',
  isPrivate: false,
};

const privateAccord = {
  id: 'm2',
  name: 'Studio Accord',
  casNumber: null,
  category: 'accord',
  origin: 'blend',
  olfactoryFamily: 'Woody',
  pyramidNote: 'base',
  manufacturer: null,
  costPerGram: '0',
  slug: null,
  imageUrl: null,
  searchText: 'studio accord woody base',
  isPrivate: true,
};

describe('CatalogService', () => {
  let client: { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  let redis: {
    catalogPublicIndexKey: ReturnType<typeof vi.fn>;
    catalogPrivateIndexKey: ReturnType<typeof vi.fn>;
    cacheGet: ReturnType<typeof vi.fn>;
    cacheSet: ReturnType<typeof vi.fn>;
    cacheDel: ReturnType<typeof vi.fn>;
  };
  let svc: CatalogService;

  beforeEach(() => {
    client = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    redis = {
      catalogPublicIndexKey: vi.fn(() => 'catalog:index:public'),
      catalogPrivateIndexKey: vi.fn((id: string) => `catalog:index:private:${id}`),
      cacheGet: vi.fn(async () => null),
      cacheSet: vi.fn(async () => undefined),
      cacheDel: vi.fn(async () => 1),
    };
    svc = new CatalogService({ client: () => client } as any, redis as any);
  });

  it('serves list from Redis without hitting the database', async () => {
    redis.cacheGet.mockImplementation(async (key: string) => {
      if (key === 'catalog:index:public') return [bergamot, privateAccord];
      return null;
    });

    const rows = await svc.list(user, listMaterialsQuerySchema.parse({ q: 'berg', limit: 40 }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Bergamot EO');
    expect(client.select).not.toHaveBeenCalled();
  });

  it('merges private materials first when includePrivate is set', async () => {
    redis.cacheGet.mockImplementation(async (key: string) => {
      if (key === 'catalog:index:public') return [bergamot];
      if (key === 'catalog:index:private:u1') return [privateAccord];
      return null;
    });

    const rows = await svc.list(
      user,
      listMaterialsQuerySchema.parse({ includePrivate: '1', limit: 40 }),
    );
    expect(rows.map((r) => r.id)).toEqual(['m2', 'm1']);
  });

  it('excludes private materials from the public catalog list', async () => {
    redis.cacheGet.mockImplementation(async (key: string) => {
      if (key === 'catalog:index:public') return [bergamot];
      if (key === 'catalog:index:private:u1') return [privateAccord];
      return null;
    });

    const rows = await svc.list(user, listMaterialsQuerySchema.parse({ limit: 40 }));
    expect(rows.map((r) => r.id)).toEqual(['m1']);
  });

  it('creates a private material and invalidates the user index', async () => {
    const inserted = {
      id: 'm3',
      ownerId: 'u1',
      name: 'Lab Vetiver',
      category: 'essential_oil',
      origin: 'natural',
      pyramidNote: 'base',
      stockConcentrationPct: '100',
      costPerGram: '0',
      allergenProfile: {},
    };
    client.insert.mockReturnValue({
      values: () => ({
        returning: async () => [inserted],
      }),
    });

    const created = await svc.create(
      user,
      createMaterialBodySchema.parse({
        name: 'Lab Vetiver',
        category: 'essential_oil',
        origin: 'natural',
        pyramidNote: 'base',
      }),
    );

    expect(created.isPrivate).toBe(true);
    expect(created).not.toHaveProperty('ownerId');
    expect(redis.cacheDel).toHaveBeenCalledWith('catalog:index:private:u1');
  });

  it('throws when updating a material the user does not own', async () => {
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
    await expect(svc.update(user, 'missing', { name: 'Nope' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
