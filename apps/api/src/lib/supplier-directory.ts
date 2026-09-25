import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SupplierDirectoryRow = {
  name: string;
  aliases?: string[];
  region: string;
  country: string;
  website: string;
  notes?: string;
};

export type SupplierUpsertPlan = {
  action: 'insert' | 'update';
  name: string;
  matchName: string | null;
  row: SupplierDirectoryRow;
};

export function loadSupplierDirectory(cwd = process.cwd()): SupplierDirectoryRow[] {
  const file = path.resolve(cwd, 'src/database/data/suppliers-directory.json');
  return JSON.parse(readFileSync(file, 'utf8')) as SupplierDirectoryRow[];
}

export function planSupplierUpserts(
  directory: SupplierDirectoryRow[],
  existingNames: string[],
): SupplierUpsertPlan[] {
  const existing = new Map(existingNames.map((name) => [name.toLowerCase(), name]));
  return directory.map((row) => {
    const candidates = [row.name, ...(row.aliases ?? [])];
    const matchName =
      candidates.map((name) => existing.get(name.toLowerCase()) ?? null).find(Boolean) ?? null;
    return {
      action: matchName ? 'update' : 'insert',
      name: row.name,
      matchName,
      row,
    };
  });
}
