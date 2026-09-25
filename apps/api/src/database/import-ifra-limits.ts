import { config } from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { IFRA_PRODUCT_CATEGORIES } from '@fc/shared';
import { ifraCategories, ifraLimits, materials } from './schema';
import { parseIfraOverviewWorkbook, planIfraImport } from '../lib/ifra-import';
import { loadCatalogIdentities } from '../lib/phq-coverage';

config({ path: path.resolve(process.cwd(), '../../.env') });

function resolveWorkbookPath(): string {
  const fromEnv = process.env.IFRA_IMPORT_PATH;
  if (fromEnv) return path.resolve(fromEnv);
  const candidates = [
    path.resolve(process.cwd(), '../../data/ifra/standards.xlsx'),
    path.resolve(process.cwd(), 'src/database/data/import/standards.xlsx'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'IFRA workbook not found. Place the 51st Amendment overview Excel at data/ifra/standards.xlsx (gitignored) or set IFRA_IMPORT_PATH.',
    );
  }
  return found;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const file = resolveWorkbookPath();
  const incoming = await parseIfraOverviewWorkbook(readFileSync(file));
  const catalog = loadCatalogIdentities();

  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR or DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);

  for (const category of IFRA_PRODUCT_CATEGORIES) {
    const [found] = await db
      .select()
      .from(ifraCategories)
      .where(eq(ifraCategories.code, category.code))
      .limit(1);
    if (!found) await db.insert(ifraCategories).values(category);
  }

  const categoryRows = await db.select().from(ifraCategories);
  const materialRows = await db
    .select({ name: materials.name, casNumber: materials.casNumber, id: materials.id })
    .from(materials);
  const limitRows = await db
    .select({
      maxPercent: ifraLimits.maxPercent,
      materialId: ifraLimits.materialId,
      categoryId: ifraLimits.categoryId,
    })
    .from(ifraLimits);

  const materialById = new Map(materialRows.map((row) => [row.id, row]));
  const existing = limitRows.flatMap((lim) => {
    const mat = materialById.get(lim.materialId);
    const cat = categoryRows.find((c) => c.id === lim.categoryId);
    if (!mat || !cat) return [];
    return [
      {
        casNumber: mat.casNumber,
        materialName: mat.name,
        categoryCode: cat.code,
        maxPercent: Number(lim.maxPercent),
      },
    ];
  });

  const plan = planIfraImport(incoming, catalog, existing);
  const counts = {
    create: plan.filter((r) => r.action === 'create').length,
    update: plan.filter((r) => r.action === 'update').length,
    unchanged: plan.filter((r) => r.action === 'unchanged').length,
    unmatched: plan.filter((r) => r.action === 'unmatched').length,
  };
  console.log(counts);

  if (dryRun) {
    await pool.end();
    return;
  }

  const idByCas = new Map(
    materialRows.filter((m) => m.casNumber).map((m) => [m.casNumber as string, m.id]),
  );
  const idByName = new Map(materialRows.map((m) => [m.name.toLowerCase(), m.id]));
  const catId = new Map(categoryRows.map((c) => [c.code, c.id]));

  for (const row of plan) {
    if (row.action !== 'create' && row.action !== 'update') continue;
    const materialId =
      idByCas.get(row.casNumber) ??
      (row.materialName ? idByName.get(row.materialName.toLowerCase()) : undefined);
    const categoryId = catId.get(row.categoryCode);
    if (!materialId || !categoryId) continue;
    if (row.action === 'create') {
      await db.insert(ifraLimits).values({
        materialId,
        categoryId,
        maxPercent: String(row.maxPercent),
      });
    } else {
      await db
        .update(ifraLimits)
        .set({ maxPercent: String(row.maxPercent) })
        .where(and(eq(ifraLimits.materialId, materialId), eq(ifraLimits.categoryId, categoryId)));
    }
  }

  await pool.end();
  console.log('IFRA import complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
