import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePostBody } from '@fc/shared';
import { desc, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { formulas, perfumes, posts } from '../../database/schema';
import { JwtPayload } from '../auth/auth.types';

@Injectable()
export class CommunityService {
  constructor(private readonly db: DatabaseService) {}

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
    return this.db.client().select().from(perfumes).orderBy(desc(perfumes.createdAt)).limit(100);
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

  /** Clone commercial pyramid structure into a skeleton lab formula. */
  async generateLabBrief(user: JwtPayload, perfumeId: string) {
    const perfume = await this.getPerfume(perfumeId);
    const pyramid = (perfume.pyramid ?? {}) as {
      top?: string[];
      heart?: string[];
      base?: string[];
    };
    const notes = [
      ...(pyramid.top ?? []).map((n) => `Top: ${n}`),
      ...(pyramid.heart ?? []).map((n) => `Heart: ${n}`),
      ...(pyramid.base ?? []).map((n) => `Base: ${n}`),
    ];
    const [created] = await this.db
      .client()
      .insert(formulas)
      .values({
        ownerId: user.sub,
        name: `Brief: ${perfume.name}`,
        description: `Lab brief from encyclopedia.\n${notes.join('\n')}`,
        status: 'draft',
        batchTargetGrams: '10',
        concentrationPct: '20',
      })
      .returning();
    return { perfume, formula: created };
  }
}
