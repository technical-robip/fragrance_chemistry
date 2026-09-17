-- Enrichment migration: roles/plans, formula workbench fields, community encyclopedia, FTS
ALTER TABLE core.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'enthusiast',
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

ALTER TABLE catalog.materials
  ADD COLUMN IF NOT EXISTS iupac text,
  ADD COLUMN IF NOT EXISTS stock_concentration_pct numeric(8,4) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS solvent text,
  ADD COLUMN IF NOT EXISTS olfactory_family text,
  ADD COLUMN IF NOT EXISTS pyramid_note text,
  ADD COLUMN IF NOT EXISTS tenacity_hours numeric(8,2),
  ADD COLUMN IF NOT EXISTS allergen_profile jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS search_text text;

CREATE INDEX IF NOT EXISTS materials_name_trgm ON catalog.materials USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS materials_search_trgm ON catalog.materials USING gin (search_text gin_trgm_ops);

ALTER TABLE catalog.suppliers
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS country text;

CREATE TABLE IF NOT EXISTS catalog.supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  supplier_id uuid NOT NULL REFERENCES catalog.suppliers(id) ON DELETE cascade,
  material_id uuid NOT NULL REFERENCES catalog.materials(id) ON DELETE cascade,
  price_per_gram numeric(12,6) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  sds_url text,
  sponsored boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lab.formulas
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS batch_target_grams numeric(14,4) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS concentration_pct numeric(8,4) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS lab.formula_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  formula_id uuid NOT NULL REFERENCES lab.formulas(id) ON DELETE cascade,
  owner_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lab.formula_lines
  ADD COLUMN IF NOT EXISTS target_grams numeric(14,6),
  ADD COLUMN IF NOT EXISTS weighed_grams numeric(14,6),
  ADD COLUMN IF NOT EXISTS stock_concentration_pct numeric(8,4) DEFAULT 100,
  ADD COLUMN IF NOT EXISTS solvent text,
  ADD COLUMN IF NOT EXISTS pyramid_note text;

CREATE TABLE IF NOT EXISTS lab.weighing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  formula_id uuid NOT NULL REFERENCES lab.formulas(id) ON DELETE cascade,
  status text NOT NULL DEFAULT 'active',
  current_line_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lab.evaluations
  ADD COLUMN IF NOT EXISTS maceration_day integer,
  ADD COLUMN IF NOT EXISTS t0_notes text,
  ADD COLUMN IF NOT EXISTS t30m_notes text,
  ADD COLUMN IF NOT EXISTS t4h_notes text,
  ADD COLUMN IF NOT EXISTS t24h_notes text,
  ADD COLUMN IF NOT EXISTS clarity text,
  ADD COLUMN IF NOT EXISTS opalescence text,
  ADD COLUMN IF NOT EXISTS solubility text;

ALTER TABLE lab.inventory_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'material',
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS min_quantity_grams numeric(14,4) DEFAULT 0;

CREATE TABLE IF NOT EXISTS community.perfumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  house text,
  perfumer text,
  year integer,
  family text,
  pyramid jsonb NOT NULL DEFAULT '{}'::jsonb,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  perfume_id uuid NOT NULL REFERENCES community.perfumes(id) ON DELETE cascade,
  author_id uuid NOT NULL,
  sillage integer,
  longevity integer,
  value integer,
  season text,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community.descriptors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  term text NOT NULL UNIQUE,
  accord text,
  emotion text
);

-- RLS for new lab tables
ALTER TABLE lab.formula_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.formula_versions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_formula_versions_tenant ON lab.formula_versions;
CREATE POLICY lab_formula_versions_tenant ON lab.formula_versions
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

ALTER TABLE lab.weighing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab.weighing_sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lab_weighing_sessions_tenant ON lab.weighing_sessions;
CREATE POLICY lab_weighing_sessions_tenant ON lab.weighing_sessions
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, catalog, lab, community TO fragrance_chemistry_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, catalog, lab, community TO fragrance_chemistry_app;
