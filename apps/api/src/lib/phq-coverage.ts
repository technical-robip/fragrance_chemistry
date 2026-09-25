import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  coverageReport,
  type CatalogIdentity,
  type CoverageReport,
  type MaterialAlias,
} from '@fc/shared';

export function dataFile(name: string, cwd = process.cwd()): string {
  return path.resolve(cwd, 'src/database/data', name);
}

export function loadCatalogIdentities(cwd?: string): CatalogIdentity[] {
  const rows = JSON.parse(
    readFileSync(dataFile('materials-catalog.json', cwd), 'utf8'),
  ) as CatalogIdentity[];
  return rows.map((row) => ({
    name: row.name,
    casNumber: row.casNumber ?? null,
    manufacturer: row.manufacturer ?? null,
    iupac: row.iupac ?? null,
  }));
}

export function loadMaterialAliases(cwd?: string): MaterialAlias[] {
  return JSON.parse(
    readFileSync(dataFile('material-aliases.json', cwd), 'utf8'),
  ) as MaterialAlias[];
}

export function loadPhqIngredientChecklist(cwd?: string): string[] {
  return JSON.parse(
    readFileSync(dataFile('phq-ingredient-checklist.json', cwd), 'utf8'),
  ) as string[];
}

export function buildPhqCoverage(cwd?: string): CoverageReport {
  return coverageReport(
    loadPhqIngredientChecklist(cwd),
    loadCatalogIdentities(cwd),
    loadMaterialAliases(cwd),
  );
}
