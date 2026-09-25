import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import path from 'node:path';
import pg from 'pg';
import { materials } from './schema';
import { loadCatalogIdentities, loadMaterialAliases } from '../lib/phq-coverage';
import { lookupPubChem, planCatalogCasEnrichment } from '../lib/material-enrich';

config({ path: path.resolve(process.cwd(), '../../.env') });

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const online = process.argv.includes('--pubchem');
  const catalog = loadCatalogIdentities();
  const aliases = loadMaterialAliases();
  const plan = await planCatalogCasEnrichment(catalog, aliases, online ? lookupPubChem : undefined);
  const counts = {
    update: plan.filter((r) => r.action === 'update').length,
    skipDuplicate: plan.filter((r) => r.action === 'skip-duplicate').length,
  };
  console.log(counts);
  if (dryRun) return;

  const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR or DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);

  for (const row of plan) {
    if (row.action !== 'update') continue;
    const [existing] = await db
      .select()
      .from(materials)
      .where(eq(materials.name, row.name))
      .limit(1);
    if (!existing) continue;
    await db
      .update(materials)
      .set({
        casNumber: existing.casNumber ?? row.casNumber ?? null,
        iupac: existing.iupac ?? row.iupac ?? null,
      })
      .where(eq(materials.id, existing.id));
  }
  await pool.end();
  console.log('CAS enrich complete (existing rows only)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
