ALTER TABLE lab.formulas ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS formulas_owner_slug_uidx
  ON lab.formulas (owner_id, slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS formulas_slug_idx ON lab.formulas (slug) WHERE slug IS NOT NULL;
