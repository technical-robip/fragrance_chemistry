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
import { materials } from './catalog';

export const labSchema = pgSchema('lab');

export const formulas = labSchema.table('formulas', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug'),
  description: text('description'),
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
  ownerId: uuid('owner_id').notNull(),
  version: integer('version').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const formulaLines = labSchema.table('formula_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  formulaId: uuid('formula_id')
    .notNull()
    .references(() => formulas.id, { onDelete: 'cascade' }),
  ownerId: uuid('owner_id').notNull(),
  materialId: uuid('material_id')
    .notNull()
    .references(() => materials.id),
  percent: numeric('percent', { precision: 8, scale: 4 }).notNull(),
  targetGrams: numeric('target_grams', { precision: 14, scale: 6 }),
  weighedGrams: numeric('weighed_grams', { precision: 14, scale: 6 }),
  stockConcentrationPct: numeric('stock_concentration_pct', { precision: 8, scale: 4 }).default(
    '100',
  ),
  solvent: text('solvent'),
  pyramidNote: text('pyramid_note'),
  childFormulaId: uuid('child_formula_id').references(() => formulas.id, { onDelete: 'set null' }),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const weighingSessions = labSchema.table('weighing_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
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
    ownerMaterialUidx: uniqueIndex('inventory_items_owner_material_uidx').on(
      table.ownerId,
      table.materialId,
    ),
  }),
);

export const evaluations = labSchema.table('evaluations', {
  id: uuid('id').primaryKey().defaultRandom(),
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
