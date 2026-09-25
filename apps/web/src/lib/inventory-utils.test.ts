import { describe, expect, it } from 'vitest';
import {
  filterInventory,
  isExpired,
  isExpiringSoon,
  isLowStock,
  paginateInventory,
  restockEstimate,
  searchInventory,
} from './inventory-utils';

describe('inventory-utils', () => {
  it('detects low stock and expiring items', () => {
    expect(isLowStock({ quantityGrams: 5, minQuantityGrams: 10 })).toBe(true);
    expect(isLowStock({ quantityGrams: 20, minQuantityGrams: 10 })).toBe(false);
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpiringSoon({ quantityGrams: 1, expiresAt: soon }, 60)).toBe(true);
    expect(isExpiringSoon({ quantityGrams: 1, expiresAt: null })).toBe(false);
  });

  it('filters by chip mode', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const items = [
      { quantityGrams: 5, minQuantityGrams: 10, kind: 'material', expiresAt: null },
      { quantityGrams: 50, minQuantityGrams: 10, kind: 'consumable', expiresAt: soon },
    ];
    expect(filterInventory(items, 'low')).toHaveLength(1);
    expect(filterInventory(items, 'material')).toHaveLength(1);
    expect(filterInventory(items, 'consumable')).toHaveLength(1);
    expect(filterInventory(items, 'expiring')).toHaveLength(1);
    expect(filterInventory(items, 'all')).toHaveLength(2);
  });

  it('searches name manufacturer and location', () => {
    const items = [
      {
        quantityGrams: 1,
        materialName: 'Bergamot EO',
        manufacturer: 'Firmenich',
        location: 'Bench',
      },
      { quantityGrams: 1, materialName: 'Oakmoss', manufacturer: 'IFF', location: 'Fridge' },
    ];
    expect(searchInventory(items, 'berg')).toHaveLength(1);
    expect(searchInventory(items, 'fridge')).toHaveLength(1);
    expect(searchInventory(items, 'iff')).toHaveLength(1);
    expect(searchInventory(items, '')).toHaveLength(2);
  });

  it('estimates restock cost', () => {
    const total = restockEstimate([
      { quantityGrams: 5, minQuantityGrams: 15, costPerGram: 2 },
      { quantityGrams: 40, minQuantityGrams: 10, costPerGram: 9 },
    ]);
    expect(total).toBe(20);
  });

  it('splits expiry into expired, due soon, and still in date', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    const day = 24 * 60 * 60 * 1000;
    const past = new Date(now - day).toISOString();
    const edge = new Date(now + 60 * day).toISOString();
    const later = new Date(now + 61 * day).toISOString();
    expect(isExpired({ quantityGrams: 1, expiresAt: past }, now)).toBe(true);
    expect(isExpiringSoon({ quantityGrams: 1, expiresAt: past }, 60, now)).toBe(false);
    expect(isExpiringSoon({ quantityGrams: 1, expiresAt: edge }, 60, now)).toBe(true);
    expect(isExpiringSoon({ quantityGrams: 1, expiresAt: later }, 60, now)).toBe(false);
    expect(isExpired({ quantityGrams: 1, expiresAt: 'not-a-date' }, now)).toBe(false);
    expect(isExpiringSoon({ quantityGrams: 1, expiresAt: 'not-a-date' }, 60, now)).toBe(false);
  });

  it('pages 25 rows and clamps an empty filtered page', () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({ id: i }));
    expect(paginateInventory([], 3).items).toHaveLength(0);
    expect(paginateInventory([], 3).page).toBe(1);
    expect(paginateInventory(rows, 1).items).toHaveLength(25);
    expect(paginateInventory(rows, 2).items).toEqual([{ id: 25 }]);
    expect(paginateInventory(rows.slice(0, 1), 2).page).toBe(1);
    expect(paginateInventory(rows.slice(0, 1), 2).items).toEqual([{ id: 0 }]);
  });
});
