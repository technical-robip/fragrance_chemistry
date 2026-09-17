import { config } from 'dotenv';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { formulas } from '../src/database/schema/lab';

config({ path: path.resolve(process.cwd(), '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for RLS e2e tests');
}

describe('lab RLS tenant isolation', () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  const userA = randomUUID();
  const userB = randomUUID();
  let formulaIdA: string;

  beforeAll(async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userA}, true)`);
      const [row] = await tx
        .insert(formulas)
        .values({ ownerId: userA, name: 'RLS test formula A' })
        .returning({ id: formulas.id });
      if (!row) throw new Error('seed formula failed');
      formulaIdA = row.id;
    });
  });

  afterAll(async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userA}, true)`);
      await tx.execute(sql`DELETE FROM lab.formulas WHERE id = ${formulaIdA}`);
    });
    await pool.end();
  });

  it('owner sees their formula', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userA}, true)`);
      return tx.select().from(formulas);
    });
    expect(rows.some((r) => r.id === formulaIdA)).toBe(true);
  });

  it('other tenant cannot see the formula', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userB}, true)`);
      return tx.select().from(formulas);
    });
    expect(rows.some((r) => r.id === formulaIdA)).toBe(false);
  });

  it('other tenant cannot insert as owner', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.user_id', ${userB}, true)`);
        await tx.insert(formulas).values({ ownerId: userA, name: 'spoof' });
      }),
    ).rejects.toThrow();
  });
});
