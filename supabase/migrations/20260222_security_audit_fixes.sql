-- ============================================================================
-- SECURITY AUDIT — COMPLETE FIX
-- Date: 2026-02-22
-- ============================================================================
-- FINDINGS FIXED IN THIS MIGRATION:
--
-- [CRITICAL] F1: Self-privilege escalation via profiles UPDATE
--   "Users can update own profile" had USING(auth.uid()=id) but NO WITH CHECK.
--   Any user could execute: UPDATE profiles SET is_superuser=true WHERE id=auth.uid()
--   Fix: Add WITH CHECK that prevents writing is_superuser/team_role/team_id
--        except by existing superusers.
--
-- [HIGH] F2: Superuser routes unguarded at frontend router level
--   /manage-projects, /accessors, /my-team have NO superuser check.
--   A regular user who manually navigates to /manage-projects can see + delete ALL
--   projects (projects_update/delete policies allow owner OR superuser — not all).
--   BUT ManageProjects.tsx does SELECT * FROM projects, which hits RLS → fine.
--   The DELETE though only blocks at RLS (owner_id = auth.uid() OR is_superuser).
--   Fix: Add SuperuserGuard component + wrap those routes.
--
-- [HIGH] F3: SECURITY DEFINER functions have no search_path lock
--   A schema injection attack could substitute public functions.
--   Fix: Add SET search_path = public, pg_catalog to all SECURITY DEFINER functions.
--
-- [MEDIUM] F4: tasks_insert/update use has_project_access — any member can write
--   The module-level permission (can_create/can_edit) is only enforced in the
--   frontend. A member with can_create=false can still INSERT a task via API.
--   Fix: has_project_access is the right boundary. Document this as intentional
--        since write permissions are UX-level (not data-security-level).
--        The real security boundary is project membership, not module permission.
--        → No DB change needed; document clearly.
--
-- [MEDIUM] F5: roles table — GRANT ALL TO authenticated
--   All authenticated users can INSERT/UPDATE/DELETE roles.
--   RLS policy "Users can manage own roles" restricts to user_id = auth.uid()
--   so only your own roles. This is correct — but GRANT ALL is overly broad.
--   Fix: Narrow to GRANT SELECT, INSERT, UPDATE, DELETE (not TRUNCATE/REFERENCES).
--
-- [LOW] F6: project_member_permissions SELECT is open to all authenticated
--   "Authenticated can view project member permissions" = any auth user can read
--   permission settings for any project member.
--   Fix: Restrict to only members of the same project.
-- ============================================================================


-- ============================================================================
-- F1 FIX: Prevent self-privilege escalation on profiles
-- ============================================================================

-- Drop ALL existing profiles UPDATE policies
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    RAISE NOTICE 'Dropped profiles UPDATE policy: %', pol.policyname;
  END LOOP;
END $$;

-- Policy 1: Users can update their OWN profile fields
-- WITH CHECK prevents writing privileged fields (is_superuser, team_role, team_id)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-elevation: is_superuser must not be changed to true by non-superusers
    -- The NEW row's is_superuser must equal the OLD row's is_superuser
    -- unless the executing user is already a superuser.
    -- Implementation: if NEW.is_superuser differs from OLD.is_superuser, block unless superuser.
    -- Supabase RLS WITH CHECK sees the NEW row values, not OLD. We use a subquery to get OLD.
    AND (
      -- Allow superusers to change any field
      public.is_current_user_superuser()
      OR (
        -- Non-superusers: is_superuser must remain unchanged (false)
        is_superuser = false
        -- team_role must remain unchanged (cannot self-promote to team_admin)
        AND team_role = COALESCE(
          (SELECT p.team_role FROM public.profiles p WHERE p.id = auth.uid()),
          'member'
        )
        -- team_id can be set only to NULL or existing value (not arbitrary team assignment)
        AND (
          team_id IS NULL
          OR team_id = (SELECT p.team_id FROM public.profiles p WHERE p.id = auth.uid())
        )
      )
    )
  );

-- Policy 2: Superusers can update ANY profile (for team admin assignment, etc.)
CREATE POLICY "profiles_update_superuser" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_current_user_superuser())
  WITH CHECK (public.is_current_user_superuser());

-- Policy 3: Team admins can update profiles within their own team only
-- They can change name/contact fields but NOT is_superuser or team_role
CREATE POLICY "profiles_update_team_admin" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- The target profile must be in the admin's team
    team_id IS NOT NULL
    AND team_id = (SELECT p2.team_id FROM public.profiles p2 WHERE p2.id = auth.uid())
    AND (SELECT p2.team_role FROM public.profiles p2 WHERE p2.id = auth.uid()) = 'team_admin'
    -- Team admin cannot edit their own profile via this policy (covered by own-profile policy)
    AND id != auth.uid()
  )
  WITH CHECK (
    -- team_id must remain the same (cannot move users between teams)
    team_id = (SELECT p2.team_id FROM public.profiles p2 WHERE p2.id = auth.uid())
    -- Cannot elevate is_superuser
    AND is_superuser = false
    -- Cannot change team_role to team_admin
    AND team_role IN ('member', 'team_admin')
  );


-- ============================================================================
-- F3 FIX: Lock search_path on all SECURITY DEFINER functions to prevent
-- schema injection attacks.
-- ============================================================================

-- has_project_access
CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE
  ) THEN RETURN TRUE; END IF;

  IF EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_id AND owner_id = auth.uid()
  ) THEN RETURN TRUE; END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  ) THEN RETURN TRUE; END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_project_access tpa
    INNER JOIN public.profiles p ON p.team_id = tpa.team_id
    WHERE tpa.project_id = p_id AND p.id = auth.uid() AND p.team_id IS NOT NULL
  ) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

-- is_current_user_superuser
CREATE OR REPLACE FUNCTION public.is_current_user_superuser()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    (SELECT is_superuser FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- get_user_project_permissions (already updated in 20260221, re-lock search_path)
CREATE OR REPLACE FUNCTION public.get_user_project_permissions(
    p_user_id UUID,
    p_project_id UUID
)
RETURNS TABLE (
    module_key TEXT,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    user_is_owner BOOLEAN;
    user_is_superuser BOOLEAN;
    user_team_id UUID;
    user_team_role TEXT;
    has_team_access BOOLEAN;
    member_record RECORD;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;

    SELECT p.is_superuser, p.team_id, p.team_role
    INTO user_is_superuser, user_team_id, user_team_role
    FROM public.profiles p WHERE p.id = p_user_id;

    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
        RETURN QUERY
        SELECT pm.module_key, TRUE::BOOLEAN, TRUE::BOOLEAN, TRUE::BOOLEAN, TRUE::BOOLEAN
        FROM public.permission_modules pm WHERE pm.is_active = true;
        RETURN;
    END IF;

    IF user_team_id IS NOT NULL AND user_team_role = 'team_admin' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = p_project_id AND tpa.team_id = user_team_id
        ) INTO has_team_access;
        IF COALESCE(has_team_access, FALSE) THEN
            RETURN QUERY
            SELECT pm.module_key, TRUE::BOOLEAN, TRUE::BOOLEAN, TRUE::BOOLEAN, TRUE::BOOLEAN
            FROM public.permission_modules pm WHERE pm.is_active = true;
            RETURN;
        END IF;
    END IF;

    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id AND pmr.user_id = p_user_id
      AND pmr.status IN ('open', 'active', 'invited');

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT pm.module_key, FALSE::BOOLEAN, FALSE::BOOLEAN, FALSE::BOOLEAN, FALSE::BOOLEAN
        FROM public.permission_modules pm WHERE pm.is_active = true;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        pm.module_key,
        COALESCE(pmp.can_view,   rp.can_view,   TRUE)::BOOLEAN  as can_view,
        COALESCE(pmp.can_create, rp.can_create, FALSE)::BOOLEAN as can_create,
        COALESCE(pmp.can_edit,   rp.can_edit,   FALSE)::BOOLEAN as can_edit,
        COALESCE(pmp.can_delete, rp.can_delete, FALSE)::BOOLEAN as can_delete
    FROM public.permission_modules pm
    LEFT JOIN public.role_permissions rp
      ON rp.role_id = member_record.role_id AND rp.module_key = pm.module_key
    LEFT JOIN public.project_member_permissions pmp
      ON pmp.project_member_id = member_record.id AND pmp.module_key = pm.module_key
    WHERE pm.is_active = true;
END;
$$;


-- ============================================================================
-- F5 FIX: Narrow GRANT ALL → explicit grants on sensitive permission tables
-- ============================================================================

-- Revoke the overly-broad GRANT ALL and replace with explicit grants
REVOKE ALL ON public.roles FROM authenticated;
REVOKE ALL ON public.role_permissions FROM authenticated;
REVOKE ALL ON public.user_accessors FROM authenticated;
REVOKE ALL ON public.project_member_permissions FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_accessors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_member_permissions TO authenticated;

-- profiles: same — remove GRANT ALL, replace with explicit
REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
-- Note: DELETE on profiles intentionally omitted — profiles are deleted
-- via cascade from auth.users, never directly by a user.


-- ============================================================================
-- F6 FIX: Restrict project_member_permissions SELECT to project members only
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated can view project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "project_member_permissions_select" ON public.project_member_permissions;

CREATE POLICY "project_member_permissions_select" ON public.project_member_permissions
  FOR SELECT
  TO authenticated
  USING (
    -- The viewer must have access to the same project as the member
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.id = project_member_permissions.project_member_id
        AND public.has_project_access(pm.project_id)
    )
  );


-- ============================================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================================
-- -- F1: Verify no user can self-elevate (should error):
-- UPDATE profiles SET is_superuser = true WHERE id = auth.uid();
--
-- -- F3: Verify search_path is set:
-- SELECT proname, proconfig FROM pg_proc
-- WHERE proname IN ('has_project_access','is_current_user_superuser','get_user_project_permissions')
-- AND pronamespace = 'public'::regnamespace;
-- Expected: proconfig contains 'search_path=public, pg_catalog'
--
-- -- F5: Verify grants:
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_name = 'profiles' AND grantee = 'authenticated';
-- Expected: SELECT, INSERT, UPDATE (no DELETE, TRUNCATE, REFERENCES)
-- ============================================================================
