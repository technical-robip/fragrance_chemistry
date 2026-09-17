import { integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const communitySchema = pgSchema('community');

export const posts = communitySchema.table('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const perfumes = communitySchema.table('perfumes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  house: text('house'),
  perfumer: text('perfumer'),
  year: integer('year'),
  family: text('family'),
  pyramid: jsonb('pyramid').notNull().default({}),
  attributes: jsonb('attributes').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = communitySchema.table('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  perfumeId: uuid('perfume_id')
    .notNull()
    .references(() => perfumes.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull(),
  sillage: integer('sillage'),
  longevity: integer('longevity'),
  value: integer('value'),
  season: text('season'),
  body: text('body'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const descriptors = communitySchema.table('descriptors', {
  id: uuid('id').primaryKey().defaultRandom(),
  term: text('term').notNull().unique(),
  accord: text('accord'),
  emotion: text('emotion'),
});
