import { Injectable } from '@nestjs/common';
import { ilike, sql } from 'drizzle-orm';
import { CreateMaterialBody, ListMaterialsQuery } from '@fc/shared';
import { DatabaseService } from '../../database/database.service';
import { materials } from '../../database/schema';

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  list(query: ListMaterialsQuery) {
    const db = this.db.client();
    const base = db.select().from(materials);
    if (query.q) {
      return base
        .where(ilike(materials.name, `%${query.q}%`))
        .limit(query.limit)
        .offset(query.offset);
    }
    return base.limit(query.limit).offset(query.offset);
  }

  create(body: CreateMaterialBody) {
    return this.db
      .client()
      .insert(materials)
      .values({
        name: body.name,
        casNumber: body.casNumber,
        category: body.category,
        description: body.description,
        costPerGram: body.costPerGram?.toString(),
      })
      .returning();
  }

  count() {
    return this.db
      .client()
      .select({ count: sql<number>`count(*)::int` })
      .from(materials);
  }
}
