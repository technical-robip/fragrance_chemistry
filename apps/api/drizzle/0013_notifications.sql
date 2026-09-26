CREATE TABLE IF NOT EXISTS lab.maceration_clocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  formula_id uuid NOT NULL REFERENCES lab.formulas(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS maceration_clocks_owner_formula_unique
  ON lab.maceration_clocks (owner_id, formula_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS core.user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  evaluation_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS lab.formula_notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  formula_id uuid NOT NULL REFERENCES lab.formulas(id) ON DELETE CASCADE,
  muted_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS formula_notification_mutes_owner_formula_unique
  ON lab.formula_notification_mutes (owner_id, formula_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS lab.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  formula_id uuid REFERENCES lab.formulas(id) ON DELETE CASCADE,
  kind text NOT NULL,
  dedupe_key text NOT NULL,
  checkpoint_key text,
  status text NOT NULL DEFAULT 'open',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz,
  resolved_at timestamptz,
  CONSTRAINT notifications_status_check CHECK (status IN ('open', 'dismissed', 'resolved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS notifications_owner_dedupe_unique
  ON lab.notifications (owner_id, dedupe_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS notifications_owner_status_idx
  ON lab.notifications (owner_id, status);
--> statement-breakpoint
ALTER TABLE lab.maceration_clocks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lab.maceration_clocks FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS lab_maceration_clocks_tenant ON lab.maceration_clocks;
--> statement-breakpoint
CREATE POLICY lab_maceration_clocks_tenant ON lab.maceration_clocks
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE lab.formula_notification_mutes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lab.formula_notification_mutes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_notification_mutes_tenant ON lab.formula_notification_mutes;
--> statement-breakpoint
CREATE POLICY lab_formula_notification_mutes_tenant ON lab.formula_notification_mutes
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE lab.notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lab.notifications FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS lab_notifications_tenant ON lab.notifications;
--> statement-breakpoint
CREATE POLICY lab_notifications_tenant ON lab.notifications
  USING (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (owner_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE core.user_notification_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE core.user_notification_preferences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS core_user_notification_preferences_tenant ON core.user_notification_preferences;
--> statement-breakpoint
CREATE POLICY core_user_notification_preferences_tenant ON core.user_notification_preferences
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lab.notification_clock_owner_ids()
RETURNS TABLE (owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = lab, pg_temp
AS $$
  SELECT DISTINCT c.owner_id FROM lab.maceration_clocks AS c;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION lab.notification_clock_owner_ids() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION lab.notification_clock_owner_ids() TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.user_notification_preferences,
  lab.maceration_clocks,
  lab.formula_notification_mutes,
  lab.notifications
TO fragrance_chemistry_app;
