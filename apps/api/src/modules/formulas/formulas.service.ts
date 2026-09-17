import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFormulaBody } from '@fc/shared';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { formulaLines, formulas } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';

@Injectable()
export class FormulasService {
  constructor(private readonly db: DatabaseService) {}

  list(user: JwtPayload) {
    return this.db.client().select().from(formulas).where(eq(formulas.ownerId, user.sub));
  }

  async create(user: JwtPayload, body: CreateFormulaBody) {
    const totalPercent = body.lines.reduce((sum, line) => sum + line.percent, 0);
    if (Math.abs(totalPercent - 100) > 0.01) {
      throw new BadRequestException(`Formula lines must total 100% (got ${totalPercent})`);
    }
    const db = this.db.client();
    const [formula] = await db
      .insert(formulas)
      .values({
        ownerId: user.sub,
        name: body.name,
        description: body.description,
      })
      .returning();
    if (!formula) throw new NotFoundException('Could not create formula');

    const lines = body.lines.map((line, idx) => ({
      formulaId: formula.id,
      ownerId: user.sub,
      materialId: line.materialId,
      percent: line.percent.toString(),
      sortOrder: line.sortOrder ?? idx,
    }));
    await db.insert(formulaLines).values(lines);
    return formula;
  }

  async get(user: JwtPayload, id: string) {
    const [formula] = await this.db
      .client()
      .select()
      .from(formulas)
      .where(eq(formulas.id, id))
      .limit(1);
    if (!formula) throw new NotFoundException('Formula not found');
    const lines = await this.db
      .client()
      .select()
      .from(formulaLines)
      .where(eq(formulaLines.formulaId, id));
    return { ...formula, lines };
  }
}
