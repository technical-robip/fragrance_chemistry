import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  ifraCategories,
  ifraLimits,
  ifraStandardCas,
  ifraStandardLimits,
  ifraStandards,
  materialIfraStandards,
  materials,
} from '../../database/schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class IfraService {
  constructor(private readonly db: DatabaseService) {}

  listCategories() {
    return this.db.client().select().from(ifraCategories);
  }

  async limitsForMaterial(idOrSlug: string) {
    const db = this.db.client();
    const isUuid = UUID_RE.test(idOrSlug);
    const [material] = await db
      .select({ id: materials.id })
      .from(materials)
      .where(isUuid ? eq(materials.id, idOrSlug) : eq(materials.slug, idOrSlug))
      .limit(1);
    if (!material) throw new NotFoundException('Material not found');

    const limits = await db
      .select({
        id: ifraLimits.id,
        maxPercent: ifraLimits.maxPercent,
        categoryCode: ifraCategories.code,
        categoryLabel: ifraCategories.label,
        materialName: materials.name,
      })
      .from(ifraLimits)
      .innerJoin(ifraCategories, eq(ifraLimits.categoryId, ifraCategories.id))
      .innerJoin(materials, eq(ifraLimits.materialId, materials.id))
      .where(eq(ifraLimits.materialId, material.id));

    const linked = await db
      .select({
        id: ifraStandards.id,
        code: ifraStandards.code,
        name: ifraStandards.name,
        amendment: ifraStandards.amendment,
        standardType: ifraStandards.standardType,
        riskDrivers: ifraStandards.riskDrivers,
        deadlineExisting: ifraStandards.deadlineExisting,
        deadlineNew: ifraStandards.deadlineNew,
        synonyms: ifraStandards.synonyms,
        flavorNote: ifraStandards.flavorNote,
        phototoxicityNote: ifraStandards.phototoxicityNote,
        restrictionNote: ifraStandards.restrictionNote,
        specificationNote: ifraStandards.specificationNote,
        otherSources: ifraStandards.otherSources,
        otherSourcesNote: ifraStandards.otherSourcesNote,
      })
      .from(materialIfraStandards)
      .innerJoin(ifraStandards, eq(materialIfraStandards.standardId, ifraStandards.id))
      .where(eq(materialIfraStandards.materialId, material.id));

    const standardIds = linked.map((row) => row.id);
    const casRows = standardIds.length
      ? await db
          .select({
            standardId: ifraStandardCas.standardId,
            casNumber: ifraStandardCas.casNumber,
            isPrimary: ifraStandardCas.isPrimary,
          })
          .from(ifraStandardCas)
          .where(inArray(ifraStandardCas.standardId, standardIds))
      : [];
    const gridRows = standardIds.length
      ? await db
          .select({
            standardId: ifraStandardLimits.standardId,
            categoryCode: ifraStandardLimits.categoryCode,
            maxPercent: ifraStandardLimits.maxPercent,
            unrestricted: ifraStandardLimits.unrestricted,
          })
          .from(ifraStandardLimits)
          .where(inArray(ifraStandardLimits.standardId, standardIds))
      : [];

    const standards = linked.map((row) => ({
      ...row,
      synonyms: Array.isArray(row.synonyms) ? row.synonyms.map(String) : [],
      casNumbers: casRows
        .filter((cas) => cas.standardId === row.id)
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((cas) => cas.casNumber),
      limits: gridRows
        .filter((limit) => limit.standardId === row.id)
        .map((limit) => ({
          categoryCode: limit.categoryCode,
          maxPercent: limit.maxPercent,
          unrestricted: limit.unrestricted,
        })),
    }));

    return { limits, standards };
  }
}
