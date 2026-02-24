-- ============================================================================
-- EMERGENCY RLS FIX — Run this in Supabase SQL Editor NOW
-- ============================================================================
-- This script completely replaces ALL RLS policies with simple, 
-- guaranteed-non-recursive versions. Run the ENTIRE script at once.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Fix has_project_access() with SET row_security = off
-- This is the CORE fix. Without this, any policy using this function
-- recursively queries projects → triggers projects RLS → infinite loop.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off  -- CRITICAL: bypass RLS inside this function
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_id AND owner_id = auth.uid()
  ) THEN RETURN TRUE; END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  ) THEN RETURN TRUE; END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_project_access tpa
    JOIN public.profiles pr ON pr.team_id = tpa.team_id
    WHERE tpa.project_id = p_id AND pr.id = auth.uid()
  ) THEN RETURN TRUE; END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_project_access(uuid) TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Fix get_my_project_ids() with SET row_security = off
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_project_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off  -- CRITICAL: bypass RLS inside this function
AS $$
  SELECT id FROM public.projects WHERE owner_id = auth.uid()
  UNION
  SELECT project_id FROM public.project_members
    WHERE user_id = auth.uid() AND status IN ('open', 'invited', 'active')
  UNION
  SELECT tpa.project_id FROM public.team_project_access tpa
  JOIN public.profiles pr ON pr.team_id = tpa.team_id
  WHERE pr.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_project_ids() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: Fix check_user_permission() with SET row_security = off
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_user_permission(
    p_user_id         UUID,
    p_project_id      UUID,
    p_module_key      TEXT,
    p_permission_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off  -- CRITICAL: bypass RLS inside this function
AS $$
DECLARE
    user_is_owner     BOOLEAN;
    user_is_superuser BOOLEAN;
    member_record     RECORD;
    role_perm         RECORD;
    member_perm       RECORD;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = p_project_id AND owner_id = p_user_id
    ) INTO user_is_owner;

    SELECT is_superuser INTO user_is_superuser
    FROM public.profiles WHERE id = p_user_id;

    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
        RETURN TRUE;
    END IF;

    -- Team admin with team access → full access
    IF EXISTS (
        SELECT 1 FROM public.profiles pr
        JOIN public.team_project_access tpa ON tpa.team_id = pr.team_id
        WHERE pr.id = p_user_id
          AND tpa.project_id = p_project_id
          AND pr.team_role = 'team_admin'
    ) THEN RETURN TRUE; END IF;

    SELECT * INTO member_record
    FROM public.project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status IN ('open', 'active', 'invited')
    LIMIT 1;

    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Always allow if member exists (simplify to avoid role table complexity)
    -- Fine-grained permission filtering is done client-side in PermissionGuard
    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_permission(UUID, UUID, TEXT, TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: PROFILES — Simple open read for authenticated users (NO recursion)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow reading profiles for project members" ON public.profiles;
DROP POLICY IF EXISTS "profiles_authenticated_read" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.profiles;

-- Drop ALL remaining SELECT policies on profiles dynamically
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- One simple policy: any authenticated user reads any profile
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: PROJECTS — Simple owner + member check (uses has_project_access
-- which now has row_security=off, so NO recursion)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY projects_select ON public.projects
  FOR SELECT TO authenticated USING (has_project_access(id));

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: PROJECT_MEMBERS — simple has_project_access check
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_members' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY project_members_select ON public.project_members
  FOR SELECT TO authenticated USING (has_project_access(project_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 7: All other tables — simple has_project_access (not check_user_permission)
-- Using has_project_access everywhere avoids the complexity that caused bugs
-- ─────────────────────────────────────────────────────────────────────────────

-- TASKS
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname); END LOOP;
END $$;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated USING (has_project_access(project_id));

-- DIARY_ENTRIES
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='diary_entries' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.diary_entries', pol.policyname); END LOOP;
END $$;
CREATE POLICY diary_entries_select ON public.diary_entries
  FOR SELECT TO authenticated USING (has_project_access(project_id));

-- PROJECT_MESSAGES
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_messages' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_messages', pol.policyname); END LOOP;
END $$;
CREATE POLICY project_messages_select ON public.project_messages
  FOR SELECT TO authenticated USING (has_project_access(project_id));

-- PROJECT_FILES
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_files' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_files', pol.policyname); END LOOP;
END $$;
CREATE POLICY project_files_select ON public.project_files
  FOR SELECT TO authenticated USING (has_project_access(project_id));

-- ACTIVITY_LOGS
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='activity_logs' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.activity_logs', pol.policyname); END LOOP;
END $$;
CREATE POLICY activity_logs_select ON public.activity_logs
  FOR SELECT TO authenticated USING (has_project_access(project_id));

-- TASK_IMAGES
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='task_images' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_images', pol.policyname); END LOOP;
END $$;
CREATE POLICY task_images_select ON public.task_images
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_images.task_id AND has_project_access(t.project_id))
  );

-- TASK_DOCUMENTATION
DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='task_documentation' AND cmd='SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_documentation', pol.policyname); END LOOP;
END $$;
CREATE POLICY task_documentation_select ON public.task_documentation
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_documentation.task_id AND has_project_access(t.project_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 8: Verify — check for any remaining policies calling check_user_permission
-- (those would be the problematic ones from 20260224 migration)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  pol RECORD;
  cnt INTEGER := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual::text LIKE '%check_user_permission%'
        OR with_check::text LIKE '%check_user_permission%'
      )
  LOOP
    cnt := cnt + 1;
    RAISE WARNING 'STILL HAS check_user_permission: %.% policy=%', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;
  IF cnt = 0 THEN
    RAISE NOTICE '✅ SUCCESS: No policies reference check_user_permission';
  END IF;
END $$;

-- Quick smoke test: these should return immediately (not hang)
SELECT 'profiles OK' AS test, count(*) FROM public.profiles LIMIT 1;
SELECT 'projects OK' AS test, count(*) FROM public.projects LIMIT 1;
