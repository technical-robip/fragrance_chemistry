CREATE TABLE IF NOT EXISTS "core"."users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "display_name" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "catalog"."materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "cas_number" text,
  "category" text,
  "description" text,
  "cost_per_gram" numeric(12, 6),
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "catalog"."suppliers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "website" text,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "catalog"."ifra_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "label" text NOT NULL,
  CONSTRAINT "ifra_categories_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "catalog"."ifra_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "material_id" uuid NOT NULL REFERENCES "catalog"."materials"("id") ON DELETE cascade,
  "category_id" uuid NOT NULL REFERENCES "catalog"."ifra_categories"("id") ON DELETE cascade,
  "max_percent" numeric(8, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS "lab"."formulas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lab"."formula_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "formula_id" uuid NOT NULL REFERENCES "lab"."formulas"("id") ON DELETE cascade,
  "owner_id" uuid NOT NULL,
  "material_id" uuid NOT NULL REFERENCES "catalog"."materials"("id"),
  "percent" numeric(8, 4) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS "lab"."inventory_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "material_id" uuid NOT NULL REFERENCES "catalog"."materials"("id"),
  "quantity_grams" numeric(14, 4) NOT NULL,
  "location" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "lab"."evaluations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "formula_id" uuid NOT NULL REFERENCES "lab"."formulas"("id") ON DELETE cascade,
  "rating" integer NOT NULL,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "community"."posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "author_id" uuid NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

-- lab.* RLS (FORCE ROW LEVEL SECURITY, tenant via app.user_id)
ALTER TABLE lab.formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.formulas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_formulas_tenant ON lab.formulas;
CREATE POLICY lab_formulas_tenant ON lab.formulas
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

ALTER TABLE lab.formula_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.formula_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_formula_lines_tenant ON lab.formula_lines;
CREATE POLICY lab_formula_lines_tenant ON lab.formula_lines
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

ALTER TABLE lab.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.inventory_items FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_inventory_items_tenant ON lab.inventory_items;
CREATE POLICY lab_inventory_items_tenant ON lab.inventory_items
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

ALTER TABLE lab.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.evaluations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_evaluations_tenant ON lab.evaluations;
CREATE POLICY lab_evaluations_tenant ON lab.evaluations
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, catalog, lab, community TO fragrance_chemistry_app;
