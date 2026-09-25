import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { IfraService } from './ifra.service';

const GALAXOLIDE_UUID = '11111111-1111-4111-8111-111111111111';

describe('IfraService.limitsForMaterial', () => {
  let client: { select: ReturnType<typeof vi.fn> };
  let svc: IfraService;

  beforeEach(() => {
    client = { select: vi.fn() };
    svc = new IfraService({ client: () => client } as never);
  });

  it('resolves galaxolide-synarome by slug instead of casting it as a uuid', async () => {
    const calls: string[] = [];
    client.select.mockImplementation((cols?: Record<string, unknown>) => {
      const keys = cols ? Object.keys(cols) : [];
      if (keys.length === 1 && keys[0] === 'id') {
        calls.push('resolve');
        return {
          from: () => ({
            where: () => ({
              limit: async () => [{ id: GALAXOLIDE_UUID }],
            }),
          }),
        };
      }
      calls.push(calls.includes('limits') ? 'standards' : 'limits');
      const rows =
        calls.at(-1) === 'limits'
          ? [
              {
                id: 'lim-1',
                maxPercent: '4.0000',
                categoryCode: '4',
                categoryLabel: 'Fine fragrance',
                materialName: 'Galaxolide',
              },
            ]
          : [];
      const chain = {
        from: () => chain,
        innerJoin: () => chain,
        where: async () => rows,
      };
      return chain;
    });

    const payload = await svc.limitsForMaterial('galaxolide-synarome');
    expect(calls[0]).toBe('resolve');
    expect(calls[1]).toBe('limits');
    expect(payload.limits).toHaveLength(1);
    expect(payload.limits[0]?.materialName).toBe('Galaxolide');
    expect(payload.standards).toEqual([]);
  });

  it('returns 404 when the slug is unknown', async () => {
    client.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
    await expect(svc.limitsForMaterial('galaxolide-synarome')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
