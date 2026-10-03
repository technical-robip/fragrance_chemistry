import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateFormulaBody,
  ReplaceFormulaLinesBody,
  UpdateFormulaBody,
  uniqueSlug,
} from '@fc/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { FormulaCipherService } from '../../crypto/formula-cipher.service';
import type { FormulaHeaderSecret, FormulaLineSecret } from '../../crypto/formula-crypto';
import { slugHmac } from '../../crypto/formula-crypto';
import { DatabaseService } from '../../database/database.service';
import {
  formulaLines,
  formulas,
  ifraCategories,
  ifraLimits,
  materials,
} from '../../database/schema';
import { RedisService } from '../../redis/redis.service';
import { activeOrg, JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertHundredPercent(lines: { percent: number }[], required: boolean) {
  if (!required || lines.length === 0) return;
  const totalPercent = lines.reduce((sum, line) => sum + line.percent, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new BadRequestException(`Formula lines must total 100% (got ${totalPercent})`);
  }
}

function lineSecret(
  line: {
    materialId: string;
    percent: number;
    sortOrder?: number;
    pyramidNote?: string | null;
    weighedGrams?: number | null;
    targetGrams?: number | null;
    childFormulaId?: string | null;
    stockConcentrationPct?: number | null;
    solvent?: string | null;
  },
  index: number,
): FormulaLineSecret {
  return {
    materialId: line.materialId,
    percent: line.percent,
    targetGrams: line.targetGrams ?? null,
    weighedGrams: line.weighedGrams ?? null,
    stockConcentrationPct: line.stockConcentrationPct ?? null,
    solvent: line.solvent ?? null,
    pyramidNote: line.pyramidNote ?? null,
    childFormulaId: line.childFormulaId ?? null,
    sortOrder: line.sortOrder ?? index,
  };
}

export type FormulaDetail = Awaited<ReturnType<FormulasService['loadDetail']>>;

@Injectable()
export class FormulasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly redis: RedisService,
    private readonly cipher: FormulaCipherService,
  ) {}

  async list(user: JwtPayload) {
    const orgId = activeOrg(user);
    const rows = await this.db
      .client()
      .select()
      .from(formulas)
      .where(eq(formulas.orgId, orgId))
      .orderBy(asc(formulas.updatedAt));
    const key = rows.length ? await this.cipher.keyFor(orgId) : null;
    return rows.map((row) => this.present(row, this.cipher.openHeader(key!.dek, row)));
  }

  async create(user: JwtPayload, body: CreateFormulaBody) {
    const status = body.status ?? 'draft';
    assertHundredPercent(body.lines, status !== 'draft');
    const orgId = activeOrg(user);
    await this.entitlements.assertQuota(user.sub, 'maxFormulas', orgId);

    const id = randomUUID();
    const key = await this.cipher.keyFor(orgId);
    const slug = await this.allocateSlug(orgId, body.name, key.dek);
    const header: FormulaHeaderSecret = {
      name: body.name,
      slug,
      description: body.description ?? null,
      diluentLabel: body.diluentLabel ?? null,
    };
    const sealed = this.cipher.sealHeader(orgId, id, header, key.dek, key.version);
    const db = this.db.client();
    const [formula] = await db
      .insert(formulas)
      .values({
        id,
        orgId,
        ownerId: user.sub,
        headerSecret: sealed.secret,
        headerNonce: sealed.nonce,
        slugHmac: sealed.slugHmac,
        keyVersion: sealed.keyVersion,
        batchTargetGrams: body.batchTargetGrams?.toString(),
        concentrationPct: body.concentrationPct?.toString(),
        status,
        isLibraryAccord: body.isLibraryAccord ?? false,
      })
      .returning();
    if (!formula) throw new NotFoundException('Could not create formula');

    if (body.lines.length > 0) {
      await db.insert(formulaLines).values(
        body.lines.map((line, idx) => {
          const lineId = randomUUID();
          const secret = this.cipher.sealLine(
            orgId,
            lineId,
            lineSecret(line, idx),
            key.dek,
            key.version,
          );
          return {
            id: lineId,
            formulaId: formula.id,
            orgId,
            ownerId: user.sub,
            secret: secret.secret,
            nonce: secret.nonce,
            keyVersion: secret.keyVersion,
          };
        }),
      );
    }

    return this.get(user, formula.id);
  }

  async get(user: JwtPayload, idOrSlug: string) {
    const formula = await this.resolveOwned(user, idOrSlug);
    return this.loadDetail(formula.row, formula.header);
  }

  async update(user: JwtPayload, idOrSlug: string, body: UpdateFormulaBody) {
    const owned = await this.requireOwned(user, idOrSlug);
    if (body.status && body.status !== 'draft') {
      const current = await this.loadDetail(owned.row, owned.header);
      assertHundredPercent(
        current.lines.map((line) => ({ percent: Number(line.percent) })),
        true,
      );
    }

    const orgId = activeOrg(user);
    const key = await this.cipher.keyFor(orgId);
    const header: FormulaHeaderSecret = { ...owned.header };
    if (body.name !== undefined) {
      header.name = body.name;
      header.slug = await this.allocateSlug(orgId, body.name, key.dek, owned.row.id);
    }
    if (body.description !== undefined) header.description = body.description;
    if (body.diluentLabel !== undefined) header.diluentLabel = body.diluentLabel;
    const sealed = this.cipher.sealHeader(orgId, owned.row.id, header, key.dek, key.version);

    const patch: Partial<typeof formulas.$inferInsert> = {
      headerSecret: sealed.secret,
      headerNonce: sealed.nonce,
      slugHmac: sealed.slugHmac,
      keyVersion: sealed.keyVersion,
      updatedAt: new Date(),
    };
    if (body.batchTargetGrams !== undefined) {
      patch.batchTargetGrams = body.batchTargetGrams.toString();
    }
    if (body.concentrationPct !== undefined) {
      patch.concentrationPct = body.concentrationPct.toString();
    }
    if (body.status !== undefined) patch.status = body.status;

    const [row] = await this.db
      .client()
      .update(formulas)
      .set(patch)
      .where(and(eq(formulas.id, owned.row.id), eq(formulas.orgId, orgId)))
      .returning();

    if (!row) throw new NotFoundException('Formula not found');
    await this.forgetCached(user, owned.row.id);
    return this.get(user, owned.row.id);
  }

  async replaceLines(user: JwtPayload, idOrSlug: string, body: ReplaceFormulaLinesBody) {
    const owned = await this.requireOwned(user, idOrSlug);
    assertHundredPercent(body.lines, owned.row.status !== 'draft');
    const orgId = activeOrg(user);
    const key = await this.cipher.keyFor(orgId);
    const db = this.db.client();
    await db.delete(formulaLines).where(eq(formulaLines.formulaId, owned.row.id));

    if (body.lines.length > 0) {
      await db.insert(formulaLines).values(
        body.lines.map((line, idx) => {
          const lineId = randomUUID();
          const secret = this.cipher.sealLine(
            orgId,
            lineId,
            lineSecret(line, idx),
            key.dek,
            key.version,
          );
          return {
            id: lineId,
            formulaId: owned.row.id,
            orgId,
            ownerId: user.sub,
            secret: secret.secret,
            nonce: secret.nonce,
            keyVersion: secret.keyVersion,
          };
        }),
      );
    }

    await db.update(formulas).set({ updatedAt: new Date() }).where(eq(formulas.id, owned.row.id));

    await this.forgetCached(user, owned.row.id);
    return this.get(user, owned.row.id);
  }

  async remove(user: JwtPayload, idOrSlug: string) {
    const owned = await this.requireOwned(user, idOrSlug);
    const [row] = await this.db
      .client()
      .delete(formulas)
      .where(and(eq(formulas.id, owned.row.id), eq(formulas.orgId, activeOrg(user))))
      .returning();
    if (!row) throw new NotFoundException('Formula not found');
    await this.forgetCached(user, owned.row.id);
    return { id: row.id, deleted: true };
  }

  private present(row: typeof formulas.$inferSelect, header: FormulaHeaderSecret) {
    return {
      id: row.id,
      orgId: row.orgId,
      ownerId: row.ownerId,
      name: header.name,
      slug: header.slug,
      description: header.description,
      diluentLabel: header.diluentLabel,
      version: row.version,
      batchTargetGrams: row.batchTargetGrams,
      concentrationPct: row.concentrationPct,
      status: row.status,
      isLibraryAccord: row.isLibraryAccord,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      keyVersion: row.keyVersion,
    };
  }

  private async resolveOwned(user: JwtPayload, idOrSlug: string) {
    const orgId = activeOrg(user);
    const isUuid = UUID_RE.test(idOrSlug);
    const key = await this.cipher.keyFor(orgId);
    const [row] = await this.db
      .client()
      .select()
      .from(formulas)
      .where(
        and(
          eq(formulas.orgId, orgId),
          isUuid ? eq(formulas.id, idOrSlug) : eq(formulas.slugHmac, slugHmac(key.dek, idOrSlug)),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('Formula not found');
    return {
      row,
      header: this.cipher.openHeader(key.dek, row),
      dek: key.dek,
      keyVersion: key.version,
    };
  }

  private async requireOwned(user: JwtPayload, idOrSlug: string) {
    return this.resolveOwned(user, idOrSlug);
  }

  private async allocateSlug(orgId: string, name: string, dek: Buffer, excludeId?: string) {
    const rows = await this.db.client().select().from(formulas).where(eq(formulas.orgId, orgId));
    const taken = new Set<string>();
    for (const row of rows) {
      if (excludeId && row.id === excludeId) continue;
      taken.add(this.cipher.openHeader(dek, row).slug);
    }
    return uniqueSlug(name, taken);
  }

  private async loadDetail(formula: typeof formulas.$inferSelect, header: FormulaHeaderSecret) {
    const key = await this.cipher.keyFor(formula.orgId);
    const stored = await this.db
      .client()
      .select()
      .from(formulaLines)
      .where(eq(formulaLines.formulaId, formula.id));
    const opened = stored
      .map((row) => ({
        id: row.id,
        formulaId: row.formulaId,
        ...this.cipher.openLine(key.dek, formula.orgId, row.id, row.secret, row.nonce),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const materialIds = [...new Set(opened.map((line) => line.materialId))];
    const materialRows =
      materialIds.length === 0
        ? []
        : await this.db
            .client()
            .select({
              id: materials.id,
              materialName: materials.name,
              manufacturer: materials.manufacturer,
              olfactoryFamily: materials.olfactoryFamily,
              materialPyramidNote: materials.pyramidNote,
              materialSlug: materials.slug,
              materialImageUrl: materials.imageUrl,
              costPerGram: materials.costPerGram,
              casNumber: materials.casNumber,
              allergenProfile: materials.allergenProfile,
              tenacityHours: materials.tenacityHours,
              ifraCat4MaxPercent: ifraLimits.maxPercent,
            })
            .from(materials)
            .leftJoin(ifraCategories, eq(ifraCategories.code, '4'))
            .leftJoin(
              ifraLimits,
              and(
                eq(ifraLimits.materialId, materials.id),
                eq(ifraLimits.categoryId, ifraCategories.id),
              ),
            )
            .where(inArray(materials.id, materialIds));
    const byId = new Map(materialRows.map((row) => [row.id, row]));

    return {
      ...this.present(formula, header),
      lines: opened.map((line) => {
        const material = byId.get(line.materialId);
        return {
          id: line.id,
          formulaId: line.formulaId,
          materialId: line.materialId,
          percent: String(line.percent),
          targetGrams: line.targetGrams == null ? null : String(line.targetGrams),
          weighedGrams: line.weighedGrams == null ? null : String(line.weighedGrams),
          stockConcentrationPct:
            line.stockConcentrationPct == null ? null : String(line.stockConcentrationPct),
          solvent: line.solvent,
          pyramidNote: line.pyramidNote ?? material?.materialPyramidNote ?? null,
          sortOrder: line.sortOrder,
          childFormulaId: line.childFormulaId,
          materialName: material?.materialName ?? 'Unavailable material',
          manufacturer: material?.manufacturer ?? null,
          olfactoryFamily: material?.olfactoryFamily ?? null,
          slug: material?.materialSlug ?? null,
          imageUrl: material?.materialImageUrl ?? null,
          costPerGram: material?.costPerGram ?? null,
          casNumber: material?.casNumber ?? null,
          allergenProfile: material?.allergenProfile ?? null,
          tenacityHours: material?.tenacityHours ?? null,
          ifraCat4MaxPercent: material?.ifraCat4MaxPercent ?? null,
        };
      }),
    };
  }

  private async forgetCached(user: JwtPayload, formulaId: string) {
    const org = activeOrg(user);
    await this.redis.cacheDel(
      this.redis.formulaDetailKey(user.sub, formulaId),
      this.redis.formulaDetailKey(org, formulaId),
      this.redis.dashboardBriefingKey(user.sub, formulaId),
      this.redis.dashboardBriefingKey(org, formulaId),
    );
  }
}
