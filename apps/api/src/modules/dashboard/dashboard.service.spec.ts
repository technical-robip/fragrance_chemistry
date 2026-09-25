import { describe, expect, it, vi } from 'vitest';
import { DASHBOARD_BRIEFING_CACHE_TTL_SEC } from '../../redis/redis.service';
import { DashboardService } from './dashboard.service';

const user = { sub: 'u1', email: 'a@b.co' };
const FORMULA_UUID = '11111111-1111-4111-8111-111111111111';

function makeRedis() {
  return {
    dashboardBriefingKey: vi.fn(
      (owner: string, id: string) => `dashboard:briefing:v2:${owner}:${id}`,
    ),
    ifraLimitsKey: vi.fn((code: string) => `ifra:limits:${code}`),
    cacheGet: vi.fn(async (_key: string) => null as unknown),
    cacheSet: vi.fn(async () => undefined),
    cacheDel: vi.fn(async () => 1),
  };
}

function demoFormula(id = 'f1') {
  return {
    id,
    name: 'Demo Fougère',
    status: 'ready',
    concentrationPct: '20',
    batchTargetGrams: '100',
    lines: [
      {
        materialId: 'm1',
        slug: 'bergamot-eo',
        materialName: 'Bergamot EO',
        percent: '30',
        pyramidNote: 'top',
        olfactoryFamily: 'Citrus',
        imageUrl: '/media/materials/photos/bergamot-eo.jpg',
        costPerGram: '1',
      },
      {
        materialId: 'm2',
        slug: 'lavender-eo',
        materialName: 'Lavender EO',
        percent: '40',
        pyramidNote: 'middle',
        olfactoryFamily: 'Floral',
        imageUrl: '/media/materials/art/lavender-eo.svg',
        costPerGram: '1',
      },
      {
        materialId: 'm3',
        slug: 'oakmoss',
        materialName: 'Oakmoss',
        percent: '30',
        pyramidNote: 'base',
        olfactoryFamily: 'Woody',
        imageUrl: null,
        costPerGram: '1',
      },
    ],
  };
}

function briefingHarness(formulaId = 'f1') {
  const formulas = {
    get: vi.fn(async () => demoFormula(formulaId)),
  };
  const costing = {
    estimateFromLines: vi.fn(() => ({
      currency: 'USD',
      unit: { wholesale: 12.5 },
    })),
  };
  const evaluationsSvc = {
    list: vi.fn(async () => [{ rating: 4, macerationDay: 7, createdAt: new Date('2026-01-01') }]),
  };
  const db = {
    client: vi.fn(() => ({
      select: vi.fn(() => {
        throw new Error('IFRA should come from Redis in these tests');
      }),
    })),
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ defaultIfraCategory: 4 }],
          }),
        }),
      }),
    },
  };
  const redis = makeRedis();
  redis.cacheGet.mockImplementation(async (key: string) => {
    if (String(key).startsWith('ifra:limits:')) {
      return { categoryLabel: 'Fine fragrance', limits: { Linalool: 20 } };
    }
    return null;
  });
  const svc = new DashboardService(
    db as any,
    formulas as any,
    costing as any,
    evaluationsSvc as any,
    redis as any,
  );
  return { svc, formulas, costing, evaluationsSvc, db, redis };
}

describe('DashboardService', () => {
  it('aggregates counts with honest field names', async () => {
    const client = {
      select: vi.fn(),
    };

    let call = 0;
    client.select = vi.fn(() => {
      call += 1;
      const n = call;
      if (n === 2) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => [{ value: 10 }]),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ value: n === 4 ? 4 : 1 }]),
        })),
      };
    });

    const db = { client: () => client } as any;
    const svc = new DashboardService(db, {} as any, {} as any, {} as any, makeRedis() as any);
    const stats = await svc.stats({ sub: 'u1', email: 'a@b.co' });
    expect(stats.formulaCount).toBeGreaterThanOrEqual(0);
    expect(stats.catalogSize).toBeGreaterThanOrEqual(0);
    expect(typeof stats.evaluationCount).toBe('number');
    expect(typeof stats.lowStockItems).toBe('number');
    expect(stats.catalogSize).toBe(10);
    expect(stats.lowStockItems).toBe(4);
  });

  it('builds a formula briefing without fake families', async () => {
    const { svc, costing, redis } = briefingHarness();
    const briefing = await svc.briefing(user, 'f1');

    expect(briefing.formula.name).toBe('Demo Fougère');
    expect(briefing.pyramid.top).toBeCloseTo(30, 5);
    expect(briefing.families).toHaveLength(3);
    expect(briefing.families[0]!.name).toBe('Floral');
    expect(briefing.product.juiceClass).toBe('extrait');
    expect(briefing.product.costPer50ml).toBe(12.5);
    expect(briefing.lastEvaluation?.rating).toBe(4);
    expect(briefing.openSitting?.macerationDay).toBe(7);
    expect(briefing.openSitting?.complete).toBe(false);
    expect(briefing.lines[0]!.slug).toBe('bergamot-eo');
    expect(briefing.lines[0]!.imageUrl).toBe('/media/materials/photos/bergamot-eo.jpg');
    expect(briefing.lines[0]!.ppt).toBe(300);
    expect(briefing.product.diluentGrams).toBeCloseTo(400, 5);
    expect(briefing.compliance.category).toBe(4);
    expect(briefing.compliance.euLabel.coverage).toBe('subset');
    expect(briefing.compliance.euAnnex.coverage).toBe('subset');
    expect(briefing.pyramidVolatility).toBeTruthy();
    expect(costing.estimateFromLines).toHaveBeenCalled();
    expect(redis.cacheSet).toHaveBeenCalledWith(
      'dashboard:briefing:v2:u1:f1',
      expect.objectContaining({ formula: expect.objectContaining({ id: 'f1' }) }),
      DASHBOARD_BRIEFING_CACHE_TTL_SEC,
    );
  });

  it('returns empty families when materials lack olfactoryFamily', async () => {
    const { svc, formulas, evaluationsSvc } = briefingHarness();
    formulas.get.mockResolvedValue({
      id: 'f1',
      name: 'Blank',
      status: 'draft',
      concentrationPct: '12',
      batchTargetGrams: '50',
      lines: [
        {
          materialId: 'm1',
          slug: null,
          materialName: 'Mystery',
          percent: '100',
          pyramidNote: null,
          olfactoryFamily: null,
        },
      ],
    } as any);
    evaluationsSvc.list.mockResolvedValue([]);
    const briefing = await svc.briefing(user, 'f1');
    expect(briefing.families).toEqual([]);
    expect(briefing.pyramid.unassigned).toBeCloseTo(100, 5);
    expect(briefing.product.juiceClass).toBe('edt');
    expect(briefing.lastEvaluation).toBeNull();
  });

  it('returns cached briefing without loading the formula', async () => {
    const { svc, formulas, costing, evaluationsSvc, redis } = briefingHarness(FORMULA_UUID);
    const cached = { formula: { id: FORMULA_UUID, name: 'Cached' } };
    redis.cacheGet.mockImplementation(async (key: string) => {
      if (key === `dashboard:briefing:v2:u1:${FORMULA_UUID}`) return cached;
      return null;
    });

    const briefing = await svc.briefing(user, FORMULA_UUID);
    expect(briefing).toEqual(cached);
    expect(formulas.get).not.toHaveBeenCalled();
    expect(costing.estimateFromLines).not.toHaveBeenCalled();
    expect(evaluationsSvc.list).not.toHaveBeenCalled();
    expect(redis.cacheSet).not.toHaveBeenCalled();
  });

  it('checks category 4 from each material limit, not a shared allergen map', async () => {
    const { svc, db, redis } = briefingHarness();
    const briefing = await svc.briefing(user, 'f1');
    expect(briefing.compliance.category).toBe(4);
    expect(briefing.compliance.categoryLabel).toBe('Fine fragrance');
    expect(redis.ifraLimitsKey).not.toHaveBeenCalled();
    expect(db.client).not.toHaveBeenCalled();
  });
});
