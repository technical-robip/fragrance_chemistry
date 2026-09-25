import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const catalogSchema = pgSchema('catalog');

export const materials = catalogSchema.table('materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id'),
  name: text('name').notNull(),
  casNumber: text('cas_number'),
  iupac: text('iupac'),
  category: text('category'),
  origin: text('origin'),
  description: text('description'),
  stockConcentrationPct: numeric('stock_concentration_pct', { precision: 8, scale: 4 }).default(
    '100',
  ),
  solvent: text('solvent'),
  olfactoryFamily: text('olfactory_family'),
  pyramidNote: text('pyramid_note'),
  manufacturer: text('manufacturer'),
  tenacityHours: numeric('tenacity_hours', { precision: 8, scale: 2 }),
  costPerGram: numeric('cost_per_gram', { precision: 12, scale: 6 }),
  allergenProfile: jsonb('allergen_profile').default({}),
  searchText: text('search_text'),
  slug: text('slug'),
  imageUrl: text('image_url'),
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
  maxPercent: numeric('max_percent', { precision: 14, scale: 8 }).notNull(),
});

export const ifraStandards = catalogSchema.table(
  'ifra_standards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    amendment: integer('amendment'),
    publicationYears: text('publication_years'),
    lastPublicationYear: integer('last_publication_year'),
    deadlineExisting: text('deadline_existing'),
    deadlineNew: text('deadline_new'),
    standardType: text('standard_type').notNull(),
    riskDrivers: text('risk_drivers'),
    flavorNote: text('flavor_note'),
    phototoxicityNote: text('phototoxicity_note'),
    restrictionNote: text('restriction_note'),
    specificationNote: text('specification_note'),
    otherSources: text('other_sources'),
    otherSourcesNote: text('other_sources_note'),
    casComment: text('cas_comment'),
    synonyms: jsonb('synonyms').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('ifra_standards_code_unique').on(table.code)],
);

export const ifraStandardCas = catalogSchema.table(
  'ifra_standard_cas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => ifraStandards.id, { onDelete: 'cascade' }),
    casNumber: text('cas_number').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (table) => [unique('ifra_standard_cas_unique').on(table.standardId, table.casNumber)],
);

export const ifraStandardLimits = catalogSchema.table(
  'ifra_standard_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => ifraStandards.id, { onDelete: 'cascade' }),
    categoryCode: text('category_code').notNull(),
    maxPercent: numeric('max_percent', { precision: 14, scale: 8 }),
    unrestricted: boolean('unrestricted').notNull().default(false),
  },
  (table) => [unique('ifra_standard_limits_unique').on(table.standardId, table.categoryCode)],
);

export const materialIfraStandards = catalogSchema.table(
  'material_ifra_standards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    standardId: uuid('standard_id')
      .notNull()
      .references(() => ifraStandards.id, { onDelete: 'cascade' }),
    matchKind: text('match_kind').notNull(),
  },
  (table) => [unique('material_ifra_standards_unique').on(table.materialId, table.standardId)],
);
