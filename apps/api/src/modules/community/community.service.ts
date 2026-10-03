import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostBody } from '@fc/shared';
import { asc, desc, eq, ilike, or } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { materials, perfumes, posts, users } from '../../database/schema';
import { activeOrg, JwtPayload } from '../auth/auth.types';
import { FormulasService } from '../formulas/formulas.service';

@Injectable()
export class CommunityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly formulasSvc: FormulasService,
  ) {}

  feed() {
    return this.db.client().select().from(posts).orderBy(desc(posts.createdAt)).limit(50);
  }

  create(user: JwtPayload, body: CreatePostBody) {
    return this.db
      .client()
      .insert(posts)
      .values({
        authorId: user.sub,
        title: body.title,
        body: body.body,
      })
      .returning();
  }

  listPerfumes() {
    return this.db.client().select().from(perfumes).orderBy(asc(perfumes.name)).limit(100);
  }

  async getPerfume(id: string) {
    const [row] = await this.db
      .client()
      .select()
      .from(perfumes)
      .where(eq(perfumes.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Perfume not found');
    return row;
  }

  /** Clone commercial pyramid structure into a skeleton lab formula with matched materials. */
  async generateLabBrief(user: JwtPayload, perfumeId: string) {
    const perfume = await this.getPerfume(perfumeId);
    const pyramid = (perfume.pyramid ?? {}) as {
      top?: string[];
      heart?: string[];
      middle?: string[];
      base?: string[];
    };

    const tiers: Array<{ note: 'top' | 'middle' | 'base'; names: string[]; share: number }> = [
      { note: 'top', names: pyramid.top ?? [], share: 30 },
      { note: 'middle', names: [...(pyramid.heart ?? []), ...(pyramid.middle ?? [])], share: 40 },
      { note: 'base', names: pyramid.base ?? [], share: 30 },
    ];

    const notesText = tiers.flatMap((t) =>
      t.names.map(
        (n) =>
          `${t.note === 'middle' ? 'Heart' : t.note[0]!.toUpperCase() + t.note.slice(1)}: ${n}`,
      ),
    );

    const baseName = `Brief: ${perfume.name}`;
    const existingBriefs = await this.formulasSvc.list(user);
    const taken = new Set(
      existingBriefs.map((row) => row.name).filter((name) => name.startsWith(baseName)),
    );
    let briefName = baseName;
    if (taken.has(briefName)) {
      let n = 2;
      while (taken.has(`${baseName} #${n}`)) n += 1;
      briefName = `${baseName} #${n}`;
    }

    const [prefs] = await this.db.db
      .select({
        defaultBatchTargetGrams: users.defaultBatchTargetGrams,
        defaultConcentrationPct: users.defaultConcentrationPct,
      })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1);

    const lineRows: Array<{
      materialId: string;
      percent: number;
      pyramidNote: 'top' | 'middle' | 'base';
      sortOrder: number;
    }> = [];

    let sortOrder = 0;
    for (const tier of tiers) {
      if (tier.names.length === 0) continue;
      const perNote = tier.share / tier.names.length;
      for (const name of tier.names) {
        const [match] = await this.db
          .client()
          .select()
          .from(materials)
          .where(or(ilike(materials.name, `%${name}%`), ilike(materials.searchText, `%${name}%`)))
          .limit(1);
        if (!match) continue;
        lineRows.push({
          materialId: match.id,
          percent: Number(perNote.toFixed(4)),
          pyramidNote: tier.note,
          sortOrder: sortOrder++,
        });
      }
    }

    const created = await this.formulasSvc.create(
      { ...user, org: activeOrg(user) },
      {
        name: briefName,
        description: `Lab brief from encyclopedia.\n${notesText.join('\n')}`,
        status: 'draft',
        batchTargetGrams: Number(prefs?.defaultBatchTargetGrams ?? 10),
        concentrationPct: Number(prefs?.defaultConcentrationPct ?? 20),
        lines: lineRows,
      },
    );

    return { perfume, formula: created, linesCreated: lineRows.length };
  }
}
