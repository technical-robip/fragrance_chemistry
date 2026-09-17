import { boolean, jsonb, numeric, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const catalogSchema = pgSchema('catalog');

export const materials = catalogSchema.table('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  casNumber: text('cas_number'),
  iupac: text('iupac'),
  category: text('category'),
  description: text('description'),
  stockConcentrationPct: numeric('stock_concentration_pct', { precision: 8, scale: 4 }).default(
    '100',
  ),
  solvent: text('solvent'),
  olfactoryFamily: text('olfactory_family'),
  pyramidNote: text('pyramid_note'),
  tenacityHours: numeric('tenacity_hours', { precision: 8, scale: 2 }),
  costPerGram: numeric('cost_per_gram', { precision: 12, scale: 6 }),
  allergenProfile: jsonb('allergen_profile').default({}),
  searchText: text('search_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const suppliers = catalogSchema.table('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  website: text('website'),
  notes: text('notes'),
  region: text('region'),
  country: text('country'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const supplierPrices = catalogSchema.table('supplier_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  supplierId: uuid('supplier_id')
    .notNull()
    .references(() => suppliers.id, { onDelete: 'cascade' }),
  materialId: uuid('material_id')
    .notNull()
    .references(() => materials.id, { onDelete: 'cascade' }),
  pricePerGram: numeric('price_per_gram', { precision: 12, scale: 6 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  sdsUrl: text('sds_url'),
  sponsored: boolean('sponsored').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ifraCategories = catalogSchema.table('ifra_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  label: text('label').notNull(),
});

export const ifraLimits = catalogSchema.table('ifra_limits', {
  id: uuid('id').primaryKey().defaultRandom(),
  materialId: uuid('material_id')
    .notNull()
    .references(() => materials.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => ifraCategories.id, { onDelete: 'cascade' }),
  maxPercent: numeric('max_percent', { precision: 8, scale: 4 }).notNull(),
});
