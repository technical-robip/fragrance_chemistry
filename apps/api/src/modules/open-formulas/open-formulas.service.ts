import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { formulaPublications, users } from '../../database/schema';
import { activeOrg, type JwtPayload } from '../auth/auth.types';
import { FormulasService } from '../formulas/formulas.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { openFormulaView, type OpenFormulaView, type PublishedSnapshot } from './publication-view';

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class OpenFormulasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly formulas: FormulasService,
    private readonly orgs: OrganizationsService,
  ) {}

  async listPublic() {
    const rows = await this.db.db
      .select({
        token: formulaPublications.token,
        snapshot: formulaPublications.snapshot,
        publishedAt: formulaPublications.publishedAt,
        authorName: users.displayName,
      })
      .from(formulaPublications)
      .leftJoin(users, eq(users.id, formulaPublications.publishedBy))
      .where(eq(formulaPublications.status, 'published'))
      .orderBy(desc(formulaPublications.publishedAt))
      .limit(100);
    return rows.flatMap((row) => {
      const snapshot = row.snapshot as PublishedSnapshot | null;
      if (!snapshot) return [];
      return [
        {
          token: row.token,
          name: snapshot.name,
          description: snapshot.description,
          authorName: row.authorName,
          publishedAt: iso(row.publishedAt),
        },
      ];
    });
  }

  async readPublic(token: string, viewer: JwtPayload | null): Promise<OpenFormulaView> {
    const row = await this.findByToken(token);
    if (!row) throw new NotFoundException('Formula not found');
    const canRepublish = viewer ? await this.viewerCanRepublish(viewer, row.orgId) : false;
    const formulaUpdated =
      viewer && canRepublish ? await this.updatedAt(viewer, row.formulaId) : null;
    return openFormulaView(
      {
        token: row.token,
        status: row.status,
        snapshot: (row.snapshot as PublishedSnapshot | null) ?? null,
        publishedAt: iso(row.publishedAt),
        authorName: row.authorName,
        stale: Boolean(
          formulaUpdated &&
          row.publishedAt &&
          formulaUpdated.getTime() > new Date(row.publishedAt).getTime(),
        ),
      },
      canRepublish,
    );
  }

  async statusForFormula(user: JwtPayload, formulaId: string) {
    const formula = await this.formulas.get(user, formulaId);
    const [row] = await this.db
      .client()
      .select()
      .from(formulaPublications)
      .where(
        and(
          eq(formulaPublications.formulaId, formula.id),
          eq(formulaPublications.orgId, activeOrg(user)),
        ),
      )
      .limit(1);
    if (!row || row.status !== 'published' || !row.snapshot) {
      return {
        state: row?.status === 'withdrawn' ? ('withdrawn' as const) : ('unpublished' as const),
        token: row?.token ?? null,
        stale: false,
      };
    }
    const publishedAt = row.publishedAt ? new Date(row.publishedAt) : null;
    const updatedAt = new Date(formula.updatedAt);
    return {
      state: 'published' as const,
      token: row.token,
      publishedAt: iso(row.publishedAt),
      stale: Boolean(publishedAt && updatedAt.getTime() > publishedAt.getTime()),
    };
  }

  async publish(user: JwtPayload, formulaId: string) {
    const formula = await this.formulas.get(user, formulaId);
    const snapshot: PublishedSnapshot = {
      name: formula.name,
      description: formula.description,
      lines: formula.lines.map((line) => ({
        materialId: line.materialId,
        materialName: line.materialName,
        percent: Number(line.percent),
        pyramidNote: line.pyramidNote,
        solvent: line.solvent,
        stockConcentrationPct:
          line.stockConcentrationPct == null ? null : Number(line.stockConcentrationPct),
        sortOrder: line.sortOrder,
      })),
    };
    const orgId = activeOrg(user);
    const db = this.db.client();
    const [existing] = await db
      .select()
      .from(formulaPublications)
      .where(eq(formulaPublications.formulaId, formula.id))
      .limit(1);
    const now = new Date();
    if (!existing) {
      const token = randomBytes(18).toString('base64url');
      await db.insert(formulaPublications).values({
        formulaId: formula.id,
        orgId,
        token,
        status: 'published',
        snapshot,
        publishedBy: user.sub,
        publishedAt: now,
        withdrawnAt: null,
        updatedAt: now,
      });
      return { token, state: 'published' as const };
    }
    await db
      .update(formulaPublications)
      .set({
        status: 'published',
        snapshot,
        publishedBy: user.sub,
        publishedAt: now,
        withdrawnAt: null,
        updatedAt: now,
      })
      .where(eq(formulaPublications.id, existing.id));
    return { token: existing.token, state: 'published' as const };
  }

  async withdraw(user: JwtPayload, formulaId: string) {
    const formula = await this.formulas.get(user, formulaId);
    const [existing] = await this.db
      .client()
      .select()
      .from(formulaPublications)
      .where(eq(formulaPublications.formulaId, formula.id))
      .limit(1);
    if (!existing) throw new NotFoundException('This formula is not shared');
    const now = new Date();
    await this.db
      .client()
      .update(formulaPublications)
      .set({
        status: 'withdrawn',
        snapshot: null,
        withdrawnAt: now,
        updatedAt: now,
      })
      .where(eq(formulaPublications.id, existing.id));
    return { token: existing.token, state: 'withdrawn' as const };
  }

  async clone(user: JwtPayload, token: string) {
    const row = await this.findByToken(token);
    if (!row || row.status !== 'published' || !row.snapshot) {
      throw new NotFoundException('This formula is no longer shared');
    }
    const snapshot = row.snapshot as PublishedSnapshot;
    const created = await this.formulas.create(user, {
      name: snapshot.name,
      description: snapshot.description ?? undefined,
      status: 'draft',
      lines: snapshot.lines.map((line) => ({
        materialId: line.materialId,
        percent: line.percent,
        pyramidNote: (line.pyramidNote ?? undefined) as
          'top' | 'middle' | 'base' | 'modifier' | undefined,
        solvent: line.solvent ?? undefined,
        stockConcentrationPct: line.stockConcentrationPct ?? undefined,
        sortOrder: line.sortOrder,
      })),
    });
    return { id: created.id, slug: created.slug };
  }

  private async findByToken(token: string) {
    const [row] = await this.db.db
      .select({
        id: formulaPublications.id,
        formulaId: formulaPublications.formulaId,
        orgId: formulaPublications.orgId,
        token: formulaPublications.token,
        status: formulaPublications.status,
        snapshot: formulaPublications.snapshot,
        publishedAt: formulaPublications.publishedAt,
        authorName: users.displayName,
      })
      .from(formulaPublications)
      .leftJoin(users, eq(users.id, formulaPublications.publishedBy))
      .where(eq(formulaPublications.token, token))
      .limit(1);
    return row ?? null;
  }

  private async viewerCanRepublish(viewer: JwtPayload, orgId: string) {
    try {
      await this.orgs.profile(viewer.sub, orgId);
      return true;
    } catch {
      return false;
    }
  }

  private async updatedAt(viewer: JwtPayload, formulaId: string) {
    try {
      const formula = await this.formulas.get(viewer, formulaId);
      return new Date(formula.updatedAt);
    } catch {
      return null;
    }
  }
}
