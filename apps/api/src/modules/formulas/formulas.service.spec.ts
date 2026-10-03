import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormulaHeaderSecret, FormulaLineSecret } from '../../crypto/formula-crypto';
import { FormulasService } from './formulas.service';

const uuid = '11111111-1111-4111-8111-111111111111';
const user = { sub: 'u1', email: 'a@b.co', org: 'u1' };

function cipher() {
  return {
    keyFor: vi.fn(async () => ({ dek: Buffer.from('k'), version: 1 })),
    sealHeader: vi.fn((orgId: string, formulaId: string, header: FormulaHeaderSecret) => ({
      secret: Buffer.from(JSON.stringify({ orgId, formulaId, header })),
      nonce: Buffer.from('h'),
      slugHmac: Buffer.from(header.slug),
      keyVersion: 1,
    })),
    openHeader: vi.fn((_dek: Buffer, row: { headerSecret: Buffer }) => {
      return JSON.parse(row.headerSecret.toString()).header as FormulaHeaderSecret;
    }),
    sealLine: vi.fn((_org: string, _id: string, line: FormulaLineSecret) => ({
      secret: Buffer.from(JSON.stringify(line)),
      nonce: Buffer.from('l'),
      keyVersion: 1,
    })),
    openLine: vi.fn((_dek: Buffer, _org: string, _id: string, secret: Buffer) => {
      return JSON.parse(secret.toString()) as FormulaLineSecret;
    }),
  };
}

describe('FormulasService', () => {
  let svc: FormulasService;
  let client: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let redis: { cacheDel: ReturnType<typeof vi.fn>; cacheSet: ReturnType<typeof vi.fn> };
  let vault: ReturnType<typeof cipher>;

  beforeEach(() => {
    client = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    redis = {
      cacheDel: vi.fn(async () => 1),
      cacheSet: vi.fn(async () => undefined),
      formulaDetailKey: vi.fn((owner: string, id: string) => `formula:${owner}:${id}`),
      dashboardBriefingKey: vi.fn((owner: string, id: string) => `brief:${owner}:${id}`),
    } as any;
    vault = cipher();
    svc = new FormulasService(
      { client: () => client } as any,
      { assertQuota: vi.fn(async () => undefined) } as any,
      redis as any,
      vault as any,
    );
  });

  it('rejects a ready formula that does not total 100%', async () => {
    await expect(
      svc.create(user, {
        name: 'Ready',
        status: 'ready',
        lines: [{ materialId: uuid, percent: 40 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the recipe as ciphertext', async () => {
    const inserted: { values?: unknown } = {};
    client.select.mockReturnValue({
      from: () => ({
        where: async () => [],
      }),
    });
    client.insert.mockImplementation(() => ({
      values: (values: unknown) => {
        inserted.values = values;
        return {
          returning: async () => [
            {
              id: 'f1',
              orgId: 'u1',
              ownerId: 'u1',
              status: 'draft',
              headerSecret: Buffer.from('{}'),
              headerNonce: Buffer.from('h'),
              batchTargetGrams: '10',
              concentrationPct: '20',
              version: 1,
              isLibraryAccord: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              keyVersion: 1,
            },
          ],
        };
      },
    }));
    client.select
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [],
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: 'f1',
                orgId: 'u1',
                ownerId: 'u1',
                status: 'draft',
                headerSecret: Buffer.from(
                  JSON.stringify({
                    header: { name: 'Draft', slug: 'draft', description: null, diluentLabel: null },
                  }),
                ),
                headerNonce: Buffer.from('h'),
                batchTargetGrams: '10',
                concentrationPct: '20',
                version: 1,
                isLibraryAccord: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                keyVersion: 1,
              },
            ],
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: async () => [],
        }),
      });

    const created = await svc.create(user, {
      name: 'Draft',
      status: 'draft',
      lines: [],
    });
    const values = inserted.values as { headerSecret?: Buffer; percent?: unknown; name?: unknown };
    expect(values.headerSecret).toBeInstanceOf(Buffer);
    expect(values).not.toHaveProperty('percent');
    expect(values).not.toHaveProperty('name');
    expect(created.name).toBe('Draft');
    expect(redis.cacheSet).not.toHaveBeenCalled();
  });

  it('throws when the formula is missing', async () => {
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
    await expect(svc.get(user, uuid)).rejects.toBeInstanceOf(NotFoundException);
  });
});
