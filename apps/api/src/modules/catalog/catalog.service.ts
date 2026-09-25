import {
  CatalogIndexItem,
  CreateMaterialBody,
  filterCatalogIndex,
  ListMaterialsQuery,
  UpdateMaterialBody,
} from '@fc/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { inventoryItems, materials } from '../../database/schema';
import {
  CATALOG_PRIVATE_INDEX_TTL_SEC,
  CATALOG_PUBLIC_INDEX_TTL_SEC,
  RedisService,
} from '../../redis/redis.service';
import { JwtPayload } from '../auth/auth.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const indexColumns = {
  id: materials.id,
  ownerId: materials.ownerId,
  name: materials.name,
  casNumber: materials.casNumber,
  category: materials.category,
  origin: materials.origin,
  olfactoryFamily: materials.olfactoryFamily,
  pyramidNote: materials.pyramidNote,
  manufacturer: materials.manufacturer,
  costPerGram: materials.costPerGram,
  slug: materials.slug,
  imageUrl: materials.imageUrl,
  searchText: materials.searchText,
};

type IndexRow = {
  id: string;
  ownerId: string | null;
  name: string;
  casNumber: string | null;
  category: string | null;
  origin: string | null;
  olfactoryFamily: string | null;
  pyramidNote: string | null;
  manufacturer: string | null;
  costPerGram: string | null;
  slug: string | null;
  imageUrl: string | null;
  searchText: string | null;
};

function toIndexItem(row: IndexRow): CatalogIndexItem {
  return {
    id: row.id,
    name: row.name,
    casNumber: row.casNumber,
    category: row.category,
    origin: row.origin,
    olfactoryFamily: row.olfactoryFamily,
    pyramidNote: row.pyramidNote,
    manufacturer: row.manufacturer,
    costPerGram: row.costPerGram,
    slug: row.slug,
    imageUrl: row.imageUrl,
    searchText: row.searchText,
    isPrivate: Boolean(row.ownerId),
  };
}

function buildSearchText(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function toClientMaterial<T extends { ownerId?: string | null }>(row: T) {
  const { ownerId, ...rest } = row;
  return { ...rest, isPrivate: Boolean(ownerId) };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async list(user: JwtPayload, query: ListMaterialsQuery) {
    const [publicItems, privateItems] = await Promise.all([
      this.loadPublicIndex(),
      query.includePrivate
        ? this.loadPrivateIndex(user.sub)
        : Promise.resolve([] as CatalogIndexItem[]),
    ]);
    const merged = query.includePrivate ? [...privateItems, ...publicItems] : publicItems;
    const filtered = filterCatalogIndex(merged, query);
    return filtered.slice(query.offset, query.offset + query.limit);
  }

  async getByIdOrSlug(user: JwtPayload, idOrSlug: string) {
    const isUuid = UUID_RE.test(idOrSlug);
    const [row] = await this.db
      .client()
      .select()
      .from(materials)
      .where(isUuid ? eq(materials.id, idOrSlug) : eq(materials.slug, idOrSlug))
      .limit(1);
    if (!row) throw new NotFoundException('Material not found');

    const [stock] = await this.db
      .client()
      .select({
        quantityGrams: inventoryItems.quantityGrams,
        minQuantityGrams: inventoryItems.minQuantityGrams,
        location: inventoryItems.location,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.ownerId, user.sub), eq(inventoryItems.materialId, row.id)))
      .limit(1);

    return {
      ...toClientMaterial(row),
      ownedGrams: stock ? Number(stock.quantityGrams) : 0,
      minQuantityGrams: stock?.minQuantityGrams != null ? Number(stock.minQuantityGrams) : null,
      stockLocation: stock?.location ?? null,
    };
  }

  async create(user: JwtPayload, body: CreateMaterialBody) {
    const searchText = buildSearchText([
      body.name,
      body.casNumber,
      body.manufacturer,
      body.olfactoryFamily,
      body.pyramidNote,
      body.category,
      body.origin,
    ]);

    const [row] = await this.db
      .client()
      .insert(materials)
      .values({
        ownerId: user.sub,
        name: body.name,
        casNumber: body.casNumber,
        category: body.category,
        origin: body.origin,
        description: body.description,
        stockConcentrationPct: body.stockConcentrationPct.toString(),
        solvent: body.solvent,
        costPerGram: body.costPerGram.toString(),
        manufacturer: body.manufacturer,
        olfactoryFamily: body.olfactoryFamily,
        pyramidNote: body.pyramidNote,
        tenacityHours: body.tenacityHours != null ? body.tenacityHours.toString() : undefined,
        allergenProfile: body.allergenProfile ?? {},
        searchText,
      })
      .returning();
    if (!row) throw new NotFoundException('Could not create material');

    await this.invalidatePrivateIndex(user.sub);
    return toClientMaterial(row);
  }

  async update(user: JwtPayload, id: string, body: UpdateMaterialBody) {
    const existing = await this.requireOwned(user.sub, id);
    const nextName = body.name ?? existing.name;
    const nextCas = body.casNumber === undefined ? existing.casNumber : body.casNumber;
    const nextCategory = body.category ?? existing.category;
    const nextOrigin = body.origin ?? existing.origin;
    const nextManufacturer =
      body.manufacturer === undefined ? existing.manufacturer : body.manufacturer;
    const nextFamily =
      body.olfactoryFamily === undefined ? existing.olfactoryFamily : body.olfactoryFamily;
    const nextNote = body.pyramidNote ?? existing.pyramidNote;

    const [row] = await this.db
      .client()
      .update(materials)
      .set({
        name: nextName,
        casNumber: nextCas,
        category: nextCategory,
        origin: nextOrigin,
        description: body.description === undefined ? existing.description : body.description,
        stockConcentrationPct:
          body.stockConcentrationPct != null
            ? body.stockConcentrationPct.toString()
            : existing.stockConcentrationPct,
        solvent: body.solvent === undefined ? existing.solvent : body.solvent,
        costPerGram: body.costPerGram != null ? body.costPerGram.toString() : existing.costPerGram,
        manufacturer: nextManufacturer,
        olfactoryFamily: nextFamily,
        pyramidNote: nextNote,
        tenacityHours:
          body.tenacityHours === undefined
            ? existing.tenacityHours
            : body.tenacityHours == null
              ? null
              : body.tenacityHours.toString(),
        allergenProfile: body.allergenProfile ?? existing.allergenProfile,
        searchText: buildSearchText([
          nextName,
          nextCas,
          nextManufacturer,
          nextFamily,
          nextNote,
          nextCategory,
          nextOrigin,
        ]),
      })
      .where(and(eq(materials.id, id), eq(materials.ownerId, user.sub)))
      .returning();
    if (!row) throw new NotFoundException('Material not found');

    await this.invalidatePrivateIndex(user.sub);
    return toClientMaterial(row);
  }

  async remove(user: JwtPayload, id: string) {
    await this.requireOwned(user.sub, id);
    const [row] = await this.db
      .client()
      .delete(materials)
      .where(and(eq(materials.id, id), eq(materials.ownerId, user.sub)))
      .returning();
    if (!row) throw new NotFoundException('Material not found');
    await this.invalidatePrivateIndex(user.sub);
    return toClientMaterial(row);
  }

  count() {
    return this.db
      .client()
      .select({ count: sql<number>`count(*)::int` })
      .from(materials)
      .where(isNull(materials.ownerId));
  }

  static imagePathForSlug(slug: string) {
    return `/media/materials/art/${slug}.svg`;
  }

  private async loadPublicIndex(): Promise<CatalogIndexItem[]> {
    const key = this.redis.catalogPublicIndexKey();
    const cached = await this.redis.cacheGet<CatalogIndexItem[]>(key);
    if (cached) return cached;

    const rows = await this.db
      .client()
      .select(indexColumns)
      .from(materials)
      .where(isNull(materials.ownerId));
    const items = rows.map(toIndexItem);
    await this.redis.cacheSet(key, items, CATALOG_PUBLIC_INDEX_TTL_SEC);
    return items;
  }

  private async loadPrivateIndex(userId: string): Promise<CatalogIndexItem[]> {
    const key = this.redis.catalogPrivateIndexKey(userId);
    const cached = await this.redis.cacheGet<CatalogIndexItem[]>(key);
    if (cached) return cached;

    const rows = await this.db
      .client()
      .select(indexColumns)
      .from(materials)
      .where(eq(materials.ownerId, userId));
    const items = rows.map(toIndexItem);
    await this.redis.cacheSet(key, items, CATALOG_PRIVATE_INDEX_TTL_SEC);
    return items;
  }

  private invalidatePrivateIndex(userId: string) {
    return this.redis.cacheDel(this.redis.catalogPrivateIndexKey(userId));
  }

  private async requireOwned(userId: string, id: string) {
    const [row] = await this.db
      .client()
      .select()
      .from(materials)
      .where(and(eq(materials.id, id), eq(materials.ownerId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException('Material not found');
    return row;
  }
}
