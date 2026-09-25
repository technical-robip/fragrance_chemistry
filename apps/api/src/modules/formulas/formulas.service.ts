import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateFormulaBody,
  ReplaceFormulaLinesBody,
  UpdateFormulaBody,
  uniqueSlug,
} from '@fc/shared';
import { and, asc, eq, ne } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  formulaLines,
  formulas,
  ifraCategories,
  ifraLimits,
  materials,
} from '../../database/schema';
import { FORMULA_DETAIL_CACHE_TTL_SEC, RedisService } from '../../redis/redis.service';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertHundredPercent(lines: { percent: number }[], required: boolean) {
  if (!required || lines.length === 0) return;
  const totalPercent = lines.reduce((sum, line) => sum + line.percent, 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new BadRequestException(`Formula lines must total 100% (got ${totalPercent})`);
  }
}

export type FormulaDetail = Awaited<ReturnType<FormulasService['loadDetail']>>;

@Injectable()
export class FormulasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly redis: RedisService,
  ) {}

  list(user: JwtPayload) {
    return this.db
      .client()
      .select()
      .from(formulas)
      .where(eq(formulas.ownerId, user.sub))
      .orderBy(asc(formulas.updatedAt))
      .then(async (rows) => {
        const missing = rows.filter((r) => !r.slug);
        if (missing.length === 0) return rows;
        for (const row of missing) {
          const slug = await this.allocateSlug(user.sub, row.name, row.id);
          await this.db.client().update(formulas).set({ slug }).where(eq(formulas.id, row.id));
          row.slug = slug;
        }
        return rows;
      });
  }

  async create(user: JwtPayload, body: CreateFormulaBody) {
    const status = body.status ?? 'draft';
    assertHundredPercent(body.lines, status !== 'draft');
    await this.entitlements.assertQuota(user.sub, 'maxFormulas');

    const slug = await this.allocateSlug(user.sub, body.name);
    const db = this.db.client();
    const [formula] = await db
      .insert(formulas)
      .values({
        ownerId: user.sub,
        name: body.name,
        slug,
        description: body.description,
        batchTargetGrams: body.batchTargetGrams?.toString(),
        concentrationPct: body.concentrationPct?.toString(),
        status,
        isLibraryAccord: body.isLibraryAccord ?? false,
      })
      .returning();
    if (!formula) throw new NotFoundException('Could not create formula');

    if (body.lines.length > 0) {
      await db.insert(formulaLines).values(
        body.lines.map((line, idx) => ({
          formulaId: formula.id,
          ownerId: user.sub,
          materialId: line.materialId,
          percent: line.percent.toString(),
          sortOrder: line.sortOrder ?? idx,
          pyramidNote: line.pyramidNote,
          weighedGrams: line.weighedGrams?.toString(),
          targetGrams: line.targetGrams?.toString(),
          childFormulaId: line.childFormulaId,
          stockConcentrationPct: line.stockConcentrationPct?.toString(),
          solvent: line.solvent,
        })),
      );
    }

    return this.get(user, formula.id);
  }

  async get(user: JwtPayload, idOrSlug: string) {
    const formula = await this.resolveOwned(user, idOrSlug);
    const cacheKey = this.redis.formulaDetailKey(user.sub, formula.id);
    const cached = await this.redis.cacheGet<FormulaDetail>(cacheKey);
    if (cached) return cached;

    const detail = await this.loadDetail(formula);
    await this.redis.cacheSet(cacheKey, detail, FORMULA_DETAIL_CACHE_TTL_SEC);
    return detail;
  }

  async update(user: JwtPayload, idOrSlug: string, body: UpdateFormulaBody) {
    const owned = await this.requireOwned(user, idOrSlug);
    if (body.status && body.status !== 'draft') {
      const current = await this.get(user, owned.id);
      assertHundredPercent(
        current.lines.map((l) => ({ percent: Number(l.percent) })),
        true,
      );
    }

    const patch: Partial<typeof formulas.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) {
      patch.name = body.name;
      patch.slug = await this.allocateSlug(user.sub, body.name, owned.id);
    }
    if (body.description !== undefined) patch.description = body.description;
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
      .where(and(eq(formulas.id, owned.id), eq(formulas.ownerId, user.sub)))
      .returning();

    if (!row) throw new NotFoundException('Formula not found');
    await this.invalidateDetail(user.sub, owned.id);
    return this.get(user, owned.id);
  }

  async replaceLines(user: JwtPayload, idOrSlug: string, body: ReplaceFormulaLinesBody) {
    const formula = await this.requireOwned(user, idOrSlug);
    assertHundredPercent(body.lines, formula.status !== 'draft');

    const db = this.db.client();
    await db.delete(formulaLines).where(eq(formulaLines.formulaId, formula.id));

    if (body.lines.length > 0) {
      await db.insert(formulaLines).values(
        body.lines.map((line, idx) => ({
          formulaId: formula.id,
          ownerId: user.sub,
          materialId: line.materialId,
          percent: line.percent.toString(),
          sortOrder: line.sortOrder ?? idx,
          pyramidNote: line.pyramidNote,
          weighedGrams: line.weighedGrams?.toString(),
          targetGrams: line.targetGrams?.toString(),
          childFormulaId: line.childFormulaId,
          stockConcentrationPct: line.stockConcentrationPct?.toString(),
          solvent: line.solvent,
        })),
      );
    }

    await db.update(formulas).set({ updatedAt: new Date() }).where(eq(formulas.id, formula.id));

    await this.invalidateDetail(user.sub, formula.id);
    return this.get(user, formula.id);
  }

  async remove(user: JwtPayload, idOrSlug: string) {
    const owned = await this.requireOwned(user, idOrSlug);
    const [row] = await this.db
      .client()
      .delete(formulas)
      .where(and(eq(formulas.id, owned.id), eq(formulas.ownerId, user.sub)))
      .returning();
    if (!row) throw new NotFoundException('Formula not found');
    await this.invalidateDetail(user.sub, owned.id);
    return { id: row.id, deleted: true };
  }

  /** Load formula header by UUID or slug (owner-scoped). Ensures slug exists. */
  private async resolveOwned(user: JwtPayload, idOrSlug: string) {
    const isUuid = UUID_RE.test(idOrSlug);
    const [formula] = await this.db
      .client()
      .select()
      .from(formulas)
      .where(
        and(
          eq(formulas.ownerId, user.sub),
          isUuid ? eq(formulas.id, idOrSlug) : eq(formulas.slug, idOrSlug),
        ),
      )
      .limit(1);
    if (!formula) throw new NotFoundException('Formula not found');

    if (!formula.slug) {
      const slug = await this.allocateSlug(user.sub, formula.name, formula.id);
      await this.db.client().update(formulas).set({ slug }).where(eq(formulas.id, formula.id));
      formula.slug = slug;
    }
    return formula;
  }

  private async requireOwned(user: JwtPayload, idOrSlug: string) {
    return this.resolveOwned(user, idOrSlug);
  }

  private async allocateSlug(ownerId: string, name: string, excludeId?: string) {
    const rows = await this.db
      .client()
      .select({ slug: formulas.slug, id: formulas.id })
      .from(formulas)
      .where(
        excludeId
          ? and(eq(formulas.ownerId, ownerId), ne(formulas.id, excludeId))
          : eq(formulas.ownerId, ownerId),
      );
    const taken = new Set(rows.map((r) => r.slug).filter((s): s is string => Boolean(s)));
    return uniqueSlug(name, taken);
  }

  private async loadDetail(formula: typeof formulas.$inferSelect) {
    const lines = await this.db
      .client()
      .select({
        id: formulaLines.id,
        formulaId: formulaLines.formulaId,
        materialId: formulaLines.materialId,
        percent: formulaLines.percent,
        targetGrams: formulaLines.targetGrams,
        weighedGrams: formulaLines.weighedGrams,
        stockConcentrationPct: formulaLines.stockConcentrationPct,
        solvent: formulaLines.solvent,
        pyramidNote: formulaLines.pyramidNote,
        sortOrder: formulaLines.sortOrder,
        childFormulaId: formulaLines.childFormulaId,
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
      .from(formulaLines)
      .innerJoin(materials, eq(formulaLines.materialId, materials.id))
      .leftJoin(ifraCategories, eq(ifraCategories.code, '4'))
      .leftJoin(
        ifraLimits,
        and(eq(ifraLimits.materialId, materials.id), eq(ifraLimits.categoryId, ifraCategories.id)),
      )
      .where(eq(formulaLines.formulaId, formula.id))
      .orderBy(asc(formulaLines.sortOrder));

    return {
      ...formula,
      lines: lines.map((line) => ({
        ...line,
        pyramidNote: line.pyramidNote ?? line.materialPyramidNote,
        slug: line.materialSlug ?? null,
        imageUrl: line.materialImageUrl ?? null,
      })),
    };
  }

  private async parentFormulaIds(ownerId: string, childFormulaId: string) {
    const rows = await this.db
      .client()
      .select({ formulaId: formulaLines.formulaId })
      .from(formulaLines)
      .where(
        and(eq(formulaLines.ownerId, ownerId), eq(formulaLines.childFormulaId, childFormulaId)),
      );
    return [...new Set(rows.map((row) => row.formulaId))];
  }

  private cacheKeysForFormula(ownerId: string, formulaId: string) {
    return [
      this.redis.formulaDetailKey(ownerId, formulaId),
      this.redis.dashboardBriefingKey(ownerId, formulaId),
    ];
  }

  private async invalidateDetail(ownerId: string, formulaId: string) {
    const parentIds = await this.parentFormulaIds(ownerId, formulaId);
    return this.redis.cacheDel(
      ...this.cacheKeysForFormula(ownerId, formulaId),
      ...parentIds.flatMap((id) => this.cacheKeysForFormula(ownerId, id)),
    );
  }
}
