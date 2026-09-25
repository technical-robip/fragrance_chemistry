-- Manufacturer + pyramid note normalization + filter indexes
ALTER TABLE catalog.materials
  ADD COLUMN IF NOT EXISTS manufacturer text;

UPDATE catalog.materials
SET pyramid_note = 'middle'
WHERE pyramid_note = 'heart';

CREATE INDEX IF NOT EXISTS materials_pyramid_note_idx ON catalog.materials (pyramid_note);
CREATE INDEX IF NOT EXISTS materials_olfactory_family_idx ON catalog.materials (olfactory_family);
CREATE INDEX IF NOT EXISTS materials_manufacturer_idx ON catalog.materials (manufacturer);
CREATE INDEX IF NOT EXISTS materials_cas_trgm ON catalog.materials USING gin (cas_number gin_trgm_ops);
