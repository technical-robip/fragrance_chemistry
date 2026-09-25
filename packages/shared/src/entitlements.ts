import { z } from 'zod';

export const USER_ROLES = ['enthusiast', 'perfumer', 'supplier', 'admin'] as const;
export const SELF_ASSIGNABLE_ROLES = ['enthusiast', 'perfumer'] as const;
export const USER_STATUSES = ['active', 'disabled'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due', 'canceled'] as const;
export const APP_THEMES = ['dark', 'light'] as const;
export const APP_LOCALES = ['en', 'fr', 'it', 'es', 'de', 'ro'] as const;

export const FEATURE_KEYS = [
  'dashboard',
  'catalog',
  'workbench',
  'weighing',
  'costing',
  'inventory',
  'evaluation',
  'encyclopedia',
  'suppliers',
  'sponsored_listings',
  'pdf_export',
  'community_posts',
] as const;

export const QUOTA_KEYS = [
  'maxFormulas',
  'maxInventoryItems',
  'maxEvaluations',
  'maxWeighingSessions',
  'maxPdfExportsPerMonth',
] as const;

export const RESERVED_PLAN_SLUGS = ['free', 'pro', 'enterprise'] as const;

export const userRoleSchema = z.enum(USER_ROLES);
export const selfAssignableRoleSchema = z.enum(SELF_ASSIGNABLE_ROLES);
export const userStatusSchema = z.enum(USER_STATUSES);
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export const appThemeSchema = z.enum(APP_THEMES);
export const appLocaleSchema = z.enum(APP_LOCALES);
export const featureKeySchema = z.enum(FEATURE_KEYS);
export const quotaKeySchema = z.enum(QUOTA_KEYS);

export type UserRole = z.infer<typeof userRoleSchema>;
export type SelfAssignableRole = z.infer<typeof selfAssignableRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type AppTheme = z.infer<typeof appThemeSchema>;
export type AppLocale = z.infer<typeof appLocaleSchema>;
export type FeatureKey = z.infer<typeof featureKeySchema>;
export type QuotaKey = z.infer<typeof quotaKeySchema>;

export type QuotaMap = Record<QuotaKey, number | null>;
export type QuotaUsage = Record<QuotaKey, number>;
export type FeatureMap = Record<FeatureKey, boolean>;

export function emptyQuotaUsage(): QuotaUsage {
  return {
    maxFormulas: 0,
    maxInventoryItems: 0,
    maxEvaluations: 0,
    maxWeighingSessions: 0,
    maxPdfExportsPerMonth: 0,
  };
}

export function unlimitedQuotaMap(): QuotaMap {
  return {
    maxFormulas: null,
    maxInventoryItems: null,
    maxEvaluations: null,
    maxWeighingSessions: null,
    maxPdfExportsPerMonth: null,
  };
}

export function emptyFeatureMap(): FeatureMap {
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as FeatureMap;
}

export function featureMapFromList(features: readonly string[]): FeatureMap {
  const map = emptyFeatureMap();
  for (const key of features) {
    if (isFeatureKey(key)) map[key] = true;
  }
  return map;
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export function isQuotaKey(value: string): value is QuotaKey {
  return (QUOTA_KEYS as readonly string[]).includes(value);
}

export function mergeQuotaMaps(
  base: Partial<Record<string, number | null>> | null | undefined,
  overrides?: Partial<Record<string, number | null>> | null,
): QuotaMap {
  const out = unlimitedQuotaMap();
  if (base) {
    for (const [key, value] of Object.entries(base)) {
      if (isQuotaKey(key)) out[key] = value ?? null;
    }
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      if (isQuotaKey(key)) out[key] = value ?? null;
    }
  }
  return out;
}

export const PLAN_FEATURE_PRESETS: Record<(typeof RESERVED_PLAN_SLUGS)[number], FeatureKey[]> = {
  free: ['dashboard', 'catalog', 'workbench', 'inventory', 'encyclopedia'],
  pro: FEATURE_KEYS.filter((key) => key !== 'sponsored_listings'),
  enterprise: [...FEATURE_KEYS],
};

export const PLAN_QUOTA_PRESETS: Record<(typeof RESERVED_PLAN_SLUGS)[number], Partial<QuotaMap>> = {
  free: { maxFormulas: 3 },
  pro: {},
  enterprise: {},
};

export const planSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .min(2)
  .max(40);

export const quotaOverridesSchema = z
  .record(quotaKeySchema, z.number().int().min(0).nullable())
  .optional()
  .default({});

export type PlanSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type SubscriptionSummary = {
  id: string;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string | null;
  note: string | null;
};

export type EntitlementsDto = {
  plan: PlanSummary;
  subscription: SubscriptionSummary | null;
  features: FeatureKey[];
  quotas: QuotaMap;
  usage: QuotaUsage;
};
