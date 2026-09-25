import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  emptyQuotaUsage,
  EntitlementsDto,
  FeatureKey,
  FEATURE_KEYS,
  featureMapFromList,
  mergeQuotaMaps,
  PLAN_FEATURE_PRESETS,
  PlanSummary,
  QuotaKey,
  QuotaMap,
  SubscriptionSummary,
} from '@fc/shared';
import { and, count, eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import {
  evaluations,
  formulas,
  inventoryItems,
  planFeatures,
  plans,
  planQuotas,
  subscriptions,
  users,
  weighingSessions,
} from '../../database/schema';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class EntitlementsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async provisionFreePlan(userId: string) {
    const [free] = await this.db.db.select().from(plans).where(eq(plans.slug, 'free')).limit(1);
    if (!free) return;
    const [existing] = await this.db.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .limit(1);
    if (existing) return;
    await this.db.db.insert(subscriptions).values({
      userId,
      planId: free.id,
      status: 'active',
    });
    await this.db.db
      .update(users)
      .set({ plan: free.slug, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async resolve(userId: string): Promise<EntitlementsDto> {
    const [user] = await this.db.db.select().from(users).where(eq(users.id, userId)).limit(1);
    const active = await this.loadActiveSubscription(userId);
    const planRow = active ? active.plan : await this.planBySlug(user?.plan ?? 'free');
    const plan = this.toPlanSummary(planRow ?? this.fallbackPlan(user?.plan ?? 'free'));
    const quotaRows = planRow
      ? await this.db.db.select().from(planQuotas).where(eq(planQuotas.planId, planRow.id))
      : [];
    const featureRows = planRow
      ? await this.db.db.select().from(planFeatures).where(eq(planFeatures.planId, planRow.id))
      : [];

    const baseQuotas: Partial<QuotaMap> = {};
    for (const row of quotaRows) {
      baseQuotas[row.quotaKey as QuotaKey] = row.limitValue;
    }
    const quotas = mergeQuotaMaps(baseQuotas, active?.subscription.quotaOverrides ?? undefined);

    let features: FeatureKey[];
    if (featureRows.length > 0) {
      features = featureRows
        .filter((row) => row.enabled)
        .map((row) => row.featureKey)
        .filter((key): key is FeatureKey => FEATURE_KEYS.includes(key as FeatureKey));
    } else {
      const slug = plan.slug as keyof typeof PLAN_FEATURE_PRESETS;
      features = PLAN_FEATURE_PRESETS[slug] ?? [...PLAN_FEATURE_PRESETS.free];
    }

    return {
      plan,
      subscription: active ? this.toSubscriptionSummary(active.subscription) : null,
      features,
      quotas,
      usage: await this.usage(userId),
    };
  }

  async assertFeature(userId: string, feature: FeatureKey) {
    const entitlements = await this.resolve(userId);
    if (!entitlements.features.includes(feature)) {
      throw new ForbiddenException(`Your plan does not include ${feature}`);
    }
  }

  async assertQuota(userId: string, quota: QuotaKey) {
    const entitlements = await this.resolve(userId);
    const limit = entitlements.quotas[quota];
    if (limit == null) return;
    const used = entitlements.usage[quota] ?? 0;
    if (used >= limit) {
      throw new ForbiddenException(`Quota reached for ${quota} (${used}/${limit})`);
    }
  }

  async incrementPdfExport(userId: string) {
    await this.assertFeature(userId, 'pdf_export');
    await this.assertQuota(userId, 'maxPdfExportsPerMonth');
    await this.redis.incrementPdfExportCount(userId);
  }

  featureMap(features: FeatureKey[]) {
    return featureMapFromList(features);
  }

  private async usage(userId: string) {
    const usage = emptyQuotaUsage();
    const db = this.db.client();

    const [formulaRow] = await db
      .select({ value: count() })
      .from(formulas)
      .where(eq(formulas.ownerId, userId));
    const [inventoryRow] = await db
      .select({ value: count() })
      .from(inventoryItems)
      .where(eq(inventoryItems.ownerId, userId));
    const [evalRow] = await db
      .select({ value: count() })
      .from(evaluations)
      .where(eq(evaluations.ownerId, userId));
    const [weighRow] = await db
      .select({ value: count() })
      .from(weighingSessions)
      .where(eq(weighingSessions.ownerId, userId));

    usage.maxFormulas = Number(formulaRow?.value ?? 0);
    usage.maxInventoryItems = Number(inventoryRow?.value ?? 0);
    usage.maxEvaluations = Number(evalRow?.value ?? 0);
    usage.maxWeighingSessions = Number(weighRow?.value ?? 0);
    usage.maxPdfExportsPerMonth = await this.redis.getPdfExportCount(userId);
    return usage;
  }

  private async loadActiveSubscription(userId: string) {
    const [row] = await this.db.db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .limit(1);
    return row ?? null;
  }

  private async planBySlug(slug: string) {
    const [row] = await this.db.db.select().from(plans).where(eq(plans.slug, slug)).limit(1);
    return row ?? null;
  }

  private toPlanSummary(plan: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
  }): PlanSummary {
    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      isActive: plan.isActive,
    };
  }

  private toSubscriptionSummary(row: {
    id: string;
    status: string;
    startsAt: Date;
    endsAt: Date | null;
    note: string | null;
  }): SubscriptionSummary {
    return {
      id: row.id,
      status: row.status as SubscriptionSummary['status'],
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt ? row.endsAt.toISOString() : null,
      note: row.note,
    };
  }

  private fallbackPlan(slug: string): PlanSummary {
    return {
      id: '00000000-0000-0000-0000-000000000000',
      slug,
      name: slug,
      description: null,
      isActive: true,
    };
  }
}
