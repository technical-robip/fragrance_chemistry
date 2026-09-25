import { Injectable, NotFoundException } from '@nestjs/common';
import { AdjustInventoryBody, PatchInventoryBody, UpsertInventoryBody } from '@fc/shared';
import { and, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { inventoryItems, materials } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

const inventorySelect = {
  id: inventoryItems.id,
  ownerId: inventoryItems.ownerId,
  materialId: inventoryItems.materialId,
  quantityGrams: inventoryItems.quantityGrams,
  location: inventoryItems.location,
  kind: inventoryItems.kind,
  expiresAt: inventoryItems.expiresAt,
  minQuantityGrams: inventoryItems.minQuantityGrams,
  updatedAt: inventoryItems.updatedAt,
  materialName: materials.name,
  manufacturer: materials.manufacturer,
  olfactoryFamily: materials.olfactoryFamily,
  costPerGram: materials.costPerGram,
  casNumber: materials.casNumber,
  slug: materials.slug,
  imageUrl: materials.imageUrl,
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  list(user: JwtPayload) {
    return this.db
      .client()
      .select(inventorySelect)
      .from(inventoryItems)
      .innerJoin(materials, eq(inventoryItems.materialId, materials.id))
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
      const nextQty = Math.max(0, Number(existing.quantityGrams) + body.quantityGrams);
      const [row] = await db
        .update(inventoryItems)
        .set({
          quantityGrams: nextQty.toString(),
          location: body.location ?? existing.location,
          kind: body.kind ?? existing.kind,
          minQuantityGrams:
            body.minQuantityGrams !== undefined
              ? body.minQuantityGrams.toString()
              : existing.minQuantityGrams,
          expiresAt: body.expiresAt === null ? null : (body.expiresAt ?? existing.expiresAt),
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, existing.id))
        .returning();
      return this.getById(user, row!.id);
    }

    await this.entitlements.assertQuota(user.sub, 'maxInventoryItems');

    const [row] = await db
      .insert(inventoryItems)
      .values({
        ownerId: user.sub,
        materialId: body.materialId,
        quantityGrams: body.quantityGrams.toString(),
        location: body.location,
        kind: body.kind ?? 'material',
        minQuantityGrams: body.minQuantityGrams?.toString() ?? '0',
        expiresAt: body.expiresAt ?? null,
      })
      .returning();
    return this.getById(user, row!.id);
  }

  async patch(user: JwtPayload, id: string, body: PatchInventoryBody) {
    const [existing] = await this.db
      .client()
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.ownerId, user.sub)))
      .limit(1);
    if (!existing) throw new NotFoundException('Inventory item not found');

    const [row] = await this.db
      .client()
      .update(inventoryItems)
      .set({
        quantityGrams:
          body.quantityGrams !== undefined ? body.quantityGrams.toString() : existing.quantityGrams,
        location: body.location !== undefined ? body.location : existing.location,
        kind: body.kind ?? existing.kind,
        minQuantityGrams:
          body.minQuantityGrams !== undefined
            ? body.minQuantityGrams.toString()
            : existing.minQuantityGrams,
        expiresAt: body.expiresAt === undefined ? existing.expiresAt : body.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();
    return this.getById(user, row!.id);
  }

  async adjust(user: JwtPayload, id: string, body: AdjustInventoryBody) {
    const [existing] = await this.db
      .client()
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.ownerId, user.sub)))
      .limit(1);
    if (!existing) throw new NotFoundException('Inventory item not found');

    const next = Math.max(0, Number(existing.quantityGrams) + body.deltaGrams);
    const [row] = await this.db
      .client()
      .update(inventoryItems)
      .set({
        quantityGrams: next.toString(),
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .returning();
    return this.getById(user, row!.id);
  }

  async remove(user: JwtPayload, id: string) {
    const [row] = await this.db
      .client()
      .delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.ownerId, user.sub)))
      .returning();
    if (!row) throw new NotFoundException('Inventory item not found');
    return { id: row.id, deleted: true };
  }

  private async getById(user: JwtPayload, id: string) {
    const [row] = await this.db
      .client()
      .select(inventorySelect)
      .from(inventoryItems)
      .innerJoin(materials, eq(inventoryItems.materialId, materials.id))
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.ownerId, user.sub)))
      .limit(1);
    if (!row) throw new NotFoundException('Inventory item not found');
    return row;
  }
}
