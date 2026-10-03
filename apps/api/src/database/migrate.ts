import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import pg from 'pg';
import { sealExistingFormulas } from './seal-formulas';

for (const candidate of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../../.env'),
]) {
  config({ path: candidate });
}

const url = process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL_MIGRATOR or DATABASE_URL is required');
}

async function main() {
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await sealExistingFormulas(pool);
  await pool.end();
  console.log('Migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
