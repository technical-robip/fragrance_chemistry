import { describe, expect, it } from 'vitest';
import {
  decodeMasterKey,
  decryptJson,
  encryptJson,
  generateDek,
  headerAad,
  lineAad,
  slugHmac,
  unwrapDek,
  wrapDek,
  type FormulaLineSecret,
} from './formula-crypto';

describe('formula crypto', () => {
  const master = decodeMasterKey(Buffer.alloc(32, 7).toString('base64'));
  const orgId = '11111111-1111-4111-8111-111111111111';
  const formulaId = '22222222-2222-4222-8222-222222222222';

  it('rejects a master key that is not 32 bytes', () => {
    expect(() => decodeMasterKey(Buffer.alloc(16, 1).toString('base64'))).toThrow(
      /FORMULA_MASTER_KEY/,
    );
  });

  it('round-trips a recipe line and hides the material id from the ciphertext', () => {
    const dek = generateDek();
    const line: FormulaLineSecret = {
      materialId: '33333333-3333-4333-8333-333333333333',
      percent: 12.5,
      targetGrams: 1.25,
      weighedGrams: null,
      stockConcentrationPct: 10,
      solvent: 'DPG',
      pyramidNote: 'top',
      childFormulaId: null,
      sortOrder: 0,
    };
    const sealed = encryptJson(line, dek, lineAad(orgId, 'line-1'));
    expect(sealed.secret.toString('utf8')).not.toContain(line.materialId);
    expect(sealed.secret.toString('utf8')).not.toContain('DPG');
    expect(
      decryptJson<FormulaLineSecret>(sealed.secret, sealed.nonce, dek, lineAad(orgId, 'line-1')),
    ).toEqual(line);
  });

  it('refuses a ciphertext moved onto another formula', () => {
    const dek = generateDek();
    const sealed = encryptJson(
      { name: 'Rose', slug: 'rose', description: null, diluentLabel: null },
      dek,
      headerAad(orgId, formulaId),
    );
    expect(() =>
      decryptJson(sealed.secret, sealed.nonce, dek, headerAad(orgId, 'other-formula')),
    ).toThrow();
  });

  it('wraps the organization key so the database copy is not the raw key', () => {
    const dek = generateDek();
    const wrapped = wrapDek(dek, master, orgId);
    expect(wrapped.secret.equals(dek)).toBe(false);
    expect(unwrapDek(wrapped.secret, wrapped.nonce, master, orgId).equals(dek)).toBe(true);
    expect(() => unwrapDek(wrapped.secret, wrapped.nonce, master, 'other-org')).toThrow();
  });

  it('derives a stable slug hmac', () => {
    const dek = generateDek();
    expect(slugHmac(dek, 'rose-oud').equals(slugHmac(dek, 'rose-oud'))).toBe(true);
    expect(slugHmac(dek, 'rose-oud').equals(slugHmac(dek, 'rose-oud-2'))).toBe(false);
  });
});
