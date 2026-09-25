import { describe, expect, it } from 'vitest';
import { loadSupplierDirectory, planSupplierUpserts } from './supplier-directory';

describe('supplier directory seed plan', () => {
  it('includes PHQ directory names and Packamor packaging notes', () => {
    const directory = loadSupplierDirectory();
    const names = directory.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Fraterworks',
        'Perfumer Supply House',
        "The Perfumer's Apprentice",
        'Harrison Joseph',
        'Perfumers World',
        'The Fragrance Foundry',
        'Eden Botanicals',
        'Liberty Natural',
        'The Perfumery',
        'Packamor',
        'DirectPCW',
      ]),
    );
    expect(new Set(names).size).toBe(names.length);
    const packamor = directory.find((row) => row.name === 'Packamor');
    expect(packamor?.notes?.toLowerCase()).toMatch(/packaging/);
    expect(packamor?.notes?.toLowerCase()).toMatch(/not an aroma/);
  });

  it('updates existing TPA / PerfumersWorld rows instead of inserting duplicates', () => {
    const directory = loadSupplierDirectory();
    const plan = planSupplierUpserts(directory, [
      "Perfumer's Apprentice",
      'PerfumersWorld',
      'DirectPCW',
    ]);
    expect(plan.find((row) => row.name === "The Perfumer's Apprentice")?.action).toBe('update');
    expect(plan.find((row) => row.name === 'Perfumers World')?.action).toBe('update');
    expect(plan.find((row) => row.name === 'DirectPCW')?.action).toBe('update');
    expect(plan.find((row) => row.name === 'Fraterworks')?.action).toBe('insert');
    expect(
      plan.filter((row) => row.action === 'insert').every((row) => row.matchName === null),
    ).toBe(true);

    const again = planSupplierUpserts(
      directory,
      directory.map((row) => row.name),
    );
    expect(again.every((row) => row.action === 'update')).toBe(true);
  });
});
