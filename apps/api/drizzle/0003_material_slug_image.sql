ALTER TABLE catalog.materials ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE catalog.materials ADD COLUMN IF NOT EXISTS image_url text;

CREATE UNIQUE INDEX IF NOT EXISTS materials_slug_uidx ON catalog.materials (slug) WHERE slug IS NOT NULL;
