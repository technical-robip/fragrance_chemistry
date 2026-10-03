CREATE TABLE IF NOT EXISTS core.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  is_personal boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS core.organization_members (
  org_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS core.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES core.organizations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS core.organization_keys (
  org_id uuid PRIMARY KEY REFERENCES core.organizations(id) ON DELETE CASCADE,
  wrapped_dek bytea NOT NULL,
  nonce bytea NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
INSERT INTO core.organizations (id, name, is_personal, created_by)
SELECT u.id, u.display_name || '''s lab', true, u.id
FROM core.users u
WHERE NOT EXISTS (SELECT 1 FROM core.organizations o WHERE o.id = u.id);
--> statement-breakpoint
INSERT INTO core.organization_members (org_id, user_id, role)
SELECT u.id, u.id, 'owner'
FROM core.users u
WHERE NOT EXISTS (
  SELECT 1 FROM core.organization_members m WHERE m.org_id = u.id AND m.user_id = u.id
);
--> statement-breakpoint
ALTER TABLE lab.formulas ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.formulas SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.formulas ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.formulas
  ADD COLUMN IF NOT EXISTS header_secret bytea,
  ADD COLUMN IF NOT EXISTS header_nonce bytea,
  ADD COLUMN IF NOT EXISTS slug_hmac bytea,
  ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE lab.formula_lines ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.formula_lines SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.formula_lines ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.formula_lines
  ADD COLUMN IF NOT EXISTS secret bytea,
  ADD COLUMN IF NOT EXISTS nonce bytea,
  ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE lab.formula_versions ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.formula_versions SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.formula_versions ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.formula_versions
  ADD COLUMN IF NOT EXISTS snapshot_secret bytea,
  ADD COLUMN IF NOT EXISTS snapshot_nonce bytea,
  ADD COLUMN IF NOT EXISTS key_version integer NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE lab.formula_versions ALTER COLUMN snapshot DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.weighing_sessions ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.weighing_sessions SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.weighing_sessions ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.evaluations ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.evaluations SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.evaluations ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.maceration_clocks ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.maceration_clocks SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.maceration_clocks ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.inventory_items ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.inventory_items SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.inventory_items ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE lab.inventory_events ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
UPDATE lab.inventory_events SET org_id = owner_id WHERE org_id IS NULL;
--> statement-breakpoint
ALTER TABLE lab.inventory_events ALTER COLUMN org_id SET NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS lab.formula_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id uuid NOT NULL REFERENCES lab.formulas(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'published',
  snapshot jsonb,
  published_by uuid,
  published_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS formula_publications_formula_uidx
  ON lab.formula_publications (formula_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS formulas_org_slug_hmac_uidx
  ON lab.formulas (org_id, slug_hmac);
--> statement-breakpoint
DROP INDEX IF EXISTS lab.maceration_clocks_owner_formula_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS maceration_clocks_org_formula_unique
  ON lab.maceration_clocks (org_id, formula_id);
--> statement-breakpoint
DROP INDEX IF EXISTS lab.inventory_items_owner_material_uidx;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_material_uidx
  ON lab.inventory_items (org_id, material_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.is_org_member(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM core.organization_members m
    WHERE m.org_id = p_org
      AND m.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.is_org_owner(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM core.organization_members m
    WHERE m.org_id = p_org
      AND m.user_id = NULLIF(current_setting('app.user_id', true), '')::uuid
      AND m.role = 'owner'
  );
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.personal_org_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
  SELECT o.id
  FROM core.organizations o
  JOIN core.organization_members m ON m.org_id = o.id
  WHERE m.user_id = p_user_id AND o.is_personal
  ORDER BY o.created_at
  LIMIT 1;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.resolve_org(p_user_id uuid, p_org_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
  SELECT m.org_id
  FROM core.organization_members m
  WHERE m.user_id = p_user_id AND m.org_id = p_org_id;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.provision_personal_organization(
  p_user_id uuid,
  p_name text,
  p_wrapped_dek bytea,
  p_nonce bytea
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
BEGIN
  INSERT INTO core.organizations (id, name, is_personal, created_by)
  VALUES (p_user_id, p_name, true, p_user_id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO core.organization_members (org_id, user_id, role)
  VALUES (p_user_id, p_user_id, 'owner')
  ON CONFLICT DO NOTHING;
  INSERT INTO core.organization_keys (org_id, wrapped_dek, nonce, key_version)
  VALUES (p_user_id, p_wrapped_dek, p_nonce, 1)
  ON CONFLICT (org_id) DO NOTHING;
  RETURN p_user_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.org_profile(p_user_id uuid, p_org_id uuid)
RETURNS TABLE (id uuid, name text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
  SELECT o.id, o.name, m.role
  FROM core.organizations o
  JOIN core.organization_members m ON m.org_id = o.id
  WHERE o.id = p_org_id AND m.user_id = p_user_id;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION core.accept_organization_invite(p_user_id uuid, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_temp
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT i.org_id INTO v_org
  FROM core.organization_invites i
  WHERE i.token = p_token
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  FOR UPDATE;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'invite_invalid' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO core.organization_members (org_id, user_id, role)
  VALUES (v_org, p_user_id, 'member')
  ON CONFLICT DO NOTHING;
  UPDATE core.organization_invites
  SET accepted_at = now(), accepted_by = p_user_id
  WHERE token = p_token;
  RETURN v_org;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION lab.notification_clock_owner_ids()
RETURNS TABLE (owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = lab, core, pg_temp
AS $$
  SELECT DISTINCT m.user_id AS owner_id
  FROM lab.maceration_clocks c
  JOIN core.organization_members m ON m.org_id = c.org_id;
$$;
--> statement-breakpoint
ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE core.organizations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS core_organizations_select ON core.organizations;
--> statement-breakpoint
CREATE POLICY core_organizations_select ON core.organizations
  FOR SELECT USING (core.is_org_member(id));
--> statement-breakpoint
DROP POLICY IF EXISTS core_organizations_update ON core.organizations;
--> statement-breakpoint
CREATE POLICY core_organizations_update ON core.organizations
  FOR UPDATE USING (core.is_org_owner(id))
  WITH CHECK (core.is_org_owner(id));
--> statement-breakpoint
ALTER TABLE core.organization_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE core.organization_members FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS core_organization_members_select ON core.organization_members;
--> statement-breakpoint
CREATE POLICY core_organization_members_select ON core.organization_members
  FOR SELECT USING (core.is_org_member(org_id));
--> statement-breakpoint
DROP POLICY IF EXISTS core_organization_members_delete ON core.organization_members;
--> statement-breakpoint
CREATE POLICY core_organization_members_delete ON core.organization_members
  FOR DELETE USING (
    core.is_org_owner(org_id)
    AND user_id IS DISTINCT FROM NULLIF(current_setting('app.user_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE core.organization_invites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE core.organization_invites FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS core_organization_invites_all ON core.organization_invites;
--> statement-breakpoint
CREATE POLICY core_organization_invites_all ON core.organization_invites
  FOR ALL
  USING (core.is_org_owner(org_id))
  WITH CHECK (core.is_org_owner(org_id));
--> statement-breakpoint
ALTER TABLE core.organization_keys ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE core.organization_keys FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS core_organization_keys_select ON core.organization_keys;
--> statement-breakpoint
CREATE POLICY core_organization_keys_select ON core.organization_keys
  FOR SELECT USING (core.is_org_member(org_id));
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formulas_tenant ON lab.formulas;
--> statement-breakpoint
CREATE POLICY lab_formulas_tenant ON lab.formulas
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_lines_tenant ON lab.formula_lines;
--> statement-breakpoint
CREATE POLICY lab_formula_lines_tenant ON lab.formula_lines
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_versions_tenant ON lab.formula_versions;
--> statement-breakpoint
CREATE POLICY lab_formula_versions_tenant ON lab.formula_versions
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_weighing_sessions_tenant ON lab.weighing_sessions;
--> statement-breakpoint
CREATE POLICY lab_weighing_sessions_tenant ON lab.weighing_sessions
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_evaluations_tenant ON lab.evaluations;
--> statement-breakpoint
CREATE POLICY lab_evaluations_tenant ON lab.evaluations
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_maceration_clocks_tenant ON lab.maceration_clocks;
--> statement-breakpoint
CREATE POLICY lab_maceration_clocks_tenant ON lab.maceration_clocks
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_inventory_items_tenant ON lab.inventory_items;
--> statement-breakpoint
CREATE POLICY lab_inventory_items_tenant ON lab.inventory_items
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE lab.inventory_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lab.inventory_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS lab_inventory_events_tenant ON lab.inventory_events;
--> statement-breakpoint
CREATE POLICY lab_inventory_events_tenant ON lab.inventory_events
  USING (
    core.is_org_member(org_id)
    AND (
      NULLIF(current_setting('app.org_id', true), '') IS NULL
      OR org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
    )
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
ALTER TABLE lab.formula_publications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lab.formula_publications FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_publications_read ON lab.formula_publications;
--> statement-breakpoint
CREATE POLICY lab_formula_publications_read ON lab.formula_publications
  FOR SELECT USING (
    status IN ('published', 'withdrawn')
    OR core.is_org_member(org_id)
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_publications_write ON lab.formula_publications;
--> statement-breakpoint
CREATE POLICY lab_formula_publications_write ON lab.formula_publications
  FOR INSERT
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_publications_update ON lab.formula_publications;
--> statement-breakpoint
CREATE POLICY lab_formula_publications_update ON lab.formula_publications
  FOR UPDATE
  USING (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  )
  WITH CHECK (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
DROP POLICY IF EXISTS lab_formula_publications_delete ON lab.formula_publications;
--> statement-breakpoint
CREATE POLICY lab_formula_publications_delete ON lab.formula_publications
  FOR DELETE
  USING (
    core.is_org_member(org_id)
    AND org_id = NULLIF(current_setting('app.org_id', true), '')::uuid
  );
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  core.organizations,
  core.organization_members,
  core.organization_invites,
  core.organization_keys,
  lab.formula_publications,
  lab.inventory_events
TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.is_org_member(uuid) TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.is_org_owner(uuid) TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.personal_org_id(uuid) TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.resolve_org(uuid, uuid) TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.org_profile(uuid, uuid) TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.provision_personal_organization(uuid, text, bytea, bytea) TO fragrance_chemistry_app;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION core.accept_organization_invite(uuid, text) TO fragrance_chemistry_app;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.is_org_member(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.is_org_owner(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.personal_org_id(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.resolve_org(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.org_profile(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.provision_personal_organization(uuid, text, bytea, bytea) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION core.accept_organization_invite(uuid, text) FROM PUBLIC;
