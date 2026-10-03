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
      for (const [id, email, name] of [
        [userA, `rls-a-${userA}@example.com`, 'RLS A'],
        [userB, `rls-b-${userB}@example.com`, 'RLS B'],
      ] as const) {
        await tx.execute(sql`
          INSERT INTO core.users (id, email, password_hash, display_name)
          VALUES (${id}::uuid, ${email}, 'x', ${name})
          ON CONFLICT (id) DO NOTHING
        `);
        await tx.execute(sql`
          SELECT core.provision_personal_organization(
            ${id}::uuid,
            ${name},
            ${Buffer.alloc(32, 1)}::bytea,
            ${Buffer.alloc(12, 2)}::bytea
          )
        `);
      }
      await tx.execute(sql`SELECT set_config('app.user_id', ${userA}, true)`);
      await tx.execute(sql`SELECT set_config('app.org_id', ${userA}, true)`);
      const [row] = await tx
        .insert(formulas)
        .values({
          orgId: userA,
          ownerId: userA,
          headerSecret: Buffer.from('sealed-a'),
          headerNonce: Buffer.from('nonce-a'),
          slugHmac: Buffer.from(`hmac-${userA}`),
        })
        .returning({ id: formulas.id });
      if (!row) throw new Error('seed formula failed');
      formulaIdA = row.id;
    });
  });

  afterAll(async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userA}, true)`);
      await tx.execute(sql`SELECT set_config('app.org_id', ${userA}, true)`);
      await tx.execute(sql`DELETE FROM lab.formulas WHERE id = ${formulaIdA}::uuid`);
    });
    await pool.end();
  });

  it('owner sees their formula', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userA}, true)`);
      await tx.execute(sql`SELECT set_config('app.org_id', ${userA}, true)`);
      return tx.select().from(formulas);
    });
    expect(rows.some((r) => r.id === formulaIdA)).toBe(true);
    expect(rows.find((r) => r.id === formulaIdA)?.headerSecret.toString()).not.toContain('Rose');
  });

  it('other tenant cannot see the formula', async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.user_id', ${userB}, true)`);
      await tx.execute(sql`SELECT set_config('app.org_id', ${userB}, true)`);
      return tx.select().from(formulas);
    });
    expect(rows.some((r) => r.id === formulaIdA)).toBe(false);
  });

  it('other tenant cannot insert into another laboratory', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.user_id', ${userB}, true)`);
        await tx.execute(sql`SELECT set_config('app.org_id', ${userB}, true)`);
        await tx.insert(formulas).values({
          orgId: userA,
          ownerId: userA,
          headerSecret: Buffer.from('spoof'),
          headerNonce: Buffer.from('spoof'),
          slugHmac: Buffer.from('spoof'),
        });
      }),
    ).rejects.toThrow();
  });
});
