import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { suppliers } from '../../database/schema';

@Injectable()
export class SuppliersService {
  constructor(private readonly db: DatabaseService) {}

  list() {
    return this.db.client().select().from(suppliers);
  }

  create(body: { name: string; website?: string; notes?: string }) {
    return this.db.client().insert(suppliers).values(body).returning();
  }
}
