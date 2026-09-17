import { Injectable } from '@nestjs/common';
import { CreateEvaluationBody } from '@fc/shared';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { evaluations } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';

@Injectable()
export class EvaluationsService {
  constructor(private readonly db: DatabaseService) {}

  list(user: JwtPayload) {
    return this.db.client().select().from(evaluations).where(eq(evaluations.ownerId, user.sub));
  }

  create(user: JwtPayload, body: CreateEvaluationBody) {
    return this.db
      .client()
      .insert(evaluations)
      .values({
        ownerId: user.sub,
        formulaId: body.formulaId,
        rating: body.rating,
        notes: body.notes,
      })
      .returning();
  }
}
