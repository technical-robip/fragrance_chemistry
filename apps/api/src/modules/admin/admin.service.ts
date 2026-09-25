import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AdminAssignSubscriptionBody,
  AdminCreatePlanBody,
  AdminListUsersQuery,
  AdminPutFeaturesBody,
  AdminPutQuotasBody,
  AdminSetPasswordBody,
  AdminUpdatePlanBody,
  AdminUpdateUserBody,
  emptyFeatureMap,
  FEATURE_KEYS,
  FeatureKey,
  featureMapFromList,
  QUOTA_KEYS,
  QuotaKey,
  RESERVED_PLAN_SLUGS,
  unlimitedQuotaMap,
} from '@fc/shared';
import { and, asc, count, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { planFeatures, plans, planQuotas, subscriptions, users } from '../../database/schema';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async overview() {
    const db = this.db.db;
    const [userCount] = await db.select({ value: count() }).from(users);
    const [activeCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.status, 'active'));
    const [disabledCount] = await db
      .select({ value: count() })
      .from(users)
      .where(eq(users.status, 'disabled'));

    const byPlan = await db
      .select({ plan: users.plan, value: count() })
      .from(users)
      .groupBy(users.plan);

    const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const expiring = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        endsAt: subscriptions.endsAt,
        planName: plans.name,
        email: users.email,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .innerJoin(users, eq(subscriptions.userId, users.id))
      .where(
        and(
          eq(subscriptions.status, 'active'),
          sql`${subscriptions.endsAt} is not null and ${subscriptions.endsAt} <= ${soon}`,
        ),
      )
      .orderBy(asc(subscriptions.endsAt))
      .limit(20);

    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        plan: users.plan,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(8);

    return {
      users: {
        total: Number(userCount?.value ?? 0),
        active: Number(activeCount?.value ?? 0),
        disabled: Number(disabledCount?.value ?? 0),
      },
      byPlan: byPlan.map((row) => ({ plan: row.plan, count: Number(row.value) })),
      expiringSubscriptions: expiring,
      recentUsers,
    };
  }

  async listUsers(query: AdminListUsersQuery) {
    const filters = [];
    if (query.q) {
      const like = `%${query.q}%`;
      filters.push(or(ilike(users.email, like), ilike(users.displayName, like)));
    }
    if (query.role) filters.push(eq(users.role, query.role));
    if (query.status) filters.push(eq(users.status, query.status));
    if (query.plan) filters.push(eq(users.plan, query.plan));
    const where = filters.length ? and(...filters) : undefined;

    const db = this.db.db;
    const [totalRow] = await db.select({ value: count() }).from(users).where(where);
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        plan: users.plan,
        status: users.status,
        createdAt: users.createdAt,
        subscriptionStatus: subscriptions.status,
        planName: plans.name,
      })
      .from(users)
      .leftJoin(
        subscriptions,
        and(eq(subscriptions.userId, users.id), eq(subscriptions.status, 'active')),
      )
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    return {
      total: Number(totalRow?.value ?? 0),
      items: rows,
    };
  }

  async getUser(id: string) {
    const [row] = await this.db.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw new NotFoundException('User not found');
    const entitlements = await this.entitlements.resolve(id);
    return {
      user: {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        role: row.role,
        plan: row.plan,
        status: row.status,
        locale: row.locale,
        theme: row.theme,
        createdAt: row.createdAt,
      },
      entitlements,
    };
  }

  async updateUser(actor: JwtPayload, id: string, body: AdminUpdateUserBody) {
    const [target] = await this.db.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) throw new NotFoundException('User not found');

    if (body.email && body.email !== target.email) {
      const [taken] = await this.db.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, body.email), ne(users.id, id)))
        .limit(1);
      if (taken) throw new ConflictException('Email already registered');
    }

    const nextRole = body.role ?? target.role;
    const nextStatus = body.status ?? target.status;
    if (target.role === 'admin' && (nextRole !== 'admin' || nextStatus === 'disabled')) {
      if (target.id === actor.sub) {
        throw new ForbiddenException('You cannot demote or disable your own admin account');
      }
      await this.assertNotLastAdmin(target.id);
    }

    const [updated] = await this.db.db
      .update(users)
      .set({
        ...(body.displayName !== undefined ? { displayName: body.displayName } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    if (!updated) throw new NotFoundException('User not found');
    if (body.status === 'disabled') {
      await this.auth.logoutAll(id);
    }
    return this.getUser(id);
  }

  async setPassword(id: string, body: AdminSetPasswordBody) {
    const [target] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) throw new NotFoundException('User not found');
    const passwordHash = await argon2.hash(body.password);
    await this.db.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
    await this.auth.logoutAll(id);
    return { ok: true };
  }

  async logoutAll(id: string) {
    const [target] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) throw new NotFoundException('User not found');
    await this.auth.logoutAll(id);
    return { ok: true };
  }

  async assignSubscription(id: string, body: AdminAssignSubscriptionBody) {
    const [target] = await this.db.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) throw new NotFoundException('User not found');
    const [plan] = await this.db.db.select().from(plans).where(eq(plans.id, body.planId)).limit(1);
    if (!plan) throw new NotFoundException('Plan not found');

    await this.db.db
      .update(subscriptions)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(and(eq(subscriptions.userId, id), eq(subscriptions.status, 'active')));

    await this.db.db.insert(subscriptions).values({
      userId: id,
      planId: plan.id,
      status: body.status,
      startsAt: body.startsAt ?? new Date(),
      endsAt: body.endsAt === undefined ? null : body.endsAt,
      quotaOverrides: body.quotaOverrides ?? {},
      note: body.note ?? null,
    });

    if (body.status === 'active') {
      await this.db.db
        .update(users)
        .set({ plan: plan.slug, updatedAt: new Date() })
        .where(eq(users.id, id));
    }

    return this.getUser(id);
  }

  async listPlans() {
    const rows = await this.db.db
      .select()
      .from(plans)
      .orderBy(asc(plans.sortOrder), asc(plans.name));
    const counts = await this.db.db
      .select({ planId: subscriptions.planId, value: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.planId);
    const countMap = new Map(counts.map((row) => [row.planId, Number(row.value)]));
    return rows.map((row) => ({
      ...row,
      subscriberCount: countMap.get(row.id) ?? 0,
      reserved: (RESERVED_PLAN_SLUGS as readonly string[]).includes(row.slug),
    }));
  }

  async getPlan(id: string) {
    const [plan] = await this.db.db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!plan) throw new NotFoundException('Plan not found');
    const quotaRows = await this.db.db.select().from(planQuotas).where(eq(planQuotas.planId, id));
    const featureRows = await this.db.db
      .select()
      .from(planFeatures)
      .where(eq(planFeatures.planId, id));
    const quotas = unlimitedQuotaMap();
    for (const row of quotaRows) {
      if ((QUOTA_KEYS as readonly string[]).includes(row.quotaKey)) {
        quotas[row.quotaKey as QuotaKey] = row.limitValue;
      }
    }
    const features = emptyFeatureMap();
    for (const row of featureRows) {
      if ((FEATURE_KEYS as readonly string[]).includes(row.featureKey)) {
        features[row.featureKey as FeatureKey] = row.enabled;
      }
    }
    const [subs] = await this.db.db
      .select({ value: count() })
      .from(subscriptions)
      .where(and(eq(subscriptions.planId, id), eq(subscriptions.status, 'active')));
    return {
      ...plan,
      quotas,
      features: Object.keys(features).length ? features : featureMapFromList([]),
      subscriberCount: Number(subs?.value ?? 0),
      reserved: (RESERVED_PLAN_SLUGS as readonly string[]).includes(plan.slug),
    };
  }

  async createPlan(body: AdminCreatePlanBody) {
    const [existing] = await this.db.db
      .select()
      .from(plans)
      .where(eq(plans.slug, body.slug))
      .limit(1);
    if (existing) throw new ConflictException('Plan slug already exists');
    const [created] = await this.db.db
      .insert(plans)
      .values({
        slug: body.slug,
        name: body.name,
        description: body.description ?? null,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 100,
      })
      .returning();
    if (!created) throw new ConflictException('Could not create plan');
    await this.replaceQuotas(created.id, unlimitedQuotaMap());
    await this.replaceFeatures(created.id, emptyFeatureMap());
    return this.getPlan(created.id);
  }

  async updatePlan(id: string, body: AdminUpdatePlanBody) {
    const [plan] = await this.db.db.select().from(plans).where(eq(plans.id, id)).limit(1);
    if (!plan) throw new NotFoundException('Plan not found');
    if (
      body.slug &&
      body.slug !== plan.slug &&
      (RESERVED_PLAN_SLUGS as readonly string[]).includes(plan.slug)
    ) {
      throw new BadRequestException('Reserved plan slugs cannot be renamed');
    }
    if (body.slug && body.slug !== plan.slug) {
      const [taken] = await this.db.db
        .select()
        .from(plans)
        .where(eq(plans.slug, body.slug))
        .limit(1);
      if (taken) throw new ConflictException('Plan slug already exists');
    }
    const [updated] = await this.db.db
      .update(plans)
      .set({
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Plan not found');
    if (body.slug && body.slug !== plan.slug) {
      await this.db.db
        .update(users)
        .set({ plan: body.slug, updatedAt: new Date() })
        .where(eq(users.plan, plan.slug));
    }
    return this.getPlan(id);
  }

  async putQuotas(id: string, body: AdminPutQuotasBody) {
    await this.requirePlan(id);
    const next = unlimitedQuotaMap();
    for (const key of QUOTA_KEYS) {
      if (key in body.quotas) next[key] = body.quotas[key] ?? null;
    }
    await this.replaceQuotas(id, next);
    return this.getPlan(id);
  }

  async putFeatures(id: string, body: AdminPutFeaturesBody) {
    await this.requirePlan(id);
    const next = emptyFeatureMap();
    for (const key of FEATURE_KEYS) {
      if (key in body.features) next[key] = Boolean(body.features[key]);
    }
    await this.replaceFeatures(id, next);
    return this.getPlan(id);
  }

  private async replaceQuotas(planId: string, quotas: Record<QuotaKey, number | null>) {
    await this.db.db.delete(planQuotas).where(eq(planQuotas.planId, planId));
    await this.db.db.insert(planQuotas).values(
      QUOTA_KEYS.map((quotaKey) => ({
        planId,
        quotaKey,
        limitValue: quotas[quotaKey],
      })),
    );
  }

  private async replaceFeatures(planId: string, features: Record<FeatureKey, boolean>) {
    await this.db.db.delete(planFeatures).where(eq(planFeatures.planId, planId));
    await this.db.db.insert(planFeatures).values(
      FEATURE_KEYS.map((featureKey) => ({
        planId,
        featureKey,
        enabled: features[featureKey],
      })),
    );
  }

  private async requirePlan(id: string) {
    const [plan] = await this.db.db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.id, id))
      .limit(1);
    if (!plan) throw new NotFoundException('Plan not found');
  }

  private async assertNotLastAdmin(exceptUserId: string) {
    const [row] = await this.db.db
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.status, 'active'), ne(users.id, exceptUserId)));
    if (Number(row?.value ?? 0) === 0) {
      throw new ForbiddenException('Cannot remove the last active admin');
    }
  }
}
