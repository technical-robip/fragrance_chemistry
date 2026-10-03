import { customType } from 'drizzle-orm/pg-core';

/** Postgres bytea. node-pg returns a Buffer; some paths return hex with a `\x` prefix. */
export const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Buffer) {
    return value;
  },
  fromDriver(value: unknown): Buffer {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (typeof value === 'string') {
      const hex = value.startsWith('\\x') ? value.slice(2) : value;
      return Buffer.from(hex, 'hex');
    }
    throw new Error('Expected bytea');
  },
});
