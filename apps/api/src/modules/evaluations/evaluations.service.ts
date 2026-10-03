import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CreateEvaluationBody, UpdateEvaluationBody, joinEvaluationNotes } from '@fc/shared';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { evaluations, formulas } from '../../database/schema';
import { FormulaCipherService } from '../../crypto/formula-cipher.service';
import { RedisService } from '../../redis/redis.service';
import { activeOrg, JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { NotificationsService } from '../notifications/notifications.service';

const evaluationSelect = {
  id: evaluations.id,
  ownerId: evaluations.ownerId,
  orgId: evaluations.orgId,
  formulaId: evaluations.formulaId,
  formulaRowId: formulas.id,
  formulaOrgId: formulas.orgId,
  headerSecret: formulas.headerSecret,
  headerNonce: formulas.headerNonce,
  rating: evaluations.rating,
  notes: evaluations.notes,
  macerationDay: evaluations.macerationDay,
  t0Notes: evaluations.t0Notes,
  t30mNotes: evaluations.t30mNotes,
  t4hNotes: evaluations.t4hNotes,
  t24hNotes: evaluations.t24hNotes,
  clarity: evaluations.clarity,
  opalescence: evaluations.opalescence,
  solubility: evaluations.solubility,
  lineMarks: evaluations.lineMarks,
  createdAt: evaluations.createdAt,
};

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
    private readonly redis: RedisService,
    private readonly cipher: FormulaCipherService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

  async list(user: JwtPayload, formulaId?: string) {
    const orgId = activeOrg(user);
    const db = this.db.client();
    const base = db
      .select(evaluationSelect)
      .from(evaluations)
      .innerJoin(formulas, eq(evaluations.formulaId, formulas.id))
      .orderBy(desc(evaluations.createdAt));

    const rows = formulaId
      ? await base.where(and(eq(evaluations.orgId, orgId), eq(evaluations.formulaId, formulaId)))
      : await base.where(eq(evaluations.orgId, orgId));
    if (rows.length === 0) return [];
    const key = await this.cipher.keyFor(orgId);
    return rows.map((row) => {
      const header = this.cipher.openHeader(key.dek, {
        id: row.formulaRowId,
        orgId: row.formulaOrgId,
        headerSecret: row.headerSecret,
        headerNonce: row.headerNonce,
      });
      return {
        id: row.id,
        ownerId: row.ownerId,
        orgId: row.orgId,
        formulaId: row.formulaId,
        formulaName: header.name,
        rating: row.rating,
        notes: row.notes,
        macerationDay: row.macerationDay,
        t0Notes: row.t0Notes,
        t30mNotes: row.t30mNotes,
        t4hNotes: row.t4hNotes,
        t24hNotes: row.t24hNotes,
        clarity: row.clarity,
        opalescence: row.opalescence,
        solubility: row.solubility,
        lineMarks: row.lineMarks,
        createdAt: row.createdAt,
      };
    });
  }

  async create(user: JwtPayload, body: CreateEvaluationBody) {
    const formula = await this.requireFormula(user, body.formulaId);
    const existingId = await this.latestSittingId(
      activeOrg(user),
      body.formulaId,
      body.macerationDay,
    );
    if (existingId) {
      return this.update(user, existingId, body);
    }

    await this.entitlements.assertQuota(user.sub, 'maxEvaluations', activeOrg(user));
    const [row] = await this.db
      .client()
      .insert(evaluations)
      .values({
        orgId: activeOrg(user),
        ownerId: user.sub,
        formulaId: body.formulaId,
        rating: body.rating,
        notes: body.notes ?? joinEvaluationNotes(body, body.macerationDay),
        macerationDay: body.macerationDay,
        t0Notes: body.t0Notes,
        t30mNotes: body.t30mNotes,
        t4hNotes: body.t4hNotes,
        t24hNotes: body.t24hNotes,
        clarity: body.clarity,
        opalescence: body.opalescence,
        solubility: body.solubility,
        lineMarks: body.lineMarks,
      })
      .returning();

    await this.redis.cacheDel(this.redis.dashboardBriefingKey(user.sub, body.formulaId));
    await this.notifications?.onEvaluationSaved(
      user.sub,
      body.formulaId,
      body.macerationDay,
      activeOrg(user),
    );

    return {
      ...row,
      formulaName: formula.name,
    };
  }

  async update(user: JwtPayload, id: string, body: UpdateEvaluationBody) {
    const [existing] = await this.db
      .client()
      .select()
      .from(evaluations)
      .where(and(eq(evaluations.id, id), eq(evaluations.orgId, activeOrg(user))))
      .limit(1);
    if (!existing) throw new NotFoundException('Evaluation not found');

    const formula = await this.requireFormula(user, existing.formulaId);
    const day = body.macerationDay !== undefined ? body.macerationDay : existing.macerationDay;
    const nextNotes = {
      notes: body.notes !== undefined ? body.notes : existing.notes,
      t0Notes: body.t0Notes !== undefined ? body.t0Notes : existing.t0Notes,
      t30mNotes: body.t30mNotes !== undefined ? body.t30mNotes : existing.t30mNotes,
      t4hNotes: body.t4hNotes !== undefined ? body.t4hNotes : existing.t4hNotes,
      t24hNotes: body.t24hNotes !== undefined ? body.t24hNotes : existing.t24hNotes,
    };

    const [row] = await this.db
      .client()
      .update(evaluations)
      .set({
        rating: body.rating ?? existing.rating,
        notes: body.notes ?? joinEvaluationNotes(nextNotes, day),
        macerationDay:
          body.macerationDay !== undefined ? body.macerationDay : existing.macerationDay,
        t0Notes: nextNotes.t0Notes,
        t30mNotes: nextNotes.t30mNotes,
        t4hNotes: nextNotes.t4hNotes,
        t24hNotes: nextNotes.t24hNotes,
        clarity: body.clarity !== undefined ? body.clarity : existing.clarity,
        opalescence: body.opalescence !== undefined ? body.opalescence : existing.opalescence,
        solubility: body.solubility !== undefined ? body.solubility : existing.solubility,
        lineMarks: body.lineMarks !== undefined ? body.lineMarks : existing.lineMarks,
      })
      .where(eq(evaluations.id, existing.id))
      .returning();

    await this.redis.cacheDel(this.redis.dashboardBriefingKey(user.sub, existing.formulaId));
    await this.notifications?.onEvaluationSaved(user.sub, existing.formulaId, day);

    return {
      ...row,
      formulaName: formula.name,
    };
  }

  private async requireFormula(user: JwtPayload, formulaId: string) {
    const [formula] = await this.db
      .client()
      .select()
      .from(formulas)
      .where(and(eq(formulas.id, formulaId), eq(formulas.orgId, activeOrg(user))))
      .limit(1);
    if (!formula) throw new NotFoundException('Formula not found');
    const key = await this.cipher.keyFor(formula.orgId);
    const header = this.cipher.openHeader(key.dek, formula);
    return { ...formula, name: header.name };
  }

  private async latestSittingId(
    orgId: string,
    formulaId: string,
    macerationDay: number | undefined,
  ) {
    if (macerationDay == null) return null;
    const [row] = await this.db
      .client()
      .select({ id: evaluations.id })
      .from(evaluations)
      .where(
        and(
          eq(evaluations.orgId, orgId),
          eq(evaluations.formulaId, formulaId),
          eq(evaluations.macerationDay, macerationDay),
        ),
      )
      .orderBy(desc(evaluations.createdAt))
      .limit(1);
    return row?.id ?? null;
  }
}
