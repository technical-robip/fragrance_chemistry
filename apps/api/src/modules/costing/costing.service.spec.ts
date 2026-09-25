import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CostingService } from './costing.service';

const user = { sub: 'u1', email: 'a@b.co' };

function line(partial: Record<string, unknown>) {
  return {
    materialId: '11111111-1111-1111-1111-111111111111',
    percent: '50',
    costPerGram: '2',
    materialName: 'A',
    manufacturer: 'X',
    slug: 'a',
    stockConcentrationPct: '100',
    solvent: null,
    childFormulaId: null,
    ...partial,
  };
}

describe('CostingService', () => {
  it('estimates three costing tiers from formula detail', async () => {
    const formulas = {
      get: vi.fn(async () => ({
        id: 'f1',
        name: 'F1',
        ownerId: 'u1',
        concentrationPct: '20',
        batchTargetGrams: '50',
        lines: [
          line({
            materialId: '11111111-1111-1111-1111-111111111111',
            percent: '50',
            costPerGram: '2',
          }),
          line({
            materialId: '22222222-2222-2222-2222-222222222222',
            percent: '50',
            costPerGram: '1',
            materialName: 'B',
            manufacturer: 'Y',
            slug: 'b',
          }),
        ],
      })),
    };
    const svc = new CostingService(formulas as any);
    const result = await svc.estimateFormulaCost(user, 'f1', {
      batchGrams: 100,
      wastePct: 0,
      marginPct: 0,
      bottleMl: 50,
      packagingCost: 1,
    });
    expect(result.formulaId).toBe('f1');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]!.slug).toBe('a');
    expect(result.lines[0]!.stockConcentrationPct).toBe(100);
    expect(result.concentrate.materialCost).toBeGreaterThan(0);
    expect(result.diluted.batchGrams).toBeGreaterThan(result.batchGrams);
    expect(result.unit.rrp).toBeGreaterThan(0);
    expect(result.currency).toBe('USD');
  });

  it('defaults batch grams from the formula target', async () => {
    const formulas = {
      get: vi.fn(async () => ({
        id: 'f1',
        name: 'F1',
        concentrationPct: '20',
        batchTargetGrams: '25',
        lines: [line({ percent: '100' })],
      })),
    };
    const svc = new CostingService(formulas as any);
    const result = await svc.estimateFormulaCost(user, 'rose-oud');
    expect(formulas.get).toHaveBeenCalledWith(user, 'rose-oud');
    expect(result.batchGrams).toBe(25);
  });

  it('flattens nested accord lines into scaled materials', async () => {
    const formulas = {
      get: vi.fn(async (_u: unknown, id: string) => {
        if (id === 'child') {
          return {
            id: 'child',
            name: 'Accord',
            concentrationPct: '100',
            batchTargetGrams: '10',
            lines: [
              line({ percent: '40', materialName: 'Child A', slug: 'child-a', costPerGram: '4' }),
              line({
                percent: '60',
                materialId: '22222222-2222-2222-2222-222222222222',
                materialName: 'Child B',
                slug: 'child-b',
                costPerGram: '1',
              }),
            ],
          };
        }
        return {
          id: 'parent',
          name: 'Parent',
          concentrationPct: '20',
          batchTargetGrams: '100',
          lines: [
            line({ percent: '50', materialName: 'Top', slug: 'top' }),
            line({ percent: '50', childFormulaId: 'child', materialName: 'Accord' }),
          ],
        };
      }),
    };
    const svc = new CostingService(formulas as any);
    const result = await svc.estimateFormulaCost(user, 'parent', {
      batchGrams: 100,
      wastePct: 0,
      marginPct: 0,
    });
    expect(result.lines).toHaveLength(3);
    const childA = result.lines.find((l) => l.slug === 'child-a');
    expect(childA?.percent).toBeCloseTo(20, 5);
  });

  it('estimates from already loaded lines without querying formulas', () => {
    const formulas = { get: vi.fn() };
    const svc = new CostingService(formulas as any);
    const result = svc.estimateFromLines(
      { id: 'f1', name: 'F1', concentrationPct: '20' },
      [
        {
          materialId: '11111111-1111-1111-1111-111111111111',
          percent: '50',
          costPerGram: '2',
          materialName: 'A',
          manufacturer: 'X',
          slug: 'a',
          stockConcentrationPct: '10',
          solvent: 'DPG',
        },
        {
          materialId: '22222222-2222-2222-2222-222222222222',
          percent: '50',
          costPerGram: '1',
          materialName: 'B',
          manufacturer: 'Y',
        },
      ],
      {
        batchGrams: 100,
        wastePct: 0,
        marginPct: 0,
        bottleMl: 50,
        packagingCost: 1,
      },
    );
    expect(result.formulaId).toBe('f1');
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]!.stockConcentrationPct).toBe(10);
    expect(result.lines[0]!.solvent).toBe('DPG');
    expect(result.concentrate.materialCost).toBeGreaterThan(0);
    expect(formulas.get).not.toHaveBeenCalled();
  });

  it('throws when formula missing', async () => {
    const formulas = {
      get: vi.fn(async () => {
        throw new NotFoundException('Formula not found');
      }),
    };
    const svc = new CostingService(formulas as any);
    await expect(svc.estimateFormulaCost(user, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
