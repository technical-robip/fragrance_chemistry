import { uniqueSlug } from '@fc/shared';
import type pg from 'pg';
import {
  decodeMasterKey,
  encryptJson,
  generateDek,
  headerAad,
  lineAad,
  slugHmac,
  unwrapDek,
  versionAad,
  wrapDek,
  type FormulaHeaderSecret,
  type FormulaLineSecret,
} from '../crypto/formula-crypto';

function masterKey() {
  const encoded = process.env.FORMULA_MASTER_KEY;
  if (!encoded) throw new Error('FORMULA_MASTER_KEY is required to seal formulas');
  return decodeMasterKey(encoded);
}

async function columnExists(client: pg.PoolClient, table: string, column: string) {
  const found = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'lab' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return (found.rowCount ?? 0) > 0;
}

/** Encrypt legacy plaintext recipes, then drop the clear columns. Idempotent. */
export async function sealExistingFormulas(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    const legacy = await columnExists(client, 'formulas', 'name');
    if (!legacy) {
      await relockLab(client);
      return;
    }
    const master = masterKey();
    const missing = await client.query<{ id: string }>(
      `SELECT o.id FROM core.organizations o
       LEFT JOIN core.organization_keys k ON k.org_id = o.id
       WHERE k.org_id IS NULL`,
    );
    for (const org of missing.rows) {
      const wrapped = wrapDek(generateDek(), master, org.id);
      await client.query(
        `INSERT INTO core.organization_keys (org_id, wrapped_dek, nonce, key_version)
         VALUES ($1, $2, $3, 1)`,
        [org.id, wrapped.secret, wrapped.nonce],
      );
    }

    const keyRows = await client.query<{
      org_id: string;
      wrapped_dek: Buffer;
      nonce: Buffer;
      key_version: number;
    }>(`SELECT org_id, wrapped_dek, nonce, key_version FROM core.organization_keys`);
    const deks = new Map<string, Buffer>();
    for (const row of keyRows.rows) {
      deks.set(row.org_id, unwrapDek(row.wrapped_dek, row.nonce, master, row.org_id));
    }

    const formulas = await client.query<{
      id: string;
      org_id: string;
      name: string;
      slug: string | null;
      description: string | null;
      diluent_label: string | null;
    }>(
      `SELECT id, org_id, name, slug, description, diluent_label
       FROM lab.formulas WHERE header_secret IS NULL`,
    );
    const taken = new Map<string, Set<string>>();
    for (const row of formulas.rows) {
      const dek = deks.get(row.org_id);
      if (!dek) throw new Error(`Missing laboratory key for ${row.org_id}`);
      const slugs = taken.get(row.org_id) ?? new Set<string>();
      taken.set(row.org_id, slugs);
      const slug = row.slug && !slugs.has(row.slug) ? row.slug : uniqueSlug(row.name, slugs);
      slugs.add(slug);
      const header: FormulaHeaderSecret = {
        name: row.name,
        slug,
        description: row.description,
        diluentLabel: row.diluent_label,
      };
      const sealed = encryptJson(header, dek, headerAad(row.org_id, row.id));
      await client.query(
        `UPDATE lab.formulas
         SET header_secret = $2, header_nonce = $3, slug_hmac = $4, key_version = 1
         WHERE id = $1`,
        [row.id, sealed.secret, sealed.nonce, slugHmac(dek, slug)],
      );
    }

    if (await columnExists(client, 'formula_lines', 'material_id')) {
      const lines = await client.query(
        `SELECT id, org_id, material_id, percent, target_grams, weighed_grams,
                stock_concentration_pct, solvent, pyramid_note, child_formula_id, sort_order
         FROM lab.formula_lines WHERE secret IS NULL`,
      );
      for (const line of lines.rows) {
        if (!line.material_id) {
          await client.query(`DELETE FROM lab.formula_lines WHERE id = $1`, [line.id]);
          continue;
        }
        const dek = deks.get(line.org_id);
        if (!dek) throw new Error(`Missing laboratory key for ${line.org_id}`);
        const payload: FormulaLineSecret = {
          materialId: line.material_id,
          percent: Number(line.percent),
          targetGrams: line.target_grams == null ? null : Number(line.target_grams),
          weighedGrams: line.weighed_grams == null ? null : Number(line.weighed_grams),
          stockConcentrationPct:
            line.stock_concentration_pct == null ? null : Number(line.stock_concentration_pct),
          solvent: line.solvent,
          pyramidNote: line.pyramid_note,
          childFormulaId: line.child_formula_id,
          sortOrder: Number(line.sort_order ?? 0),
        };
        const sealed = encryptJson(payload, dek, lineAad(line.org_id, line.id));
        await client.query(
          `UPDATE lab.formula_lines SET secret = $2, nonce = $3, key_version = 1 WHERE id = $1`,
          [line.id, sealed.secret, sealed.nonce],
        );
      }
    }

    if (await columnExists(client, 'formula_versions', 'snapshot')) {
      const versions = await client.query(
        `SELECT id, org_id, snapshot FROM lab.formula_versions
         WHERE snapshot_secret IS NULL AND snapshot IS NOT NULL`,
      );
      for (const version of versions.rows) {
        const dek = deks.get(version.org_id);
        if (!dek) throw new Error(`Missing laboratory key for ${version.org_id}`);
        const sealed = encryptJson(version.snapshot, dek, versionAad(version.org_id, version.id));
        await client.query(
          `UPDATE lab.formula_versions
           SET snapshot_secret = $2, snapshot_nonce = $3, key_version = 1
           WHERE id = $1`,
          [version.id, sealed.secret, sealed.nonce],
        );
      }
    }

    await client.query(`ALTER TABLE lab.formulas DROP COLUMN IF EXISTS name`);
    await client.query(`ALTER TABLE lab.formulas DROP COLUMN IF EXISTS slug`);
    await client.query(`ALTER TABLE lab.formulas DROP COLUMN IF EXISTS description`);
    await client.query(`ALTER TABLE lab.formulas DROP COLUMN IF EXISTS diluent_label`);
    await client.query(`DROP INDEX IF EXISTS lab.formulas_owner_slug_uidx`);
    await client.query(`DROP INDEX IF EXISTS lab.formulas_slug_idx`);
    await client.query(`ALTER TABLE lab.formulas ALTER COLUMN header_secret SET NOT NULL`);
    await client.query(`ALTER TABLE lab.formulas ALTER COLUMN header_nonce SET NOT NULL`);
    await client.query(`ALTER TABLE lab.formulas ALTER COLUMN slug_hmac SET NOT NULL`);

    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS material_id`);
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS percent`);
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS target_grams`);
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS weighed_grams`);
    await client.query(
      `ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS stock_concentration_pct`,
    );
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS solvent`);
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS pyramid_note`);
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS child_formula_id`);
    await client.query(`ALTER TABLE lab.formula_lines DROP COLUMN IF EXISTS sort_order`);
    await client.query(`DELETE FROM lab.formula_lines WHERE secret IS NULL`);
    await client.query(`ALTER TABLE lab.formula_lines ALTER COLUMN secret SET NOT NULL`);
    await client.query(`ALTER TABLE lab.formula_lines ALTER COLUMN nonce SET NOT NULL`);

    await client.query(`ALTER TABLE lab.formula_versions DROP COLUMN IF EXISTS snapshot`);
    await client.query(`DELETE FROM lab.formula_versions WHERE snapshot_secret IS NULL`);
    await client.query(
      `ALTER TABLE lab.formula_versions ALTER COLUMN snapshot_secret SET NOT NULL`,
    );
    await client.query(`ALTER TABLE lab.formula_versions ALTER COLUMN snapshot_nonce SET NOT NULL`);
    await relockLab(client);
    console.log('Formula recipes sealed');
  } finally {
    client.release();
  }
}

async function relockLab(client: pg.PoolClient) {
  for (const table of [
    'formulas',
    'formula_lines',
    'formula_versions',
    'evaluations',
    'inventory_items',
    'weighing_sessions',
  ]) {
    await client.query(`ALTER TABLE lab.${table} ENABLE ROW LEVEL SECURITY`);
    await client.query(`ALTER TABLE lab.${table} FORCE ROW LEVEL SECURITY`);
  }
}
