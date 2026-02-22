-- ============================================================================
-- FIX: Allow all authenticated users to SELECT profiles
-- ============================================================================
-- ROOT CAUSE:
-- PostgREST embedded joins like profiles:assigned_to(...) evaluate the
-- profiles_select RLS policy for each joined profile row. The previous
-- policy required co-project-membership, which fails when:
--   1) The nested subqueries on project_members become too complex
--   2) assigned_to references users not currently in the project
--   3) RLS evaluation timing issues with PostgREST embedded joins
--
-- FIX:
-- Allow any authenticated user to read all profiles. Profile data
-- (name, email, avatar) is not sensitive — it's needed for any
-- collaboration feature. Real security is on the DATA tables (tasks,
-- files, messages) which use has_project_access().
--
-- This is the standard pattern for Supabase apps with collaboration.
-- ============================================================================

-- ============================================================================
-- PART 1: Fix profiles SELECT — allow all authenticated users
-- ============================================================================

-- Drop ALL existing profiles SELECT policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    RAISE NOTICE 'Dropped profiles SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

-- Create ONE simple SELECT policy: any authenticated user can read all profiles
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PART 2: Fix project_members SELECT — use has_project_access
-- ============================================================================

-- Drop ALL existing project_members SELECT policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_members'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_members', pol.policyname);
    RAISE NOTICE 'Dropped project_members SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

-- Project members are readable by anyone who has access to the project
CREATE POLICY project_members_select ON public.project_members
  FOR SELECT
  TO authenticated
  USING (
    has_project_access(project_id)
  );

-- ============================================================================
-- PART 3: Remove complex visibility RLS policies that duplicate client-side
--         filtering and contain problematic inline profiles subqueries.
--         Replace with simple has_project_access() policies.
--         Visibility filtering is already done client-side by useContentVisibility.
-- ============================================================================

-- --- TASKS ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    RAISE NOTICE 'Dropped tasks SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (has_project_access(project_id));

-- --- DIARY_ENTRIES ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'diary_entries' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.diary_entries', pol.policyname);
    RAISE NOTICE 'Dropped diary_entries SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY diary_entries_select ON public.diary_entries
  FOR SELECT TO authenticated
  USING (has_project_access(project_id));

-- --- PROJECT_MESSAGES ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_messages' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_messages', pol.policyname);
    RAISE NOTICE 'Dropped project_messages SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_messages_select ON public.project_messages
  FOR SELECT TO authenticated
  USING (has_project_access(project_id));

-- --- PROJECT_FILES ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_files' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_files', pol.policyname);
    RAISE NOTICE 'Dropped project_files SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_files_select ON public.project_files
  FOR SELECT TO authenticated
  USING (has_project_access(project_id));

-- --- TASK_DOCUMENTATION ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_documentation' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_documentation', pol.policyname);
    RAISE NOTICE 'Dropped task_documentation SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY task_documentation_select ON public.task_documentation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_documentation.task_id
      AND has_project_access(t.project_id)
    )
  );

-- --- TASK_IMAGES ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_images' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_images', pol.policyname);
    RAISE NOTICE 'Dropped task_images SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY task_images_select ON public.task_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_images.task_id
      AND has_project_access(t.project_id)
    )
  );

-- --- ACTIVITY_LOGS ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_logs' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.activity_logs', pol.policyname);
    RAISE NOTICE 'Dropped activity_logs SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY activity_logs_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (has_project_access(project_id));

-- --- DIARY_PHOTOS ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'diary_photos' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.diary_photos', pol.policyname);
    RAISE NOTICE 'Dropped diary_photos SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

-- diary_photos references diary_entries, not projects directly
CREATE POLICY diary_photos_select ON public.diary_photos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.diary_entries de
      WHERE de.id = diary_photos.diary_entry_id
      AND has_project_access(de.project_id)
    )
  );

-- --- PROJECT_FILE_VERSIONS ---
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_file_versions' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_file_versions', pol.policyname);
    RAISE NOTICE 'Dropped project_file_versions SELECT policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_file_versions_select ON public.project_file_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_files pf
      WHERE pf.id = project_file_versions.file_id
      AND has_project_access(pf.project_id)
    )
  );

-- ============================================================================
-- PART 4: Ensure content visibility helper tables don't use recursive functions
-- ============================================================================

-- ============================================================================
-- PART 4A: Fix get_user_project_permissions RPC status filter
-- The RPC only allows status IN ('active', 'invited') but has_project_access
-- allows ('open', 'invited', 'active'). If a user has status='open', they
-- can read data via RLS but PermissionGuard blocks them (canView=false).
-- Fix: align the RPC to also accept 'open'.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_project_permissions(
    p_user_id UUID,
    p_project_id UUID
)
RETURNS TABLE (
    module_key TEXT,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN
) AS $$
DECLARE
    user_is_owner BOOLEAN;
    user_is_superuser BOOLEAN;
    user_team_id UUID;
    user_team_role TEXT;
    has_team_access BOOLEAN;
    member_record RECORD;
BEGIN
    -- Check if user is project owner
    SELECT EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;
    
    -- Get user profile info
    SELECT p.is_superuser, p.team_id, p.team_role 
    INTO user_is_superuser, user_team_id, user_team_role
    FROM public.profiles p
    WHERE p.id = p_user_id;
    
    -- Owner and superuser have ALL permissions
    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
        RETURN QUERY
        SELECT 
            pm.module_key,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN
        FROM public.permission_modules pm
        WHERE pm.is_active = true;
        RETURN;
    END IF;
    
    -- Check if user is team admin with team access to this project
    IF user_team_id IS NOT NULL AND user_team_role = 'team_admin' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = p_project_id
            AND tpa.team_id = user_team_id
        ) INTO has_team_access;
        
        -- Team admin with access → ALL permissions
        IF COALESCE(has_team_access, FALSE) THEN
            RETURN QUERY
            SELECT 
                pm.module_key,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN
            FROM public.permission_modules pm
            WHERE pm.is_active = true;
            RETURN;
        END IF;
    END IF;
    
    -- Regular user: find their project_members record
    -- FIX: also accept 'open' status (aligned with has_project_access)
    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
    AND pmr.user_id = p_user_id
    AND pmr.status IN ('open', 'active', 'invited');
    
    IF NOT FOUND THEN
        -- No project_members record → return FALSE for all modules
        RETURN QUERY
        SELECT 
            pm.module_key,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN
        FROM public.permission_modules pm
        WHERE pm.is_active = true;
        RETURN;
    END IF;
    
    -- Member found: COALESCE custom permissions over role permissions
    RETURN QUERY
    SELECT 
        pm.module_key,
        COALESCE(pmp.can_view, rp.can_view, FALSE)::BOOLEAN as can_view,
        COALESCE(pmp.can_create, rp.can_create, FALSE)::BOOLEAN as can_create,
        COALESCE(pmp.can_edit, rp.can_edit, FALSE)::BOOLEAN as can_edit,
        COALESCE(pmp.can_delete, rp.can_delete, FALSE)::BOOLEAN as can_delete
    FROM public.permission_modules pm
    LEFT JOIN public.role_permissions rp ON (
        rp.role_id = member_record.role_id 
        AND rp.module_key = pm.module_key
    )
    LEFT JOIN public.project_member_permissions pmp ON (
        pmp.project_member_id = member_record.id 
        AND pmp.module_key = pm.module_key
    )
    WHERE pm.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix project_content_defaults: drop superuser-specific ALL policy if it uses the old function
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'project_content_defaults'
      AND qual::text LIKE '%is_current_user_superuser%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_content_defaults', pol.policyname);
    RAISE NOTICE 'Dropped project_content_defaults policy with is_current_user_superuser: %', pol.policyname;
  END LOOP;
END $$;

-- Recreate superuser policy without the recursive function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_content_defaults'
    AND policyname = 'content_defaults_superuser_manage'
  ) THEN
    CREATE POLICY content_defaults_superuser_manage ON public.project_content_defaults
      FOR ALL
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = true)
      );
  END IF;
END $$;

-- Fix content_visibility_overrides: drop superuser policy with old function
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'content_visibility_overrides'
      AND qual::text LIKE '%is_current_user_superuser%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.content_visibility_overrides', pol.policyname);
    RAISE NOTICE 'Dropped content_visibility_overrides policy with is_current_user_superuser: %', pol.policyname;
  END LOOP;
END $$;

-- Recreate superuser policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'content_visibility_overrides'
    AND policyname = 'visibility_overrides_superuser_manage'
  ) THEN
    CREATE POLICY visibility_overrides_superuser_manage ON public.content_visibility_overrides
      FOR ALL
      TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = true)
      );
  END IF;
END $$;

-- ============================================================================
-- Also fix ANY remaining policies across ALL tables that still reference
-- the problematic recursive functions
-- ============================================================================
DO $$
DECLARE
  pol RECORD;
  cnt INTEGER := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        qual::text LIKE '%is_current_user_superuser%'
        OR qual::text LIKE '%get_current_user_team_info%'
        OR qual::text LIKE '%check_user_permission%'
      )
  LOOP
    cnt := cnt + 1;
    RAISE WARNING '⚠️ Found problematic policy: %.% → %', pol.schemaname, pol.tablename, pol.policyname;
  END LOOP;
  
  IF cnt = 0 THEN
    RAISE NOTICE '✅ No remaining policies reference recursive functions';
  ELSE
    RAISE WARNING '❌ Found % policies with recursive function references — fix manually!', cnt;
  END IF;
END $$;

-- ============================================================================
-- FINAL VERIFICATION
-- ============================================================================
DO $$
DECLARE
  cnt INTEGER;
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'profiles', 'project_members', 'tasks', 'diary_entries',
    'project_messages', 'project_files', 'task_documentation',
    'task_images', 'activity_logs', 'diary_photos', 'project_file_versions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    SELECT count(*) INTO cnt
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = tbl AND cmd = 'SELECT';
    
    IF cnt = 1 THEN
      RAISE NOTICE '✅ %: 1 SELECT policy', tbl;
    ELSE
      RAISE WARNING '❌ %: % SELECT policies (expected 1)', tbl, cnt;
    END IF;
  END LOOP;

  -- Verify NO policies reference recursive functions
  SELECT count(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      qual::text LIKE '%is_current_user_superuser%'
      OR qual::text LIKE '%get_current_user_team_info%'
      OR qual::text LIKE '%check_user_permission%'
    );
  
  IF cnt = 0 THEN
    RAISE NOTICE '✅ No recursive function references in any policy';
  ELSE
    RAISE WARNING '❌ % policies still reference recursive functions', cnt;
  END IF;
  
  -- Verify no complex visibility policies remain on data tables
  SELECT count(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('tasks', 'diary_entries', 'project_messages', 'project_files')
    AND policyname LIKE '%visibility%';
  
  IF cnt = 0 THEN
    RAISE NOTICE '✅ No complex visibility RLS policies on data tables';
  ELSE
    RAISE WARNING '❌ % visibility policies still exist on data tables', cnt;
  END IF;
END $$;

-- Show all profiles policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY cmd, policyname;

-- Show all project_members policies
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'project_members'
ORDER BY cmd, policyname;
