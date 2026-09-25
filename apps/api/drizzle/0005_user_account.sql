-- User account prefs + plans, quotas, features, subscriptions
ALTER TABLE core.users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS default_batch_target_grams numeric(14,4) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS default_concentration_pct numeric(8,4) NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS default_ifra_category integer NOT NULL DEFAULT 4;

CREATE TABLE IF NOT EXISTS core.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plans_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS core.plan_quotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL REFERENCES core.plans(id) ON DELETE cascade,
  quota_key text NOT NULL,
  limit_value integer
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_quotas_plan_key_unique
  ON core.plan_quotas (plan_id, quota_key);

CREATE TABLE IF NOT EXISTS core.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  plan_id uuid NOT NULL REFERENCES core.plans(id) ON DELETE cascade,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_features_plan_key_unique
  ON core.plan_features (plan_id, feature_key);

CREATE TABLE IF NOT EXISTS core.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE cascade,
  plan_id uuid NOT NULL REFERENCES core.plans(id) ON DELETE restrict,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  quota_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_user
  ON core.subscriptions (user_id)
  WHERE status = 'active';
