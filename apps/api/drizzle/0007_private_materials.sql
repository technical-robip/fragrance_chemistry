ALTER TABLE catalog.materials
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS origin text;

CREATE INDEX IF NOT EXISTS materials_owner_idx ON catalog.materials (owner_id);

DROP INDEX IF EXISTS catalog.materials_slug_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS materials_slug_uidx
  ON catalog.materials (slug)
  WHERE slug IS NOT NULL AND owner_id IS NULL;

ALTER TABLE catalog.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.materials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_materials_select ON catalog.materials;
CREATE POLICY catalog_materials_select ON catalog.materials
  FOR SELECT
  USING (
    owner_id IS NULL
    OR owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

DROP POLICY IF EXISTS catalog_materials_insert ON catalog.materials;
CREATE POLICY catalog_materials_insert ON catalog.materials
  FOR INSERT
  WITH CHECK (
    owner_id IS NOT NULL
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

DROP POLICY IF EXISTS catalog_materials_update ON catalog.materials;
CREATE POLICY catalog_materials_update ON catalog.materials
  FOR UPDATE
  USING (
    owner_id IS NOT NULL
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  )
  WITH CHECK (
    owner_id IS NOT NULL
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

DROP POLICY IF EXISTS catalog_materials_delete ON catalog.materials;
CREATE POLICY catalog_materials_delete ON catalog.materials
  FOR DELETE
  USING (
    owner_id IS NOT NULL
    AND owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO fragrance_chemistry_app;
