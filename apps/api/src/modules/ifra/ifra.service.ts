import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { ifraCategories, ifraLimits, materials } from '../../database/schema';

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

    return db
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
  }
}
