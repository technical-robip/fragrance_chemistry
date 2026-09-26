import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const coreSchema = pgSchema('core');

export const users = coreSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('enthusiast'),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  locale: text('locale').notNull().default('en'),
  theme: text('theme').notNull().default('dark'),
  defaultBatchTargetGrams: numeric('default_batch_target_grams', { precision: 14, scale: 4 })
    .notNull()
    .default('10'),
  defaultConcentrationPct: numeric('default_concentration_pct', { precision: 8, scale: 4 })
    .notNull()
    .default('20'),
  defaultIfraCategory: integer('default_ifra_category').notNull().default(4),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userNotificationPreferences = coreSchema.table('user_notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  evaluationEnabled: boolean('evaluation_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const plans = coreSchema.table('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(100),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const planQuotas = coreSchema.table(
  'plan_quotas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    quotaKey: text('quota_key').notNull(),
    limitValue: integer('limit_value'),
  },
  (table) => ({
    planQuotaUnique: uniqueIndex('plan_quotas_plan_key_unique').on(table.planId, table.quotaKey),
  }),
);

export const planFeatures = coreSchema.table(
  'plan_features',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    featureKey: text('feature_key').notNull(),
    enabled: boolean('enabled').notNull().default(false),
  },
  (table) => ({
    planFeatureUnique: uniqueIndex('plan_features_plan_key_unique').on(
      table.planId,
      table.featureKey,
    ),
  }),
);

export const subscriptions = coreSchema.table(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    quotaOverrides: jsonb('quota_overrides')
      .$type<Record<string, number | null>>()
      .notNull()
      .default({}),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oneActive: uniqueIndex('subscriptions_one_active_user')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
  }),
);
