import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildPhqCoverage, loadCatalogIdentities, loadMaterialAliases } from './phq-coverage';
import { parseIfraOverviewRows, parseIfraOverviewWorkbook, planIfraImport } from './ifra-import';
import { planCatalogCasEnrichment } from './material-enrich';
import { decideMaterialMerge, stripDilution } from '@fc/shared';

describe('PHQ coverage vs catalog', () => {
  it('matches checklist names without ingesting compositions', () => {
    const report = buildPhqCoverage();
    expect(report.total).toBeGreaterThan(150);
    expect(report.name + report.alias + report.cas).toBeGreaterThan(report.miss);
    expect(report.matches.some((m) => m.query === 'Prunella' && m.kind === 'miss')).toBe(true);
    expect(report.matches.find((m) => m.query === 'Hedione')?.kind).not.toBe('miss');
    expect(report.matches.find((m) => m.query === 'Bergamot FCF')?.kind).not.toBe('miss');
    expect(report.matches.find((m) => m.query === 'Lilial')?.prohibited).toBe(true);
  });
});

describe('IFRA excel import', () => {
  it('collapses 5A/5B to category 5 using the most restrictive limit', () => {
    const incoming = parseIfraOverviewRows(
      ['CAS', 'Name', '5A', '5B', '4', '10A'],
      [['78-70-6', 'Linalool', '0.50', '0.20', '20', 'NS']],
    );
    const cat5 = incoming.find((row) => row.categoryCode === '5');
    expect(cat5?.maxPercent).toBe(0.2);
    expect(incoming.find((row) => row.categoryCode === '4')?.maxPercent).toBe(20);
    expect(incoming.some((row) => row.categoryCode === '10')).toBe(false);
  });

  it('parses a real xlsx buffer and plans idempotent upserts', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Standards');
    ws.addRow(['CAS', 'Name', 'Cat 4', 'Cat 12']);
    ws.addRow(['78-70-6', 'Linalool', 20, 100]);
    ws.addRow(['80-54-6', 'Lilial', 'Prohibited', 0]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const incoming = await parseIfraOverviewWorkbook(buffer);
    expect(incoming.some((row) => row.casNumber === '78-70-6' && row.categoryCode === '4')).toBe(
      true,
    );

    const catalog = loadCatalogIdentities();
    const first = planIfraImport(incoming, catalog, []);
    expect(first.find((row) => row.casNumber === '78-70-6')?.action).toBe('create');
    expect(first.find((row) => row.casNumber === '80-54-6')?.action).toBe('unmatched');

    const again = planIfraImport(incoming, catalog, [
      { casNumber: '78-70-6', materialName: 'Linalool', categoryCode: '4', maxPercent: 20 },
      { casNumber: '78-70-6', materialName: 'Linalool', categoryCode: '12', maxPercent: 100 },
    ]);
    expect(
      again.filter((row) => row.casNumber === '78-70-6').every((row) => row.action === 'unchanged'),
    ).toBe(true);
  });
});

describe('CAS enrich + dilution', () => {
  it('does not treat a 10% DPG dilution as a new catalog material', () => {
    const parsed = stripDilution('Beta Damascone 10% in DPG');
    const catalog = loadCatalogIdentities();
    const decision = decideMaterialMerge({ name: parsed.neatName }, catalog, {
      allowInsert: false,
    });
    expect(parsed.concentrationPct).toBe(10);
    expect(decision.action).not.toBe('insert');
  });

  it('fills Hedione CAS from aliases and never inserts', async () => {
    const plan = await planCatalogCasEnrichment(
      [{ name: 'Hedione', casNumber: null }],
      loadMaterialAliases(),
    );
    expect(plan[0]?.action).toBe('update');
    expect(plan[0]?.casNumber).toBe('24851-98-7');
  });
});

describe('library accords we own', () => {
  it('keeps 46 PHQ names as a gap checklist and authored sketches summing to 100%', () => {
    const root = path.resolve(process.cwd(), 'src/database/data');
    const gaps = JSON.parse(readFileSync(path.join(root, 'library-accord-gaps.json'), 'utf8')) as {
      items: Array<{ phqName: string; status: string; ourSlug?: string }>;
    };
    const accords = JSON.parse(
      readFileSync(path.join(root, 'library-accords.json'), 'utf8'),
    ) as Array<{
      slug: string;
      source: string;
      lines: Array<{ materialName: string; percent: number }>;
    }>;
    const catalogNames = new Set(loadCatalogIdentities().map((row) => row.name));
    expect(gaps.items).toHaveLength(46);
    expect(accords.every((a) => a.source === 'Fragrance Chemistry')).toBe(true);
    for (const accord of accords) {
      const total = accord.lines.reduce((sum, line) => sum + line.percent, 0);
      expect(total).toBe(100);
      for (const line of accord.lines) {
        expect(catalogNames.has(line.materialName)).toBe(true);
      }
    }
    const authored = gaps.items.filter((item) => item.status === 'authored');
    expect(authored.length).toBe(accords.length);
    expect(accords.some((a) => a.slug === 'jasmine-sketch')).toBe(true);
  });
});

describe('EU curated lists', () => {
  it('keeps API JSON in sync with the formula-engine subset', async () => {
    const { EU_LABEL_ALLERGENS, EU_ANNEX_III_FRAGRANCE } = await import('@fc/formula-engine');
    const root = path.resolve(process.cwd(), 'src/database/data');
    const labels = JSON.parse(
      readFileSync(path.join(root, 'eu-label-allergens.json'), 'utf8'),
    ) as Array<{
      inci: string;
    }>;
    const annex = JSON.parse(
      readFileSync(path.join(root, 'eu-annex-iii-fragrance.json'), 'utf8'),
    ) as Array<{
      cas: string;
      restriction: string;
    }>;
    expect(labels.map((row) => row.inci)).toEqual(EU_LABEL_ALLERGENS.map((row) => row.inci));
    expect(annex.map((row) => row.cas)).toEqual(EU_ANNEX_III_FRAGRANCE.map((row) => row.cas));
    expect(annex.some((row) => row.cas === '80-54-6' && row.restriction === 'ban')).toBe(true);
  });
});
