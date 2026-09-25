import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { formulas, weighingSessions } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class WeighingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  list(user: JwtPayload) {
    return this.db
      .client()
      .select()
      .from(weighingSessions)
      .where(eq(weighingSessions.ownerId, user.sub))
      .orderBy(desc(weighingSessions.createdAt));
  }

  async create(user: JwtPayload, formulaId: string) {
    await this.entitlements.assertQuota(user.sub, 'maxWeighingSessions');
    const [formula] = await this.db
      .client()
      .select({ id: formulas.id })
      .from(formulas)
      .where(and(eq(formulas.id, formulaId), eq(formulas.ownerId, user.sub)))
      .limit(1);
    if (!formula) throw new NotFoundException('Formula not found');
    const [row] = await this.db
      .client()
      .insert(weighingSessions)
      .values({
        ownerId: user.sub,
        formulaId,
        status: 'active',
      })
      .returning();
    return row;
  }
}
