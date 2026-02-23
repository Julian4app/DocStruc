-- ============================================================================
-- RLS MODULE PERMISSION ENFORCEMENT
-- ============================================================================
-- Replace all SELECT policies that use has_project_access() with
-- check_user_permission() on every data table.
--
-- RESULT: Role-based module access is enforced at the database level,
-- so mobile apps, direct API calls, and any client that bypasses the
-- React PermissionGuard are still properly restricted.
--
-- CRITICAL EXCLUSIONS (must keep has_project_access to avoid recursion):
--   - project_members  ← check_user_permission reads this table internally
--   - projects         ← owner logic is inside check_user_permission
--   - profiles         ← public read is intentional (collaboration joins)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: map task_type → module key
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_task_module_key(p_task_type TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE WHEN p_task_type = 'defect' THEN 'defects' ELSE 'tasks' END;
$$;

GRANT EXECUTE ON FUNCTION public.get_task_module_key(TEXT) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- TASKS (tasks + defects)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tasks', pol.policyname);
    RAISE NOTICE 'Dropped tasks policy: %', pol.policyname;
  END LOOP;
END $$;

-- SELECT: check view permission for tasks OR defects depending on task_type
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(
      auth.uid(),
      project_id,
      public.get_task_module_key(COALESCE(task_type, 'task')),
      'view'
    )
  );

-- INSERT: check create permission
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(
      auth.uid(),
      project_id,
      public.get_task_module_key(COALESCE(task_type, 'task')),
      'create'
    )
  );

-- UPDATE: check edit permission
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(
      auth.uid(),
      project_id,
      public.get_task_module_key(COALESCE(task_type, 'task')),
      'edit'
    )
  );

-- DELETE: check delete permission
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(
      auth.uid(),
      project_id,
      public.get_task_module_key(COALESCE(task_type, 'task')),
      'delete'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK_IMAGES (inherits from parent task's module)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_images'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_images', pol.policyname);
    RAISE NOTICE 'Dropped task_images policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY task_images_select ON public.task_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_images.task_id
        AND public.check_user_permission(
              auth.uid(), t.project_id,
              public.get_task_module_key(COALESCE(t.task_type, 'task')),
              'view')
    )
  );

CREATE POLICY task_images_insert ON public.task_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_images.task_id
        AND public.check_user_permission(
              auth.uid(), t.project_id,
              public.get_task_module_key(COALESCE(t.task_type, 'task')),
              'create')
    )
  );

CREATE POLICY task_images_delete ON public.task_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_images.task_id
        AND public.check_user_permission(
              auth.uid(), t.project_id,
              public.get_task_module_key(COALESCE(t.task_type, 'task')),
              'delete')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TASK_DOCUMENTATION
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'task_documentation'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.task_documentation', pol.policyname);
    RAISE NOTICE 'Dropped task_documentation policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY task_documentation_select ON public.task_documentation
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'view')
  );

CREATE POLICY task_documentation_insert ON public.task_documentation
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'create')
  );

CREATE POLICY task_documentation_update ON public.task_documentation
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'edit')
  );

CREATE POLICY task_documentation_delete ON public.task_documentation
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DIARY_ENTRIES
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'diary_entries'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.diary_entries', pol.policyname);
    RAISE NOTICE 'Dropped diary_entries policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY diary_entries_select ON public.diary_entries
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'diary', 'view')
  );

CREATE POLICY diary_entries_insert ON public.diary_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'diary', 'create')
  );

CREATE POLICY diary_entries_update ON public.diary_entries
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'diary', 'edit')
  );

CREATE POLICY diary_entries_delete ON public.diary_entries
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'diary', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- TIMELINE_EVENTS (schedule)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'timeline_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.timeline_events', pol.policyname);
    RAISE NOTICE 'Dropped timeline_events policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY timeline_events_select ON public.timeline_events
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'schedule', 'view')
  );

CREATE POLICY timeline_events_insert ON public.timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'schedule', 'create')
  );

CREATE POLICY timeline_events_update ON public.timeline_events
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'schedule', 'edit')
  );

CREATE POLICY timeline_events_delete ON public.timeline_events
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'schedule', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECT_FILES + PROJECT_FOLDERS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_files'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_files', pol.policyname);
    RAISE NOTICE 'Dropped project_files policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_files_select ON public.project_files
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'files', 'view')
  );

CREATE POLICY project_files_insert ON public.project_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'files', 'create')
  );

CREATE POLICY project_files_update ON public.project_files
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'files', 'edit')
  );

CREATE POLICY project_files_delete ON public.project_files
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'files', 'delete')
  );

-- project_folders
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_folders'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_folders', pol.policyname);
    RAISE NOTICE 'Dropped project_folders policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_folders_select ON public.project_folders
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'files', 'view')
  );

CREATE POLICY project_folders_insert ON public.project_folders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'files', 'create')
  );

CREATE POLICY project_folders_update ON public.project_folders
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'files', 'edit')
  );

CREATE POLICY project_folders_delete ON public.project_folders
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'files', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECT_MESSAGES (communication)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_messages', pol.policyname);
    RAISE NOTICE 'Dropped project_messages policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_messages_select ON public.project_messages
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'communication', 'view')
  );

CREATE POLICY project_messages_insert ON public.project_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'communication', 'create')
  );

CREATE POLICY project_messages_update ON public.project_messages
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.check_user_permission(auth.uid(), project_id, 'communication', 'edit')
  );

CREATE POLICY project_messages_delete ON public.project_messages
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.check_user_permission(auth.uid(), project_id, 'communication', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECT_INFO (general_info)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_info'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_info', pol.policyname);
    RAISE NOTICE 'Dropped project_info policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_info_select ON public.project_info
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'general_info', 'view')
  );

CREATE POLICY project_info_insert ON public.project_info
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'general_info', 'create')
  );

CREATE POLICY project_info_update ON public.project_info
  FOR UPDATE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'general_info', 'edit')
  );

CREATE POLICY project_info_delete ON public.project_info
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'general_info', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECT_INFO_IMAGES (general_info)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_info_images'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_info_images', pol.policyname);
    RAISE NOTICE 'Dropped project_info_images policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY project_info_images_select ON public.project_info_images
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_info pi
      WHERE pi.id = project_info_images.project_info_id
        AND public.check_user_permission(auth.uid(), pi.project_id, 'general_info', 'view')
    )
  );

CREATE POLICY project_info_images_insert ON public.project_info_images
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_info pi
      WHERE pi.id = project_info_images.project_info_id
        AND public.check_user_permission(auth.uid(), pi.project_id, 'general_info', 'create')
    )
  );

CREATE POLICY project_info_images_delete ON public.project_info_images
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_info pi
      WHERE pi.id = project_info_images.project_info_id
        AND public.check_user_permission(auth.uid(), pi.project_id, 'general_info', 'delete')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- BUILDING TABLES (documentation / Objektplan)
-- ─────────────────────────────────────────────────────────────────────────────

-- building_staircases
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'building_staircases'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.building_staircases', pol.policyname);
    RAISE NOTICE 'Dropped building_staircases policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY building_staircases_select ON public.building_staircases
  FOR SELECT TO authenticated
  USING (public.check_user_permission(auth.uid(), project_id, 'documentation', 'view'));

CREATE POLICY building_staircases_insert ON public.building_staircases
  FOR INSERT TO authenticated
  WITH CHECK (public.check_user_permission(auth.uid(), project_id, 'documentation', 'create'));

CREATE POLICY building_staircases_update ON public.building_staircases
  FOR UPDATE TO authenticated
  USING (public.check_user_permission(auth.uid(), project_id, 'documentation', 'edit'));

CREATE POLICY building_staircases_delete ON public.building_staircases
  FOR DELETE TO authenticated
  USING (public.check_user_permission(auth.uid(), project_id, 'documentation', 'delete'));

-- building_floors
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'building_floors'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.building_floors', pol.policyname);
    RAISE NOTICE 'Dropped building_floors policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY building_floors_select ON public.building_floors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.building_staircases bs
      WHERE bs.id = building_floors.staircase_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'view')
    )
  );

CREATE POLICY building_floors_insert ON public.building_floors
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.building_staircases bs
      WHERE bs.id = building_floors.staircase_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'create')
    )
  );

CREATE POLICY building_floors_update ON public.building_floors
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.building_staircases bs
      WHERE bs.id = building_floors.staircase_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'edit')
    )
  );

CREATE POLICY building_floors_delete ON public.building_floors
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.building_staircases bs
      WHERE bs.id = building_floors.staircase_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'delete')
    )
  );

-- building_apartments
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'building_apartments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.building_apartments', pol.policyname);
    RAISE NOTICE 'Dropped building_apartments policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY building_apartments_select ON public.building_apartments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.building_floors bf
        JOIN public.building_staircases bs ON bs.id = bf.staircase_id
      WHERE bf.id = building_apartments.floor_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'view')
    )
  );

CREATE POLICY building_apartments_insert ON public.building_apartments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.building_floors bf
        JOIN public.building_staircases bs ON bs.id = bf.staircase_id
      WHERE bf.id = building_apartments.floor_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'create')
    )
  );

CREATE POLICY building_apartments_update ON public.building_apartments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.building_floors bf
        JOIN public.building_staircases bs ON bs.id = bf.staircase_id
      WHERE bf.id = building_apartments.floor_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'edit')
    )
  );

CREATE POLICY building_apartments_delete ON public.building_apartments
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.building_floors bf
        JOIN public.building_staircases bs ON bs.id = bf.staircase_id
      WHERE bf.id = building_apartments.floor_id
        AND public.check_user_permission(auth.uid(), bs.project_id, 'documentation', 'delete')
    )
  );

-- building_attachments
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'building_attachments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.building_attachments', pol.policyname);
    RAISE NOTICE 'Dropped building_attachments policy: %', pol.policyname;
  END LOOP;
END $$;

CREATE POLICY building_attachments_select ON public.building_attachments
  FOR SELECT TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'view')
  );

CREATE POLICY building_attachments_insert ON public.building_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'create')
  );

CREATE POLICY building_attachments_delete ON public.building_attachments
  FOR DELETE TO authenticated
  USING (
    public.check_user_permission(auth.uid(), project_id, 'documentation', 'delete')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEDULE_ENTRIES (if table exists — separate from timeline_events)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'schedule_entries') THEN

    -- Drop all existing policies
    DECLARE pol RECORD;
    BEGIN
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'schedule_entries'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.schedule_entries', pol.policyname);
      END LOOP;
    END;

    EXECUTE 'CREATE POLICY schedule_entries_select ON public.schedule_entries
      FOR SELECT TO authenticated
      USING (public.check_user_permission(auth.uid(), project_id, ''schedule'', ''view''))';

    EXECUTE 'CREATE POLICY schedule_entries_insert ON public.schedule_entries
      FOR INSERT TO authenticated
      WITH CHECK (public.check_user_permission(auth.uid(), project_id, ''schedule'', ''create''))';

    EXECUTE 'CREATE POLICY schedule_entries_update ON public.schedule_entries
      FOR UPDATE TO authenticated
      USING (public.check_user_permission(auth.uid(), project_id, ''schedule'', ''edit''))';

    EXECUTE 'CREATE POLICY schedule_entries_delete ON public.schedule_entries
      FOR DELETE TO authenticated
      USING (public.check_user_permission(auth.uid(), project_id, ''schedule'', ''delete''))';

    RAISE NOTICE 'schedule_entries policies updated';
  ELSE
    RAISE NOTICE 'schedule_entries table not found — skipped';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FILE_VERSIONS + FILE_SHARES (files module)
-- ─────────────────────────────────────────────────────────────────────────────

-- file_versions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'file_versions') THEN

    DECLARE pol RECORD;
    BEGIN
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'file_versions'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.file_versions', pol.policyname);
      END LOOP;
    END;

    EXECUTE 'CREATE POLICY file_versions_select ON public.file_versions
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          WHERE pf.id = file_versions.file_id
            AND public.check_user_permission(auth.uid(), pf.project_id, ''files'', ''view'')
        )
      )';

    EXECUTE 'CREATE POLICY file_versions_insert ON public.file_versions
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          WHERE pf.id = file_versions.file_id
            AND public.check_user_permission(auth.uid(), pf.project_id, ''files'', ''create'')
        )
      )';

    EXECUTE 'CREATE POLICY file_versions_delete ON public.file_versions
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          WHERE pf.id = file_versions.file_id
            AND public.check_user_permission(auth.uid(), pf.project_id, ''files'', ''delete'')
        )
      )';

    RAISE NOTICE 'file_versions policies updated';
  ELSE
    RAISE NOTICE 'file_versions table not found — skipped';
  END IF;
END $$;

-- file_shares
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'file_shares') THEN

    DECLARE pol RECORD;
    BEGIN
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'file_shares'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.file_shares', pol.policyname);
      END LOOP;
    END;

    EXECUTE 'CREATE POLICY file_shares_select ON public.file_shares
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          WHERE pf.id = file_shares.file_id
            AND public.check_user_permission(auth.uid(), pf.project_id, ''files'', ''view'')
        )
      )';

    EXECUTE 'CREATE POLICY file_shares_insert ON public.file_shares
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.project_files pf
          WHERE pf.id = file_shares.file_id
            AND public.check_user_permission(auth.uid(), pf.project_id, ''files'', ''create'')
        )
      )';

    EXECUTE 'CREATE POLICY file_shares_delete ON public.file_shares
      FOR DELETE TO authenticated
      USING (
        shared_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.project_files pf
          WHERE pf.id = file_shares.file_id
            AND public.check_user_permission(auth.uid(), pf.project_id, ''files'', ''delete'')
        )
      )';

    RAISE NOTICE 'file_shares policies updated';
  ELSE
    RAISE NOTICE 'file_shares table not found — skipped';
  END IF;
END $$;
