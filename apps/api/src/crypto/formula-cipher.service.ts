import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { getEnv } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { organizationKeys } from '../database/schema';
import {
  asBuffer,
  decodeMasterKey,
  decryptJson,
  encryptJson,
  headerAad,
  lineAad,
  slugHmac,
  unwrapDek,
  versionAad,
  type FormulaHeaderSecret,
  type FormulaLineSecret,
} from './formula-crypto';

export type SealedBlob = {
  secret: Buffer;
  nonce: Buffer;
  keyVersion: number;
};

@Injectable()
export class FormulaCipherService {
  constructor(private readonly db: DatabaseService) {}

  master() {
    return decodeMasterKey(getEnv().FORMULA_MASTER_KEY);
  }

  async keyFor(orgId: string) {
    const [row] = await this.db
      .client()
      .select()
      .from(organizationKeys)
      .where(eq(organizationKeys.orgId, orgId))
      .limit(1);
    if (!row) throw new NotFoundException('Laboratory key missing');
    return {
      dek: unwrapDek(asBuffer(row.wrappedDek), asBuffer(row.nonce), this.master(), orgId),
      version: row.keyVersion,
    };
  }

  sealHeader(
    orgId: string,
    formulaId: string,
    header: FormulaHeaderSecret,
    dek: Buffer,
    version: number,
  ) {
    const sealed = encryptJson(header, dek, headerAad(orgId, formulaId));
    return {
      ...sealed,
      slugHmac: slugHmac(dek, header.slug),
      keyVersion: version,
    };
  }

  openHeader(
    dek: Buffer,
    row: { id: string; orgId: string; headerSecret: Buffer; headerNonce: Buffer },
  ): FormulaHeaderSecret {
    return decryptJson(
      asBuffer(row.headerSecret),
      asBuffer(row.headerNonce),
      dek,
      headerAad(row.orgId, row.id),
    );
  }

  sealLine(
    orgId: string,
    lineId: string,
    line: FormulaLineSecret,
    dek: Buffer,
    version: number,
  ): SealedBlob {
    const sealed = encryptJson(line, dek, lineAad(orgId, lineId));
    return { ...sealed, keyVersion: version };
  }

  openLine(
    dek: Buffer,
    orgId: string,
    lineId: string,
    secret: Buffer,
    nonce: Buffer,
  ): FormulaLineSecret {
    return decryptJson(asBuffer(secret), asBuffer(nonce), dek, lineAad(orgId, lineId));
  }

  sealVersion(
    orgId: string,
    versionId: string,
    snapshot: unknown,
    dek: Buffer,
    version: number,
  ): SealedBlob {
    const sealed = encryptJson(snapshot, dek, versionAad(orgId, versionId));
    return { ...sealed, keyVersion: version };
  }
}
