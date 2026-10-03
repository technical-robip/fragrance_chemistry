import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { NotificationPayload } from '@fc/shared';
import { bytea } from './bytea';
import { materials } from './catalog';

export const labSchema = pgSchema('lab');

export const formulas = labSchema.table('formulas', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  /** User who created the formula. Access is org_id, not this column. */
  ownerId: uuid('owner_id').notNull(),
  headerSecret: bytea('header_secret').notNull(),
  headerNonce: bytea('header_nonce').notNull(),
  slugHmac: bytea('slug_hmac').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  batchTargetGrams: numeric('batch_target_grams', { precision: 14, scale: 4 })
    .notNull()
    .default('10'),
  concentrationPct: numeric('concentration_pct', { precision: 8, scale: 4 })
    .notNull()
    .default('20'),
  status: text('status').notNull().default('draft'),
  isLibraryAccord: boolean('is_library_accord').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const formulaVersions = labSchema.table('formula_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulaId: uuid('formula_id')
    .notNull()
    .references(() => formulas.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  version: integer('version').notNull(),
  snapshotSecret: bytea('snapshot_secret').notNull(),
  snapshotNonce: bytea('snapshot_nonce').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const formulaLines = labSchema.table('formula_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulaId: uuid('formula_id')
    .notNull()
    .references(() => formulas.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  secret: bytea('secret').notNull(),
  nonce: bytea('nonce').notNull(),
  keyVersion: integer('key_version').notNull().default(1),
});

export const formulaPublications = labSchema.table('formula_publications', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulaId: uuid('formula_id')
    .notNull()
    .references(() => formulas.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull(),
  token: text('token').notNull().unique(),
  status: text('status').notNull().default('published'),
  snapshot: jsonb('snapshot').$type<Record<string, unknown> | null>(),
  publishedBy: uuid('published_by'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const weighingSessions = labSchema.table('weighing_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  formulaId: uuid('formula_id')
    .notNull()
    .references(() => formulas.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('active'),
  currentLineId: uuid('current_line_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const inventoryItems = labSchema.table(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id),
    quantityGrams: numeric('quantity_grams', { precision: 14, scale: 4 }).notNull(),
    location: text('location'),
    kind: text('kind').notNull().default('material'),
    expiresAt: date('expires_at'),
    minQuantityGrams: numeric('min_quantity_grams', { precision: 14, scale: 4 }).default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgMaterialUidx: uniqueIndex('inventory_items_org_material_uidx').on(
      table.orgId,
      table.materialId,
    ),
  }),
);

export const inventoryEvents = labSchema.table('inventory_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  itemId: uuid('item_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  action: text('action').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evaluations = labSchema.table('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull(),
  ownerId: uuid('owner_id').notNull(),
  formulaId: uuid('formula_id')
    .notNull()
    .references(() => formulas.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  notes: text('notes'),
  macerationDay: integer('maceration_day'),
  t0Notes: text('t0_notes'),
  t30mNotes: text('t30m_notes'),
  t4hNotes: text('t4h_notes'),
  t24hNotes: text('t24h_notes'),
  clarity: text('clarity'),
  opalescence: text('opalescence'),
  solubility: text('solubility'),
  lineMarks: jsonb('line_marks').$type<
    Array<{
      lineId?: string;
      materialId: string;
      mark: 'ok' | 'weak' | 'strong' | 'harsh';
      timepoint?: 't0Notes' | 't30mNotes' | 't4hNotes' | 't24hNotes';
    }>
  >(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const macerationClocks = labSchema.table(
  'maceration_clocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    formulaId: uuid('formula_id')
      .notNull()
      .references(() => formulas.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgFormula: uniqueIndex('maceration_clocks_org_formula_unique').on(
      table.orgId,
      table.formulaId,
    ),
  }),
);

export const formulaNotificationMutes = labSchema.table(
  'formula_notification_mutes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    formulaId: uuid('formula_id')
      .notNull()
      .references(() => formulas.id, { onDelete: 'cascade' }),
    mutedAt: timestamp('muted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerFormula: uniqueIndex('formula_notification_mutes_owner_formula_unique').on(
      table.ownerId,
      table.formulaId,
    ),
  }),
);

export const notifications = labSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id').notNull(),
    formulaId: uuid('formula_id').references(() => formulas.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    checkpointKey: text('checkpoint_key'),
    status: text('status').notNull().default('open'),
    payload: jsonb('payload').$type<NotificationPayload>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp('read_at', { withTimezone: true }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => ({
    ownerDedupe: uniqueIndex('notifications_owner_dedupe_unique').on(
      table.ownerId,
      table.dedupeKey,
    ),
  }),
);
