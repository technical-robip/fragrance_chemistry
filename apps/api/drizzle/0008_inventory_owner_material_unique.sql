CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_owner_material_uidx
  ON lab.inventory_items (owner_id, material_id);
