CREATE TABLE IF NOT EXISTS lab.inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  item_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_events_item_idx
  ON lab.inventory_events (owner_id, item_id, created_at DESC);
