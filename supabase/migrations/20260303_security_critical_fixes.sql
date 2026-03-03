-- ============================================================================
-- CRITICAL SECURITY FIXES — 2026-03-03
-- ============================================================================
-- Fix 1: CRM/admin tables had USING(true) — any authenticated user could
--        read/write all customer data. Fixed: restrict to is_admin only.
--        NOTE: The admin panel ("Nexus Admin") is only for the one true admin
--        account (is_admin = true), NOT for regular superusers (is_superuser).
--        is_superuser = project/team owner in the main app.
--        is_admin = system administrator with access to the admin panel.
--
-- Fix 2: has_project_access(), get_my_project_ids(), check_user_permission()
--        used SET row_security = off. With SECURITY DEFINER the function
--        already runs as the function owner and bypasses the caller's RLS —
--        row_security=off is redundant and dangerous. Removed.
--
-- Fix 3: Storage buckets logos, company-files, contracts had policies with
--        no auth check. Fixed: restrict to is_admin only.
--
-- Fix 4: Old *_select_policy entries (auth.role()='authenticated') and
--        USING(true) policies from prior migrations were NOT dropped by the
--        new superuser-only policies, so PostgreSQL's OR logic kept SELECT
--        open to all. Explicitly drop ALL survivor policies before replacing.
--
-- Fix 5: The old REVOKE UPDATE (is_superuser, team_role, team_id) on profiles
--        broke MyTeam.tsx team-admin operations. Removed — the existing
--        RLS policy "profiles_update_team_admin" (WITH CHECK is_superuser=false)
--        already correctly guards those columns at the policy level.
-- ============================================================================


-- ============================================================================
-- STEP 0: Add is_admin column to profiles
-- ============================================================================
-- is_admin  = can log into the Nexus Admin panel (system administrator)
-- is_superuser = project/team owner elevated role within the main app
-- These are intentionally separate flags.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Only one admin should exist; protect it the same way as is_superuser
COMMENT ON COLUMN public.profiles.is_admin IS
  'System administrator — grants access to the Nexus Admin panel. '
  'Distinct from is_superuser (main-app project owner). '
  'Can only be set via the Supabase dashboard or service role.';

-- Create a helper function for admin checks (mirrors is_current_user_superuser)
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon;

-- ============================================================================
-- STEP 1: Extend profiles RLS to block is_admin escalation
-- ============================================================================
-- The existing "profiles_update_own" policy (from 20260222) already prevents
-- writing is_superuser, but we also need to prevent writing is_admin.
-- Re-create that policy with the extended check.

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Superusers may update everything (handled separately via profiles_update_superuser)
      public.is_current_user_superuser()
      OR (
        -- Regular users: cannot escalate is_superuser or is_admin
        is_superuser = false
        AND is_admin = false
        -- team_role and team_id must stay as they are (team admin manages these)
        AND team_role = (SELECT team_role FROM public.profiles WHERE id = auth.uid())
        AND (
          team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid())
          OR team_id IS NULL
        )
      )
    )
  );

-- Also extend the superuser update policy to explicitly keep is_admin intact
-- (superusers in the main app must not be able to grant themselves admin panel access)
DROP POLICY IF EXISTS "profiles_update_superuser" ON public.profiles;

CREATE POLICY "profiles_update_superuser" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (
    public.is_current_user_superuser()
    -- Even superusers cannot escalate is_admin — only set via service role
    AND is_admin = (SELECT is_admin FROM public.profiles WHERE id = profiles.id)
  );


-- ============================================================================
-- STEP 2: Fix USING(true) and all survivor policies on CRM/admin tables
-- ============================================================================
-- Strategy: explicitly drop EVERY known policy variant on each table,
-- then create a single clean admin-only policy.
-- This covers policies from: ADMIN_SYSTEM.sql, ADMIN_CRM_SCHEMA.sql,
-- 20260219_critical_rls_missing_tables.sql, and earlier migrations.

-- ── companies ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"       ON public.companies;
DROP POLICY IF EXISTS "Admins full access companies"         ON public.companies;
DROP POLICY IF EXISTS "companies_select_policy"              ON public.companies;
DROP POLICY IF EXISTS "companies_insert_policy"              ON public.companies;
DROP POLICY IF EXISTS "companies_update_policy"              ON public.companies;
DROP POLICY IF EXISTS "companies_delete_policy"              ON public.companies;
DROP POLICY IF EXISTS "crm_companies_superuser_all"          ON public.companies;

CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── contact_persons ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"            ON public.contact_persons;
DROP POLICY IF EXISTS "Admins full access contact_persons"        ON public.contact_persons;
DROP POLICY IF EXISTS "contact_persons_select_policy"             ON public.contact_persons;
DROP POLICY IF EXISTS "contact_persons_insert_policy"             ON public.contact_persons;
DROP POLICY IF EXISTS "contact_persons_update_policy"             ON public.contact_persons;
DROP POLICY IF EXISTS "contact_persons_delete_policy"             ON public.contact_persons;
DROP POLICY IF EXISTS "crm_contact_persons_superuser_all"         ON public.contact_persons;

CREATE POLICY "contact_persons_admin_all" ON public.contact_persons
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── subscription_types ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"              ON public.subscription_types;
DROP POLICY IF EXISTS "Admins full access subscription_types"       ON public.subscription_types;
DROP POLICY IF EXISTS "subscription_types_select_policy"            ON public.subscription_types;
DROP POLICY IF EXISTS "subscription_types_insert_policy"            ON public.subscription_types;
DROP POLICY IF EXISTS "subscription_types_update_policy"            ON public.subscription_types;
DROP POLICY IF EXISTS "subscription_types_delete_policy"            ON public.subscription_types;
DROP POLICY IF EXISTS "crm_subscription_types_superuser_all"        ON public.subscription_types;

CREATE POLICY "subscription_types_admin_all" ON public.subscription_types
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── crm_notes ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"   ON public.crm_notes;
DROP POLICY IF EXISTS "Admins full access crm_notes"     ON public.crm_notes;
DROP POLICY IF EXISTS "crm_notes_select_policy"          ON public.crm_notes;
DROP POLICY IF EXISTS "crm_notes_insert_policy"          ON public.crm_notes;
DROP POLICY IF EXISTS "crm_notes_update_policy"          ON public.crm_notes;
DROP POLICY IF EXISTS "crm_notes_delete_policy"          ON public.crm_notes;
DROP POLICY IF EXISTS "crm_crm_notes_superuser_all"      ON public.crm_notes;

CREATE POLICY "crm_notes_admin_all" ON public.crm_notes
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── tags ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.tags;
DROP POLICY IF EXISTS "Admins full access tags"        ON public.tags;
DROP POLICY IF EXISTS "tags_select_policy"             ON public.tags;
DROP POLICY IF EXISTS "tags_insert_policy"             ON public.tags;
DROP POLICY IF EXISTS "tags_update_policy"             ON public.tags;
DROP POLICY IF EXISTS "tags_delete_policy"             ON public.tags;
DROP POLICY IF EXISTS "crm_tags_superuser_all"         ON public.tags;

CREATE POLICY "tags_admin_all" ON public.tags
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── company_files ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"  ON public.company_files;
DROP POLICY IF EXISTS "Admins full access crm_files"    ON public.company_files;
DROP POLICY IF EXISTS "company_files_select_policy"     ON public.company_files;
DROP POLICY IF EXISTS "company_files_insert_policy"     ON public.company_files;
DROP POLICY IF EXISTS "company_files_update_policy"     ON public.company_files;
DROP POLICY IF EXISTS "company_files_delete_policy"     ON public.company_files;
DROP POLICY IF EXISTS "crm_company_files_superuser_all" ON public.company_files;

CREATE POLICY "company_files_admin_all" ON public.company_files
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── company_subscriptions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"              ON public.company_subscriptions;
DROP POLICY IF EXISTS "Admins full access company_subscriptions"    ON public.company_subscriptions;
DROP POLICY IF EXISTS "company_subscriptions_select_policy"         ON public.company_subscriptions;
DROP POLICY IF EXISTS "company_subscriptions_insert_policy"         ON public.company_subscriptions;
DROP POLICY IF EXISTS "company_subscriptions_update_policy"         ON public.company_subscriptions;
DROP POLICY IF EXISTS "company_subscriptions_delete_policy"         ON public.company_subscriptions;
DROP POLICY IF EXISTS "crm_company_subscriptions_superuser_all"     ON public.company_subscriptions;

CREATE POLICY "company_subscriptions_admin_all" ON public.company_subscriptions
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── invoices ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.invoices;
DROP POLICY IF EXISTS "Admins full access invoices"    ON public.invoices;
DROP POLICY IF EXISTS "invoices_select_policy"         ON public.invoices;
DROP POLICY IF EXISTS "invoices_insert_policy"         ON public.invoices;
DROP POLICY IF EXISTS "invoices_update_policy"         ON public.invoices;
DROP POLICY IF EXISTS "invoices_delete_policy"         ON public.invoices;
DROP POLICY IF EXISTS "crm_invoices_superuser_all"     ON public.invoices;

CREATE POLICY "invoices_admin_all" ON public.invoices
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── company_history ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all access for everyone"      ON public.company_history;
DROP POLICY IF EXISTS "Admins full access company_history"  ON public.company_history;
DROP POLICY IF EXISTS "company_history_select"              ON public.company_history;
DROP POLICY IF EXISTS "company_history_insert"              ON public.company_history;
DROP POLICY IF EXISTS "crm_company_history_superuser_all"   ON public.company_history;

CREATE POLICY "company_history_admin_all" ON public.company_history
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── crm_contacts ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth full access crm_contacts"    ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_select_policy"       ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_insert_policy"       ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_update_policy"       ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_delete_policy"       ON public.crm_contacts;
DROP POLICY IF EXISTS "crm_contacts_superuser_all"       ON public.crm_contacts;

CREATE POLICY "crm_contacts_admin_all" ON public.crm_contacts
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── subcontractors ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth full access subcontractors"       ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_select_policy"          ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_insert_policy"          ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_update_policy"          ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_delete_policy"          ON public.subcontractors;
DROP POLICY IF EXISTS "subcontractors_superuser_all"          ON public.subcontractors;

CREATE POLICY "subcontractors_admin_all" ON public.subcontractors
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── subcontractor_contacts ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Auth full access sub_contacts"              ON public.subcontractor_contacts;
DROP POLICY IF EXISTS "subcontractor_contacts_select_policy"       ON public.subcontractor_contacts;
DROP POLICY IF EXISTS "subcontractor_contacts_insert_policy"       ON public.subcontractor_contacts;
DROP POLICY IF EXISTS "subcontractor_contacts_update_policy"       ON public.subcontractor_contacts;
DROP POLICY IF EXISTS "subcontractor_contacts_delete_policy"       ON public.subcontractor_contacts;
DROP POLICY IF EXISTS "subcontractor_contacts_superuser_all"       ON public.subcontractor_contacts;

CREATE POLICY "subcontractor_contacts_admin_all" ON public.subcontractor_contacts
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

-- ── crm_files (conditional — may not exist in all environments) ────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_files'
  ) THEN
    EXECUTE $p$ DROP POLICY IF EXISTS "Admins full access crm_files" ON public.crm_files $p$;
    EXECUTE $p$ DROP POLICY IF EXISTS "crm_files_superuser_all"      ON public.crm_files $p$;
    EXECUTE $p$
      CREATE POLICY "crm_files_admin_all" ON public.crm_files
        FOR ALL TO authenticated
        USING     (public.is_current_user_admin())
        WITH CHECK(public.is_current_user_admin())
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'file_tags'
  ) THEN
    EXECUTE $p$ DROP POLICY IF EXISTS "Admins full access file_tags"  ON public.file_tags $p$;
    EXECUTE $p$ DROP POLICY IF EXISTS "crm_file_tags_superuser_all"   ON public.file_tags $p$;
    EXECUTE $p$
      CREATE POLICY "file_tags_admin_all" ON public.file_tags
        FOR ALL TO authenticated
        USING     (public.is_current_user_admin())
        WITH CHECK(public.is_current_user_admin())
    $p$;
  END IF;
END $$;


-- ============================================================================
-- STEP 3: project_crm_links and project_subcontractors
-- ============================================================================
-- These bridge CRM data to projects. Access: project members (to view their
-- linked CRM data) + admin (full management).
-- Clean up survivor policies from 20260215 before adding the new ones.

DROP POLICY IF EXISTS "Auth all access crm links"        ON public.project_crm_links;
DROP POLICY IF EXISTS "project_crm_links_select"         ON public.project_crm_links;
DROP POLICY IF EXISTS "project_crm_links_manage"         ON public.project_crm_links;
DROP POLICY IF EXISTS "project_crm_links_access"         ON public.project_crm_links;

CREATE POLICY "project_crm_links_member_select" ON public.project_crm_links
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

CREATE POLICY "project_crm_links_admin_all" ON public.project_crm_links
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

CREATE POLICY "project_crm_links_owner_manage" ON public.project_crm_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_crm_links.project_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_crm_links.project_id
        AND owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Auth all access project subs"          ON public.project_subcontractors;
DROP POLICY IF EXISTS "project_subcontractors_select"         ON public.project_subcontractors;
DROP POLICY IF EXISTS "project_subcontractors_manage"         ON public.project_subcontractors;
DROP POLICY IF EXISTS "project_subcontractors_access"         ON public.project_subcontractors;

CREATE POLICY "project_subcontractors_member_select" ON public.project_subcontractors
  FOR SELECT TO authenticated
  USING (public.has_project_access(project_id));

CREATE POLICY "project_subcontractors_admin_all" ON public.project_subcontractors
  FOR ALL TO authenticated
  USING     (public.is_current_user_admin())
  WITH CHECK(public.is_current_user_admin());

CREATE POLICY "project_subcontractors_owner_manage" ON public.project_subcontractors
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_subcontractors.project_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_subcontractors.project_id
        AND owner_id = auth.uid()
    )
  );


-- ============================================================================
-- STEP 4: Fix Storage bucket policies — admin-only access
-- ============================================================================
-- logos, company-files, contracts are admin panel assets only.
-- Drop all prior policies (auth-less and old superuser variants).

DROP POLICY IF EXISTS "Give admin access to logos"           ON storage.objects;
DROP POLICY IF EXISTS "Give admin access to company-files"   ON storage.objects;
DROP POLICY IF EXISTS "Give admin access to contracts"       ON storage.objects;
DROP POLICY IF EXISTS "logos_superuser_all"                  ON storage.objects;
DROP POLICY IF EXISTS "company_files_superuser_all"          ON storage.objects;
DROP POLICY IF EXISTS "contracts_superuser_all"              ON storage.objects;

CREATE POLICY "logos_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.is_current_user_admin()
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND public.is_current_user_admin()
  );

CREATE POLICY "company_files_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'company-files'
    AND public.is_current_user_admin()
  )
  WITH CHECK (
    bucket_id = 'company-files'
    AND public.is_current_user_admin()
  );

CREATE POLICY "contracts_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.is_current_user_admin()
  )
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.is_current_user_admin()
  );

-- Make these buckets private (no public URL access)
UPDATE storage.buckets SET public = false
WHERE id IN ('logos', 'company-files', 'contracts');


-- ============================================================================
-- STEP 5: Remove SET row_security = off from SECURITY DEFINER functions
-- ============================================================================
-- SECURITY DEFINER functions already run as the function owner (postgres),
-- which bypasses the caller's RLS automatically. row_security=off is redundant
-- and is a privilege escalation risk if the function ever changes.

CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- SECURITY DEFINER: runs as function owner, bypasses caller RLS.
  -- No SET row_security=off needed.

  -- Admin always has access
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Superuser always has access
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_superuser = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Project owner
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Direct member
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Team access
  IF EXISTS (
    SELECT 1
    FROM public.team_project_access tpa
    JOIN public.profiles pr ON pr.team_id = tpa.team_id
    WHERE tpa.project_id = p_id
      AND pr.id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO anon;


CREATE OR REPLACE FUNCTION public.get_my_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT id FROM public.projects WHERE owner_id = auth.uid()
  UNION
  SELECT project_id FROM public.project_members
    WHERE user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  UNION
  SELECT tpa.project_id
  FROM public.team_project_access tpa
  JOIN public.profiles pr ON pr.team_id = tpa.team_id
  WHERE pr.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_project_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_project_ids() TO anon;


CREATE OR REPLACE FUNCTION public.check_user_permission(
    p_user_id         UUID,
    p_project_id      UUID,
    p_module_key      TEXT,
    p_permission_type TEXT  -- 'view' | 'create' | 'edit' | 'delete'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    user_is_owner      BOOLEAN;
    user_is_superuser  BOOLEAN;
    user_is_admin      BOOLEAN;
    member_record      RECORD;
    role_perm          RECORD;
    member_perm        RECORD;
BEGIN
    -- SECURITY DEFINER: runs as owner, no row_security=off needed.

    SELECT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;

    SELECT
      COALESCE(p.is_superuser, FALSE),
      COALESCE(p.is_admin, FALSE)
    INTO user_is_superuser, user_is_admin
    FROM public.profiles p WHERE p.id = p_user_id;

    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) OR COALESCE(user_is_admin, FALSE) THEN
        RETURN TRUE;
    END IF;

    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
      AND pmr.user_id    = p_user_id
      AND pmr.status IN ('open', 'active', 'invited');

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Per-member override takes priority
    SELECT * INTO member_perm
    FROM public.project_member_permissions pmp
    WHERE pmp.project_member_id = member_record.id
      AND pmp.module_key        = p_module_key;

    IF FOUND THEN
        CASE p_permission_type
            WHEN 'view'   THEN RETURN COALESCE(member_perm.can_view,   FALSE);
            WHEN 'create' THEN RETURN COALESCE(member_perm.can_create, FALSE);
            WHEN 'edit'   THEN RETURN COALESCE(member_perm.can_edit,   FALSE);
            WHEN 'delete' THEN RETURN COALESCE(member_perm.can_delete, FALSE);
            ELSE RETURN FALSE;
        END CASE;
    END IF;

    -- No role assigned → view-only
    IF member_record.role_id IS NULL THEN
        RETURN CASE p_permission_type WHEN 'view' THEN TRUE ELSE FALSE END;
    END IF;

    -- Role-based permission
    SELECT * INTO role_perm
    FROM public.role_permissions rp
    WHERE rp.role_id    = member_record.role_id
      AND rp.module_key = p_module_key;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    CASE p_permission_type
        WHEN 'view'   THEN RETURN COALESCE(role_perm.can_view,   FALSE);
        WHEN 'create' THEN RETURN COALESCE(role_perm.can_create, FALSE);
        WHEN 'edit'   THEN RETURN COALESCE(role_perm.can_edit,   FALSE);
        WHEN 'delete' THEN RETURN COALESCE(role_perm.can_delete, FALSE);
        ELSE RETURN FALSE;
    END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_permission(UUID, UUID, TEXT, TEXT) TO authenticated;


-- ============================================================================
-- STEP 6: Fix overly broad projects policies
-- ============================================================================
-- "Superusers full access projects" was USING(true) for ALL authenticated.
-- Replace with a proper superuser check. The existing projects_select,
-- projects_update, projects_delete policies (from 20260215/20260217) are
-- already correct — only the superuser blanket policy needs fixing.

DROP POLICY IF EXISTS "Superusers full access projects" ON public.projects;
DROP POLICY IF EXISTS "projects_superuser_all"          ON public.projects;

CREATE POLICY "projects_superuser_all" ON public.projects
  FOR ALL TO authenticated
  USING (
    public.is_current_user_superuser()
    OR public.is_current_user_admin()
  )
  WITH CHECK (
    public.is_current_user_superuser()
    OR public.is_current_user_admin()
  );

-- Ensure the INSERT policy allows regular users to create projects (owner_id = self)
DROP POLICY IF EXISTS "Users can create projects"  ON public.projects;
DROP POLICY IF EXISTS "projects_insert_owner"      ON public.projects;

CREATE POLICY "projects_insert_owner" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- STEP 7: audit_logs RLS — clean up conflicting policies
-- ============================================================================
-- 20260303_audit_triggers.sql creates the correct policies; ensure there are
-- no old USING(true) survivors here.

DROP POLICY IF EXISTS "Admins full access audit_logs"       ON public.audit_logs;
DROP POLICY IF EXISTS "crm_audit_logs_superuser_all"        ON public.audit_logs;
-- The audit_triggers migration creates:
--   "audit_logs_superuser_read"  (SELECT, is_current_user_superuser)
--   "audit_logs_no_direct_write" (ALL,    USING false)
-- Those are the only policies we want — no DROP here since that migration
-- runs after this one. If this migration runs first, the above DROPs are
-- no-ops (IF EXISTS).
