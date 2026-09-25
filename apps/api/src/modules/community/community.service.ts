import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostBody } from '@fc/shared';
import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { formulaLines, formulas, materials, perfumes, posts, users } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class CommunityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly entitlements: EntitlementsService,
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
    const existingBriefs = await this.db
      .client()
      .select({ name: formulas.name })
      .from(formulas)
      .where(and(eq(formulas.ownerId, user.sub), ilike(formulas.name, `${baseName}%`)));
    const taken = new Set(existingBriefs.map((r) => r.name));
    let briefName = baseName;
    if (taken.has(briefName)) {
      let n = 2;
      while (taken.has(`${baseName} #${n}`)) n += 1;
      briefName = `${baseName} #${n}`;
    }

    await this.entitlements.assertQuota(user.sub, 'maxFormulas');

    const [prefs] = await this.db.db
      .select({
        defaultBatchTargetGrams: users.defaultBatchTargetGrams,
        defaultConcentrationPct: users.defaultConcentrationPct,
      })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1);

    const [created] = await this.db
      .client()
      .insert(formulas)
      .values({
        ownerId: user.sub,
        name: briefName,
        description: `Lab brief from encyclopedia.\n${notesText.join('\n')}`,
        status: 'draft',
        batchTargetGrams: prefs?.defaultBatchTargetGrams ?? '10',
        concentrationPct: prefs?.defaultConcentrationPct ?? '20',
      })
      .returning();
    if (!created) throw new NotFoundException('Could not create formula');

    const lineRows: Array<{
      formulaId: string;
      ownerId: string;
      materialId: string;
      percent: string;
      pyramidNote: string;
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
          formulaId: created.id,
          ownerId: user.sub,
          materialId: match.id,
          percent: perNote.toFixed(4),
          pyramidNote: tier.note,
          sortOrder: sortOrder++,
        });
      }
    }

    if (lineRows.length > 0) {
      await this.db.client().insert(formulaLines).values(lineRows);
    }

    return { perfume, formula: created, linesCreated: lineRows.length };
  }
}
