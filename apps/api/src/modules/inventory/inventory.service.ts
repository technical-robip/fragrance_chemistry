import { Injectable, NotFoundException } from '@nestjs/common';
import { AdjustInventoryBody, PatchInventoryBody, UpsertInventoryBody } from '@fc/shared';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { inventoryEvents, inventoryItems, materials } from '../../database/schema';
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

type StockSnap = {
  quantityGrams: string;
  kind: string;
  location: string | null;
  minQuantityGrams: string | null;
  expiresAt: string | null;
};

function snap(row: StockSnap) {
  return {
    quantityGrams: row.quantityGrams,
    kind: row.kind,
    location: row.location,
    minQuantityGrams: row.minQuantityGrams,
    expiresAt: row.expiresAt,
  };
}

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
      await this.record(user, existing.id, 'update', snap(existing), snap(row!));
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
    await this.record(user, row!.id, 'create', null, snap(row!));
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
    await this.record(user, id, 'update', snap(existing), snap(row!));
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
    await this.record(user, id, 'adjust', snap(existing), snap(row!));
    return this.getById(user, row!.id);
  }

  async remove(user: JwtPayload, id: string) {
    const [row] = await this.db
      .client()
      .delete(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.ownerId, user.sub)))
      .returning();
    if (!row) throw new NotFoundException('Inventory item not found');
    await this.record(user, row.id, 'delete', snap(row), null);
    return { id: row.id, deleted: true };
  }

  async listEvents(user: JwtPayload, id: string) {
    const db = this.db.client();
    const [owned] = await db
      .select({ id: inventoryItems.id })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.ownerId, user.sub)))
      .limit(1);
    if (!owned) throw new NotFoundException('Inventory item not found');
    return db
      .select({
        id: inventoryEvents.id,
        action: inventoryEvents.action,
        before: inventoryEvents.before,
        after: inventoryEvents.after,
        createdAt: inventoryEvents.createdAt,
      })
      .from(inventoryEvents)
      .where(and(eq(inventoryEvents.itemId, id), eq(inventoryEvents.ownerId, user.sub)))
      .orderBy(desc(inventoryEvents.createdAt))
      .limit(20);
  }

  private async record(
    user: JwtPayload,
    itemId: string,
    action: 'create' | 'update' | 'adjust' | 'delete',
    before: ReturnType<typeof snap> | null,
    after: ReturnType<typeof snap> | null,
  ) {
    await this.db.client().insert(inventoryEvents).values({
      ownerId: user.sub,
      itemId,
      actorId: user.sub,
      action,
      before,
      after,
    });
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
