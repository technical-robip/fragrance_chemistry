import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service';

const user = { sub: 'u1', email: 'a@b.co' };

describe('InventoryService', () => {
  it('adjusts quantity and clamps at zero', async () => {
    const existing = {
      id: 'i1',
      ownerId: 'u1',
      materialId: 'm1',
      quantityGrams: '15',
      kind: 'material',
      minQuantityGrams: '5',
      location: 'Bench',
      expiresAt: null,
    };
    const updated = { ...existing, quantityGrams: '5' };
    const client = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [existing],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    ...updated,
                    materialName: 'Linalool',
                    manufacturer: 'Givaudan',
                    olfactoryFamily: 'Floral',
                    costPerGram: '1.2',
                    casNumber: null,
                  },
                ],
              }),
            }),
          }),
        }),
      update: vi.fn().mockReturnValue({
        set: () => ({
          where: () => ({
            returning: async () => [updated],
          }),
        }),
      }),
    };
    const svc = new InventoryService(
      { client: () => client } as any,
      {
        assertQuota: vi.fn(async () => undefined),
      } as any,
    );
    const row = await svc.adjust(user, 'i1', { deltaGrams: -10 });
    expect(row.quantityGrams).toBe('5');
    expect(row.materialName).toBe('Linalool');
  });

  it('throws when inventory item missing', async () => {
    const client = {
      select: vi.fn().mockReturnValue({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      }),
    };
    const svc = new InventoryService(
      { client: () => client } as any,
      {
        assertQuota: vi.fn(async () => undefined),
      } as any,
    );
    await expect(svc.adjust(user, 'missing', { deltaGrams: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('adds grams when upserting an existing material', async () => {
    const existing = {
      id: 'i1',
      ownerId: 'u1',
      materialId: 'm1',
      quantityGrams: '20',
      kind: 'material',
      minQuantityGrams: '5',
      location: 'Bench',
      expiresAt: null,
    };
    const client = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [existing],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    ...existing,
                    quantityGrams: '30',
                    materialName: 'Linalool',
                    slug: 'linalool',
                    imageUrl: '/linalool.svg',
                    manufacturer: 'Givaudan',
                    olfactoryFamily: 'Floral',
                    costPerGram: '1.2',
                    casNumber: null,
                  },
                ],
              }),
            }),
          }),
        }),
      update: vi.fn().mockReturnValue({
        set: (patch: { quantityGrams: string }) => {
          expect(patch.quantityGrams).toBe('30');
          return {
            where: () => ({
              returning: async () => [{ ...existing, quantityGrams: '30' }],
            }),
          };
        },
      }),
    };
    const svc = new InventoryService(
      { client: () => client } as any,
      {
        assertQuota: vi.fn(async () => undefined),
      } as any,
    );
    const row = await svc.upsert(user, { materialId: 'm1', quantityGrams: 10 });
    expect(row.quantityGrams).toBe('30');
    expect(row.slug).toBe('linalool');
    expect(row.imageUrl).toBe('/linalool.svg');
  });

  it('patches min quantity without changing grams unless provided', async () => {
    const existing = {
      id: 'i1',
      ownerId: 'u1',
      materialId: 'm1',
      quantityGrams: '20',
      kind: 'material',
      minQuantityGrams: '5',
      location: 'Bench',
      expiresAt: null,
    };
    const client = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: async () => [existing],
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            innerJoin: () => ({
              where: () => ({
                limit: async () => [
                  {
                    ...existing,
                    minQuantityGrams: '8',
                    materialName: 'Linalool',
                    slug: 'linalool',
                    imageUrl: null,
                    manufacturer: null,
                    olfactoryFamily: null,
                    costPerGram: null,
                    casNumber: null,
                  },
                ],
              }),
            }),
          }),
        }),
      update: vi.fn().mockReturnValue({
        set: (patch: { quantityGrams: string; minQuantityGrams: string }) => {
          expect(patch.quantityGrams).toBe('20');
          expect(patch.minQuantityGrams).toBe('8');
          return {
            where: () => ({
              returning: async () => [{ ...existing, minQuantityGrams: '8' }],
            }),
          };
        },
      }),
    };
    const svc = new InventoryService(
      { client: () => client } as any,
      {
        assertQuota: vi.fn(async () => undefined),
      } as any,
    );
    const row = await svc.patch(user, 'i1', { minQuantityGrams: 8 });
    expect(row.minQuantityGrams).toBe('8');
    expect(row.slug).toBe('linalool');
  });
});
