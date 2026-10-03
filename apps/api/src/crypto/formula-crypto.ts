import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export type FormulaHeaderSecret = {
  name: string;
  slug: string;
  description: string | null;
  diluentLabel: string | null;
};

export type FormulaLineSecret = {
  materialId: string;
  percent: number;
  targetGrams: number | null;
  weighedGrams: number | null;
  stockConcentrationPct: number | null;
  solvent: string | null;
  pyramidNote: string | null;
  childFormulaId: string | null;
  sortOrder: number;
};

export function decodeMasterKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error('FORMULA_MASTER_KEY must be 32 bytes, base64-encoded');
  }
  return key;
}

export function generateDek(): Buffer {
  return randomBytes(KEY_BYTES);
}

export function dekAad(orgId: string) {
  return `org-dek:${orgId}`;
}

export function headerAad(orgId: string, formulaId: string) {
  return `formula-header:${orgId}:${formulaId}`;
}

export function lineAad(orgId: string, lineId: string) {
  return `formula-line:${orgId}:${lineId}`;
}

export function versionAad(orgId: string, versionId: string) {
  return `formula-version:${orgId}:${versionId}`;
}

export function encryptBytes(plain: Buffer, key: Buffer, aad: string) {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const secret = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return { secret, nonce };
}

export function decryptBytes(secret: Buffer, nonce: Buffer, key: Buffer, aad: string): Buffer {
  if (secret.length < TAG_BYTES) throw new Error('Ciphertext is truncated');
  const tag = secret.subarray(secret.length - TAG_BYTES);
  const data = secret.subarray(0, secret.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function encryptJson(value: unknown, key: Buffer, aad: string) {
  return encryptBytes(Buffer.from(JSON.stringify(value), 'utf8'), key, aad);
}

export function decryptJson<T>(secret: Buffer, nonce: Buffer, key: Buffer, aad: string): T {
  return JSON.parse(decryptBytes(secret, nonce, key, aad).toString('utf8')) as T;
}

export function wrapDek(dek: Buffer, master: Buffer, orgId: string) {
  return encryptBytes(dek, master, dekAad(orgId));
}

export function unwrapDek(secret: Buffer, nonce: Buffer, master: Buffer, orgId: string) {
  const dek = decryptBytes(secret, nonce, master, dekAad(orgId));
  if (dek.length !== KEY_BYTES) throw new Error('Unwrapped organization key has the wrong length');
  return dek;
}

export function slugHmac(dek: Buffer, slug: string) {
  return createHmac('sha256', dek).update(slug, 'utf8').digest();
}

export function asBuffer(value: Buffer | Uint8Array | string): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') ? value.slice(2) : value;
    return Buffer.from(hex, 'hex');
  }
  throw new Error('Expected bytea');
}
