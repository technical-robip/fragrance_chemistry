import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import path from 'node:path';

config({ path: path.resolve(__dirname, '../../.env') });

const url = process.env.DATABASE_URL_MIGRATOR;
if (!url) {
  throw new Error('DATABASE_URL_MIGRATOR is required for drizzle-kit');
}

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  schemaFilter: ['core', 'catalog', 'lab', 'community'],
});
