import { config } from 'dotenv';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

config({ path: path.resolve(process.cwd(), '../../.env') });

/**
 * Proves RLS isolation: user A cannot read user B's formulas
 * when connected as fragrance_chemistry_app (NOBYPASSRLS).
 */
describe('lab RLS isolation', () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL required for RLS test');
  }

  let pool: pg.Pool;
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';
  let formulaB: string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userB]);
      const inserted = await client.query(
        `INSERT INTO lab.formulas (owner_id, name) VALUES ($1, 'secret-b') RETURNING id`,
        [userB],
      );
      formulaB = inserted.rows[0].id as string;
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userB]);
      await client.query(`DELETE FROM lab.formulas WHERE id = $1`, [formulaB]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('hides other tenants rows', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userA]);
      const res = await client.query(`SELECT id FROM lab.formulas WHERE id = $1`, [formulaB]);
      expect(res.rowCount).toBe(0);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });

  it('allows owner to see own rows', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.user_id', $1, true)`, [userB]);
      const res = await client.query(`SELECT id FROM lab.formulas WHERE id = $1`, [formulaB]);
      expect(res.rowCount).toBe(1);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
});
