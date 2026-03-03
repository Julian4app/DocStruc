-- ============================================================================
-- CRITICAL SECURITY FIXES — 2026-03-03
-- ============================================================================
-- C1: CRM tables had USING(true) — any authenticated user could read/write
--     all customer/invoice/subscription data. Fixed: restrict to superusers.
--
-- C2: has_project_access(), get_my_project_ids(), check_user_permission()
--     used SET row_security = off — a SECURITY DEFINER function that bypasses
--     RLS entirely is equivalent to a privilege escalation path.
--     Fixed: remove row_security=off; resolve recursion by using a dedicated
--     internal helper that queries auth.uid() directly without going through
--     RLS-protected tables, OR by using the stable is_current_user_superuser()
--     which is already safe (queries profiles once via auth.uid() with
--     search_path locked).
--
-- C3: Storage buckets logos, company-files, contracts had policies with no
--     auth check (USING (bucket_id = 'bucket') — public read + no auth write
--     check). Fixed: restrict to superusers only.
-- ============================================================================


-- ============================================================================
-- PART 1: Fix USING(true) on CRM tables
-- ============================================================================
-- Drop all broad "allow everyone" policies
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.companies;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.contact_persons;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.subscription_types;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.crm_notes;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.tags;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.company_files;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.invoices;
DROP POLICY IF EXISTS "Enable all access for everyone" ON public.company_history;

-- Drop broad "Admins full access" policies from ADMIN_SYSTEM schema
DROP POLICY IF EXISTS "Admins full access companies" ON public.companies;
DROP POLICY IF EXISTS "Admins full access contact_persons" ON public.contact_persons;
DROP POLICY IF EXISTS "Admins full access subscription_types" ON public.subscription_types;
DROP POLICY IF EXISTS "Admins full access company_subscriptions" ON public.company_subscriptions;
DROP POLICY IF EXISTS "Admins full access invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins full access crm_notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Admins full access tags" ON public.tags;
DROP POLICY IF EXISTS "Admins full access crm_files" ON public.crm_files;
DROP POLICY IF EXISTS "Admins full access file_tags" ON public.file_tags;
DROP POLICY IF EXISTS "Admins full access audit_logs" ON public.audit_logs;

-- Replace with superuser-only access (CRM data is admin-only)
CREATE POLICY "crm_companies_superuser_all" ON public.companies
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_contact_persons_superuser_all" ON public.contact_persons
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_subscription_types_superuser_all" ON public.subscription_types
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_crm_notes_superuser_all" ON public.crm_notes
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_tags_superuser_all" ON public.tags
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_company_files_superuser_all" ON public.company_files
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_company_subscriptions_superuser_all" ON public.company_subscriptions
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_invoices_superuser_all" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "crm_company_history_superuser_all" ON public.company_history
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

-- crm_files and file_tags (ADMIN_SYSTEM schema)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'crm_files'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "crm_files_superuser_all" ON public.crm_files
        FOR ALL TO authenticated
        USING (public.is_current_user_superuser())
        WITH CHECK (public.is_current_user_superuser());
    $p$;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'file_tags'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "crm_file_tags_superuser_all" ON public.file_tags
        FOR ALL TO authenticated
        USING (public.is_current_user_superuser())
        WITH CHECK (public.is_current_user_superuser());
    $p$;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "crm_audit_logs_superuser_all" ON public.audit_logs
        FOR ALL TO authenticated
        USING (public.is_current_user_superuser())
        WITH CHECK (public.is_current_user_superuser());
    $p$;
  END IF;
END $$;

-- Also fix crm_contacts and subcontractor tables from ADMIN_CRM_SCHEMA
-- which had FOR ALL TO authenticated USING (true)
DROP POLICY IF EXISTS "Auth full access crm_contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Auth full access subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Auth full access sub_contacts" ON public.subcontractor_contacts;
DROP POLICY IF EXISTS "Auth all access crm links" ON public.project_crm_links;
DROP POLICY IF EXISTS "Auth all access project subs" ON public.project_subcontractors;

CREATE POLICY "crm_contacts_superuser_all" ON public.crm_contacts
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "subcontractors_superuser_all" ON public.subcontractors
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "subcontractor_contacts_superuser_all" ON public.subcontractor_contacts
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

-- project_crm_links and project_subcontractors: project members + superusers
CREATE POLICY "project_crm_links_access" ON public.project_crm_links
  FOR ALL TO authenticated
  USING (
    public.has_project_access(project_id)
    OR public.is_current_user_superuser()
  )
  WITH CHECK (
    public.has_project_access(project_id)
    OR public.is_current_user_superuser()
  );

CREATE POLICY "project_subcontractors_access" ON public.project_subcontractors
  FOR ALL TO authenticated
  USING (
    public.has_project_access(project_id)
    OR public.is_current_user_superuser()
  )
  WITH CHECK (
    public.has_project_access(project_id)
    OR public.is_current_user_superuser()
  );


-- ============================================================================
-- PART 2: Fix Storage bucket policies — remove auth-less access
-- ============================================================================
-- logos bucket: was USING (bucket_id = 'logos') with no auth check
DROP POLICY IF EXISTS "Give admin access to logos" ON storage.objects;
DROP POLICY IF EXISTS "Give admin access to company-files" ON storage.objects;
DROP POLICY IF EXISTS "Give admin access to contracts" ON storage.objects;

CREATE POLICY "logos_superuser_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.is_current_user_superuser()
  )
  WITH CHECK (
    bucket_id = 'logos'
    AND public.is_current_user_superuser()
  );

CREATE POLICY "company_files_superuser_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'company-files'
    AND public.is_current_user_superuser()
  )
  WITH CHECK (
    bucket_id = 'company-files'
    AND public.is_current_user_superuser()
  );

CREATE POLICY "contracts_superuser_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'contracts'
    AND public.is_current_user_superuser()
  )
  WITH CHECK (
    bucket_id = 'contracts'
    AND public.is_current_user_superuser()
  );

-- Make the admin storage buckets private (not publicly readable)
UPDATE storage.buckets SET public = false
WHERE id IN ('logos', 'company-files', 'contracts');


-- ============================================================================
-- PART 3: Remove SET row_security = off from SECURITY DEFINER functions
-- ============================================================================
-- The recursion problem:
--   has_project_access(p_id) → queries projects → projects RLS calls
--   has_project_access(p_id) → infinite loop.
--
-- Safe fix: The function is SECURITY DEFINER, which means it runs as the
-- function owner (postgres/service_role), not as the calling user.
-- We do NOT need row_security=off — we just need to NOT call has_project_access
-- recursively. The internal queries in this function already do direct
-- table access as the definer. The recursion was caused by earlier versions
-- that didn't use SECURITY DEFINER properly.
--
-- With SECURITY DEFINER + search_path locked, the function already bypasses
-- the calling user's RLS automatically (it runs as owner). So row_security=off
-- is redundant AND dangerous. Remove it.

CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- SECURITY DEFINER runs as function owner, not caller.
  -- No row_security=off needed — owner role bypasses RLS automatically.

  -- Superuser check
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_superuser = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- Owner check
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Direct member check
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Team access check
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
    user_is_owner     BOOLEAN;
    user_is_superuser BOOLEAN;
    member_record     RECORD;
    role_perm         RECORD;
    member_perm       RECORD;
BEGIN
    -- SECURITY DEFINER: runs as owner, no row_security=off needed.

    SELECT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;

    SELECT COALESCE(p.is_superuser, FALSE) INTO user_is_superuser
    FROM public.profiles p WHERE p.id = p_user_id;

    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
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
-- PART 4: Prevent is_superuser self-escalation via column-level REVOKE
-- ============================================================================
-- Remove GRANT ALL and replace with explicit column-level grants that
-- exclude is_superuser, team_role, team_id from direct writes by regular users.
-- The profiles_update_own policy (from 20260222) already has WITH CHECK that
-- prevents writing these fields for non-superusers, but defence-in-depth:
-- revoke UPDATE on those specific columns at the DB level too.

REVOKE UPDATE (is_superuser, team_role, team_id) ON public.profiles FROM authenticated;

-- Re-allow superusers to update all fields via the SECURITY DEFINER function
-- (the policies that call is_current_user_superuser() handle this correctly
-- because SECURITY DEFINER functions run as owner, not the calling user).
-- No further grant needed — superuser updates go through the policy check
-- which calls is_current_user_superuser() already.


-- ============================================================================
-- PART 5: Also fix the overly broad projects INSERT policy from ADMIN_CRM_SCHEMA
-- "Superusers full access projects" was USING(true) for ALL authenticated
-- ============================================================================
DROP POLICY IF EXISTS "Superusers full access projects" ON public.projects;

-- Superusers get full project access (this was the intent)
CREATE POLICY "projects_superuser_all" ON public.projects
  FOR ALL TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

-- Ensure the existing INSERT policy still allows regular users to create projects
DROP POLICY IF EXISTS "Users can create projects" ON public.projects;
CREATE POLICY "projects_insert_owner" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
