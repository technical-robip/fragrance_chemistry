import { Injectable } from '@nestjs/common';
import { UpsertInventoryBody } from '@fc/shared';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { inventoryItems } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';

@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}

  list(user: JwtPayload) {
    return this.db
      .client()
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.ownerId, user.sub));
  }

  async upsert(user: JwtPayload, body: UpsertInventoryBody) {
    const db = this.db.client();
    const [existing] = await db
      .select()
      .from(inventoryItems)
      .where(
        and(eq(inventoryItems.ownerId, user.sub), eq(inventoryItems.materialId, body.materialId)),
      )
      .limit(1);

    if (existing) {
      const [row] = await db
        .update(inventoryItems)
        .set({
          quantityGrams: body.quantityGrams.toString(),
          location: body.location,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await db
      .insert(inventoryItems)
      .values({
        ownerId: user.sub,
        materialId: body.materialId,
        quantityGrams: body.quantityGrams.toString(),
        location: body.location,
      })
      .returning();
    return row;
  }
}
