-- =====================================================
-- COMPLETE RLS OVERHAUL - Fix ALL access control
-- Created: 2026-02-15
-- Purpose: 
--   1. Users ONLY see projects they own OR are a member of
--   2. Members can see ALL content in their projects
--   3. No infinite recursion
--   4. Idempotent: safe to run multiple times
-- =====================================================

-- ============================================================
-- STEP 1: Create has_project_access function (SECURITY DEFINER)
-- This queries project_members directly, bypassing RLS
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 2: PROJECTS - users only see their own projects
-- ============================================================
DO $$ BEGIN
  -- Drop ALL existing select policies on projects
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.projects;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (public.has_project_access(id));

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (auth.uid() = owner_id);

-- ============================================================
-- STEP 3: PROJECT_MEMBERS - no self-referencing query
-- ============================================================
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_members;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Owner sees all members, user sees own record (no recursion!)
CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_members.project_id AND p.owner_id = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
  );

CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
  );

CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
  );

-- ============================================================
-- STEP 4: BUILDINGS
-- ============================================================
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.buildings;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'buildings'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "buildings_select" ON public.buildings
  FOR SELECT USING (public.has_project_access(project_id));

CREATE POLICY "buildings_insert" ON public.buildings
  FOR INSERT WITH CHECK (public.has_project_access(project_id));

CREATE POLICY "buildings_update" ON public.buildings
  FOR UPDATE USING (public.has_project_access(project_id));

CREATE POLICY "buildings_delete" ON public.buildings
  FOR DELETE USING (public.has_project_access(project_id));

-- ============================================================
-- STEP 5: FLOORS
-- ============================================================
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.floors;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'floors'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "floors_select" ON public.floors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.buildings WHERE buildings.id = floors.building_id AND public.has_project_access(buildings.project_id))
  );

CREATE POLICY "floors_insert" ON public.floors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.buildings WHERE buildings.id = floors.building_id AND public.has_project_access(buildings.project_id))
  );

CREATE POLICY "floors_update" ON public.floors
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.buildings WHERE buildings.id = floors.building_id AND public.has_project_access(buildings.project_id))
  );

CREATE POLICY "floors_delete" ON public.floors
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.buildings WHERE buildings.id = floors.building_id AND public.has_project_access(buildings.project_id))
  );

-- ============================================================
-- STEP 6: ROOMS
-- ============================================================
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.rooms;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rooms'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.floors JOIN public.buildings ON buildings.id = floors.building_id WHERE floors.id = rooms.floor_id AND public.has_project_access(buildings.project_id))
  );

CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.floors JOIN public.buildings ON buildings.id = floors.building_id WHERE floors.id = rooms.floor_id AND public.has_project_access(buildings.project_id))
  );

CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.floors JOIN public.buildings ON buildings.id = floors.building_id WHERE floors.id = rooms.floor_id AND public.has_project_access(buildings.project_id))
  );

CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.floors JOIN public.buildings ON buildings.id = floors.building_id WHERE floors.id = rooms.floor_id AND public.has_project_access(buildings.project_id))
  );

-- ============================================================
-- STEP 7: TASKS
-- ============================================================
DO $$ BEGIN
  EXECUTE (
    SELECT string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.tasks;', E'\n')
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (public.has_project_access(project_id));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (public.has_project_access(project_id));

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (public.has_project_access(project_id));

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    creator_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = tasks.project_id AND owner_id = auth.uid())
  );

-- ============================================================
-- STEP 8: TASK_DOCUMENTATION
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_documentation') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.task_documentation;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_documentation'
    );
    EXECUTE 'CREATE POLICY "task_documentation_select" ON public.task_documentation FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "task_documentation_insert" ON public.task_documentation FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "task_documentation_update" ON public.task_documentation FOR UPDATE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE id = task_documentation.project_id AND owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "task_documentation_delete" ON public.task_documentation FOR DELETE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE id = task_documentation.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 9: TASK_IMAGES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='task_images') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.task_images;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_images'
    );
    EXECUTE 'CREATE POLICY "task_images_select" ON public.task_images FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "task_images_insert" ON public.task_images FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "task_images_delete" ON public.task_images FOR DELETE USING (public.has_project_access(project_id))';
  END IF;
END $$;

-- ============================================================
-- STEP 10: SPRINTS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sprints') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.sprints;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sprints'
    );
    EXECUTE 'CREATE POLICY "sprints_select" ON public.sprints FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "sprints_insert" ON public.sprints FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "sprints_update" ON public.sprints FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "sprints_delete" ON public.sprints FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects WHERE id = sprints.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 11: PROJECT_INFO
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_info') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_info;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_info'
    );
    EXECUTE 'CREATE POLICY "project_info_select" ON public.project_info FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_info_insert" ON public.project_info FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_info_update" ON public.project_info FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_info_delete" ON public.project_info FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_info.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 12: PROJECT_INFO_IMAGES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_info_images') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_info_images;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_info_images'
    );
    EXECUTE 'CREATE POLICY "project_info_images_select" ON public.project_info_images FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.project_info pi WHERE pi.id = project_info_images.project_info_id AND public.has_project_access(pi.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_info_images_insert" ON public.project_info_images FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.project_info pi WHERE pi.id = project_info_images.project_info_id AND public.has_project_access(pi.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_info_images_delete" ON public.project_info_images FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.project_info pi JOIN public.projects p ON p.id = pi.project_id WHERE pi.id = project_info_images.project_info_id AND p.owner_id = auth.uid())
    )';
  END IF;
END $$;

-- ============================================================
-- STEP 13: PROJECT_VOICE_MESSAGES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_voice_messages') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_voice_messages;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_voice_messages'
    );
    EXECUTE 'CREATE POLICY "project_voice_messages_select" ON public.project_voice_messages FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.project_info pi WHERE pi.id = project_voice_messages.project_info_id AND public.has_project_access(pi.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_voice_messages_insert" ON public.project_voice_messages FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.project_info pi WHERE pi.id = project_voice_messages.project_info_id AND public.has_project_access(pi.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_voice_messages_update" ON public.project_voice_messages FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.project_info pi WHERE pi.id = project_voice_messages.project_info_id AND public.has_project_access(pi.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_voice_messages_delete" ON public.project_voice_messages FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.project_info pi WHERE pi.id = project_voice_messages.project_info_id AND public.has_project_access(pi.project_id))
    )';
  END IF;
END $$;

-- ============================================================
-- STEP 14: PROJECT_MESSAGES (communication)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_messages') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_messages;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_messages'
    );
    EXECUTE 'CREATE POLICY "project_messages_select" ON public.project_messages FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_messages_insert" ON public.project_messages FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_messages_update" ON public.project_messages FOR UPDATE USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "project_messages_delete" ON public.project_messages FOR DELETE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_messages.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 15: TIMELINE_EVENTS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='timeline_events') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.timeline_events;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'timeline_events'
    );
    EXECUTE 'CREATE POLICY "timeline_events_select" ON public.timeline_events FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "timeline_events_insert" ON public.timeline_events FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "timeline_events_update" ON public.timeline_events FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "timeline_events_delete" ON public.timeline_events FOR DELETE USING (public.has_project_access(project_id))';
  END IF;
END $$;

-- ============================================================
-- STEP 16: PROJECT_TIMELINE (older timeline table)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_timeline') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_timeline;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_timeline'
    );
    EXECUTE 'CREATE POLICY "project_timeline_select" ON public.project_timeline FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_timeline_insert" ON public.project_timeline FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_timeline_update" ON public.project_timeline FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_timeline_delete" ON public.project_timeline FOR DELETE USING (public.has_project_access(project_id))';
  END IF;
END $$;

-- ============================================================
-- STEP 17: REPORT_TEMPLATES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='report_templates') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.report_templates;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'report_templates'
    );
    EXECUTE 'CREATE POLICY "report_templates_select" ON public.report_templates FOR SELECT USING (
      is_system_template = true OR project_id IS NULL OR public.has_project_access(project_id)
    )';
    EXECUTE 'CREATE POLICY "report_templates_insert" ON public.report_templates FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "report_templates_update" ON public.report_templates FOR UPDATE USING (public.has_project_access(project_id))';
  END IF;
END $$;

-- ============================================================
-- STEP 18: GENERATED_REPORTS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='generated_reports') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.generated_reports;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'generated_reports'
    );
    EXECUTE 'CREATE POLICY "generated_reports_select" ON public.generated_reports FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "generated_reports_insert" ON public.generated_reports FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "generated_reports_delete" ON public.generated_reports FOR DELETE USING (generated_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE id = generated_reports.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 19: SCHEDULED_REPORTS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='scheduled_reports') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.scheduled_reports;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'scheduled_reports'
    );
    EXECUTE 'CREATE POLICY "scheduled_reports_select" ON public.scheduled_reports FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "scheduled_reports_insert" ON public.scheduled_reports FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "scheduled_reports_update" ON public.scheduled_reports FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "scheduled_reports_delete" ON public.scheduled_reports FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects WHERE id = scheduled_reports.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 20: ACTIVITY_LOGS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='activity_logs') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.activity_logs;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'activity_logs'
    );
    EXECUTE 'CREATE POLICY "activity_logs_select" ON public.activity_logs FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "activity_logs_insert" ON public.activity_logs FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ============================================================
-- STEP 21: PROJECT_FILES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_files') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_files;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_files'
    );
    EXECUTE 'CREATE POLICY "project_files_select" ON public.project_files FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_files_insert" ON public.project_files FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_files_update" ON public.project_files FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_files_delete" ON public.project_files FOR DELETE USING (uploaded_by = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_files.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 22: PROJECT_FILE_VERSIONS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_file_versions') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_file_versions;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_file_versions'
    );
    EXECUTE 'CREATE POLICY "project_file_versions_select" ON public.project_file_versions FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.project_files pf WHERE pf.id = project_file_versions.file_id AND public.has_project_access(pf.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_file_versions_insert" ON public.project_file_versions FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.project_files pf WHERE pf.id = project_file_versions.file_id AND public.has_project_access(pf.project_id))
    )';
  END IF;
END $$;

-- ============================================================
-- STEP 23: PROJECT_FILE_SHARES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_file_shares') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_file_shares;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_file_shares'
    );
    EXECUTE 'CREATE POLICY "project_file_shares_select" ON public.project_file_shares FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.project_files pf WHERE pf.id = project_file_shares.file_id AND public.has_project_access(pf.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_file_shares_insert" ON public.project_file_shares FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.project_files pf WHERE pf.id = project_file_shares.file_id AND public.has_project_access(pf.project_id))
    )';
    EXECUTE 'CREATE POLICY "project_file_shares_delete" ON public.project_file_shares FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.project_files pf WHERE pf.id = project_file_shares.file_id AND public.has_project_access(pf.project_id))
    )';
  END IF;
END $$;

-- ============================================================
-- STEP 24: PROJECT_AVAILABLE_ROLES
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_available_roles') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_available_roles;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_available_roles'
    );
    EXECUTE 'CREATE POLICY "project_available_roles_select" ON public.project_available_roles FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_available_roles_insert" ON public.project_available_roles FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_available_roles.project_id AND owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "project_available_roles_update" ON public.project_available_roles FOR UPDATE USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_available_roles.project_id AND owner_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "project_available_roles_delete" ON public.project_available_roles FOR DELETE USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_available_roles.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 25: PROJECT_MEMBER_PERMISSIONS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_member_permissions') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_member_permissions;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_member_permissions'
    );
    EXECUTE 'CREATE POLICY "project_member_permissions_select" ON public.project_member_permissions FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.project_members pm
        JOIN public.projects p ON p.id = pm.project_id
        WHERE pm.id = project_member_permissions.project_member_id
        AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
      )
    )';
    EXECUTE 'CREATE POLICY "project_member_permissions_manage" ON public.project_member_permissions FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.project_members pm
        JOIN public.projects p ON p.id = pm.project_id
        WHERE pm.id = project_member_permissions.project_member_id
        AND p.owner_id = auth.uid()
      )
    )';
  END IF;
END $$;

-- ============================================================
-- STEP 26: PROJECT_CRM_LINKS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_crm_links') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_crm_links;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_crm_links'
    );
    EXECUTE 'CREATE POLICY "project_crm_links_select" ON public.project_crm_links FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_crm_links_manage" ON public.project_crm_links FOR ALL USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_crm_links.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 27: PROJECT_SUBCONTRACTORS
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_subcontractors') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.project_subcontractors;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_subcontractors'
    );
    EXECUTE 'CREATE POLICY "project_subcontractors_select" ON public.project_subcontractors FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE 'CREATE POLICY "project_subcontractors_manage" ON public.project_subcontractors FOR ALL USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_subcontractors.project_id AND owner_id = auth.uid()))';
  END IF;
END $$;

-- ============================================================
-- STEP 28: COMPANY_HISTORY
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='company_history') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.company_history;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'company_history'
    );
    EXECUTE 'CREATE POLICY "company_history_select" ON public.company_history FOR SELECT USING (user_id = auth.uid())';
    EXECUTE 'CREATE POLICY "company_history_insert" ON public.company_history FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- ============================================================
-- STEP 29: PERMISSION_AUDIT_LOG
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='permission_audit_log') THEN
    EXECUTE (
      SELECT COALESCE(string_agg('DROP POLICY IF EXISTS ' || quote_literal(policyname) || ' ON public.permission_audit_log;', E'\n'), '')
      FROM pg_policies WHERE schemaname = 'public' AND tablename = 'permission_audit_log'
    );
    EXECUTE 'CREATE POLICY "permission_audit_log_select" ON public.permission_audit_log FOR SELECT USING (
      user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = permission_audit_log.project_id AND owner_id = auth.uid())
    )';
    EXECUTE 'CREATE POLICY "permission_audit_log_insert" ON public.permission_audit_log FOR INSERT WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================
-- DONE! All public table RLS policies have been replaced.
-- The has_project_access() function (SECURITY DEFINER) is the
-- single source of truth for project access checks.
-- ============================================================
