import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MAX_FORMULA_EXPORT,
  formulaWorkbookFilename,
  workbookTierFromEntitlements,
  type ExportFormulasBody,
  type FormulaWorkbookPayload,
  type WorkbookTier,
} from '@fc/shared';
import { eq, inArray } from 'drizzle-orm';
import JSZip from 'jszip';
import { DatabaseService } from '../../database/database.service';
import { ifraCategories, ifraLimits, materials, users } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { buildFormulaXlsxBuffer } from './formula-xlsx.builder';
import {
  assembleFormulaWorkbookPayload,
  type FormulaXlsxContext,
  type MaterialSnapshot,
} from './formula-xlsx.mapper';
import { FormulasService, type FormulaDetail } from './formulas.service';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const ZIP_MIME = 'application/zip';

export type FormulaExportFile = {
  buffer: Buffer;
  mime: string;
  filename: string;
};

@Injectable()
export class FormulaXlsxService {
  constructor(
    private readonly db: DatabaseService,
    private readonly formulas: FormulasService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async exportWorkbook(user: JwtPayload, body: ExportFormulasBody): Promise<FormulaExportFile> {
    const details = await this.resolveFormulas(user, body);
    const entitlements = await this.entitlements.resolve(user.sub);
    const tier = workbookTierFromEntitlements(entitlements.plan.slug, entitlements.features);
    const ctxBase = await this.loadContext(user, details);

    if (details.length === 1) {
      const formula = details[0]!;
      const payload = await assembleFormulaWorkbookPayload(formula, ctxBase);
      const buffer = await buildFormulaXlsxBuffer(payload, tier);
      return {
        buffer,
        mime: XLSX_MIME,
        filename: formulaWorkbookFilename(formula.slug || formula.name),
      };
    }

    const zip = new JSZip();
    const used = new Set<string>();
    for (const formula of details) {
      const payload = await assembleFormulaWorkbookPayload(formula, ctxBase);
      const buffer = await buildFormulaXlsxBuffer(payload, tier);
      zip.file(uniqueName(formulaWorkbookFilename(formula.slug || formula.name), used), buffer);
    }
    const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
    return { buffer, mime: ZIP_MIME, filename: 'formulas-export.zip' };
  }

  /** Exposed for tests — builds a single payload with the given context. */
  assemble(formula: FormulaDetail, ctx: FormulaXlsxContext): Promise<FormulaWorkbookPayload> {
    return assembleFormulaWorkbookPayload(formula, ctx);
  }

  workbookTier(planSlug: string, features: readonly string[]): WorkbookTier {
    return workbookTierFromEntitlements(planSlug, features);
  }

  private async resolveFormulas(
    user: JwtPayload,
    body: ExportFormulasBody,
  ): Promise<FormulaDetail[]> {
    if (body.all) {
      const list = await this.formulas.list(user);
      if (list.length === 0) {
        throw new BadRequestException('No formulas to export');
      }
      if (list.length > MAX_FORMULA_EXPORT) {
        throw new BadRequestException(`Export is limited to ${MAX_FORMULA_EXPORT} formulas`);
      }
      const details: FormulaDetail[] = [];
      for (const row of list) {
        details.push(await this.formulas.get(user, row.id));
      }
      return details;
    }

    const ids = [...new Set(body.formulaIds ?? [])];
    if (ids.length === 0) {
      throw new BadRequestException('Provide formulaIds or set all to true');
    }
    if (ids.length > MAX_FORMULA_EXPORT) {
      throw new BadRequestException(`Export is limited to ${MAX_FORMULA_EXPORT} formulas`);
    }
    const details: FormulaDetail[] = [];
    for (const id of ids) {
      details.push(await this.formulas.get(user, id));
    }
    if (details.length === 0) {
      throw new NotFoundException('Formula not found');
    }
    return details;
  }

  private async loadContext(
    user: JwtPayload,
    details: FormulaDetail[],
  ): Promise<FormulaXlsxContext> {
    const db = this.db.client();
    const [account] = await db
      .select({
        defaultIfraCategory: users.defaultIfraCategory,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1);

    const ifraCategory = Number(account?.defaultIfraCategory ?? 4) || 4;
    const { byId, byName } = await this.loadIfraLimits(ifraCategory);
    const materialsById = await this.loadMaterials(details);

    return {
      createdBy: account?.email || user.email,
      sourceInstance:
        (process.env.API_CORS_ORIGIN ?? 'fragrance-chemistry').split(',')[0]?.trim() ||
        'fragrance-chemistry',
      ifraCategory,
      ifraLimitsByMaterialId: byId,
      ifraLimitsByName: byName,
      materialsById,
      exportedAt: new Date(),
    };
  }

  private async loadIfraLimits(category: number) {
    const db = this.db.client();
    const [cat] = await db
      .select()
      .from(ifraCategories)
      .where(eq(ifraCategories.code, String(category)))
      .limit(1);

    const byId = new Map<string, number>();
    const byName = new Map<string, number>();
    if (!cat) return { byId, byName };

    const rows = await db
      .select({
        materialId: ifraLimits.materialId,
        maxPercent: ifraLimits.maxPercent,
        materialName: materials.name,
        allergenProfile: materials.allergenProfile,
      })
      .from(ifraLimits)
      .innerJoin(materials, eq(ifraLimits.materialId, materials.id))
      .where(eq(ifraLimits.categoryId, cat.id));

    for (const row of rows) {
      const max = Number(row.maxPercent);
      if (!Number.isFinite(max)) continue;
      byId.set(row.materialId, max);
      byName.set(row.materialName, max);
      const profile = row.allergenProfile as Record<string, unknown> | null;
      if (profile && typeof profile === 'object') {
        for (const key of Object.keys(profile)) {
          if (!byName.has(key)) byName.set(key, max);
        }
      }
    }
    return { byId, byName };
  }

  private async loadMaterials(details: FormulaDetail[]) {
    const ids = [
      ...new Set(details.flatMap((formula) => formula.lines.map((line) => line.materialId))),
    ];
    const map = new Map<string, MaterialSnapshot>();
    if (ids.length === 0) return map;
    const rows = await this.db
      .client()
      .select({
        id: materials.id,
        slug: materials.slug,
        name: materials.name,
        casNumber: materials.casNumber,
        ownerId: materials.ownerId,
        stockConcentrationPct: materials.stockConcentrationPct,
        solvent: materials.solvent,
        olfactoryFamily: materials.olfactoryFamily,
      })
      .from(materials)
      .where(inArray(materials.id, ids));
    for (const row of rows) map.set(row.id, row);
    return map;
  }
}

function uniqueName(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const stem = filename.replace(/\.xlsx$/i, '');
  let n = 2;
  let next = `${stem}-${n}.xlsx`;
  while (used.has(next)) {
    n += 1;
    next = `${stem}-${n}.xlsx`;
  }
  used.add(next);
  return next;
}
