import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { ifraCategories, ifraLimits, materials } from '../../database/schema';

@Injectable()
export class IfraService {
  constructor(private readonly db: DatabaseService) {}

  listCategories() {
    return this.db.client().select().from(ifraCategories);
  }

  async limitsForMaterial(materialId: string) {
    return this.db
      .client()
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
      .where(eq(ifraLimits.materialId, materialId));
  }
}
