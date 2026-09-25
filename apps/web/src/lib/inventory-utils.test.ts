import { describe, expect, it } from 'vitest';
import {
  filterInventory,
  isExpiringSoon,
  isLowStock,
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
});
