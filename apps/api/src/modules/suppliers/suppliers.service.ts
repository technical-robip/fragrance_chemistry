import { Injectable } from '@nestjs/common';
import { CreateSupplierPriceBody } from '@fc/shared';
import { DatabaseService } from '../../database/database.service';
import { supplierPrices, suppliers } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  list() {
    return this.db.client().select().from(suppliers);
  }

  create(body: { name: string; website?: string; notes?: string }) {
    return this.db.client().insert(suppliers).values(body).returning();
  }

  async createPrice(user: JwtPayload, body: CreateSupplierPriceBody) {
    if (body.sponsored) {
      await this.entitlements.assertFeature(user.sub, 'sponsored_listings');
    }
    return this.db
      .client()
      .insert(supplierPrices)
      .values({
        supplierId: body.supplierId,
        materialId: body.materialId,
        pricePerGram: body.pricePerGram.toString(),
        currency: body.currency ?? 'USD',
        sponsored: body.sponsored ?? false,
      })
      .returning();
  }
}
