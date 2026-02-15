-- =====================================================
-- FIX: Project Access Control - Correct RLS Policies
-- Created: 2026-02-15
-- Purpose: 
--   1. Users should ONLY see projects they are members of
--   2. Members with status open/invited/active can view project content
--   3. Only inactive members are blocked from access
-- =====================================================

-- ============================================================
-- STEP 1: Update has_project_access to allow non-inactive members
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    -- Project owner always has access
    SELECT 1 FROM public.projects WHERE id = p_id AND owner_id = auth.uid()
  ) OR EXISTS (
    -- Project members with non-inactive status have access
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 2: Fix projects SELECT policy to use has_project_access
-- This ensures only members of specific projects can see them
-- ============================================================
DROP POLICY IF EXISTS "Project members can view project" ON public.projects;

CREATE POLICY "Project members can view project" ON public.projects
  FOR SELECT USING (
    public.has_project_access(id)
  );

-- ============================================================
-- STEP 3: Fix project_members SELECT policy
-- Members can view other members in the same project
-- ============================================================
DROP POLICY IF EXISTS "Project members can view other members" ON public.project_members;

CREATE POLICY "Project members can view other members" ON public.project_members
  FOR SELECT USING (
    -- Project owner can see all members
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id
      AND p.owner_id = auth.uid()
    )
    OR
    -- Members of the same project can see each other
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.user_id = auth.uid()
      AND pm.status IN ('open', 'invited', 'active')
    )
  );

-- ============================================================
-- STEP 4: Fix task_documentation policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_documentation') THEN
    EXECUTE 'DROP POLICY IF EXISTS "task_documentation_select" ON task_documentation';
    EXECUTE 'DROP POLICY IF EXISTS "task_documentation_insert" ON task_documentation';
    EXECUTE '
      CREATE POLICY "task_documentation_select" ON task_documentation
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = task_documentation.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_documentation.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "task_documentation_insert" ON task_documentation
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM projects WHERE id = task_documentation.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_documentation.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 5: Fix task_images policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_images') THEN
    EXECUTE 'DROP POLICY IF EXISTS "task_images_select" ON task_images';
    EXECUTE 'DROP POLICY IF EXISTS "task_images_insert" ON task_images';
    EXECUTE '
      CREATE POLICY "task_images_select" ON task_images
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = task_images.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_images.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "task_images_insert" ON task_images
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM projects WHERE id = task_images.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_images.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 6: Fix sprint policies 
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sprints') THEN
    EXECUTE 'DROP POLICY IF EXISTS "sprints_select" ON sprints';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_insert" ON sprints';
    EXECUTE 'DROP POLICY IF EXISTS "sprints_update" ON sprints';
    EXECUTE '
      CREATE POLICY "sprints_select" ON sprints
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = sprints.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "sprints_insert" ON sprints
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = sprints.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "sprints_update" ON sprints
        FOR UPDATE USING (
          EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = sprints.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 7: Fix project_files policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_files') THEN
    EXECUTE 'DROP POLICY IF EXISTS "project_files_select" ON project_files';
    EXECUTE 'DROP POLICY IF EXISTS "project_files_insert" ON project_files';
    EXECUTE 'DROP POLICY IF EXISTS "project_files_update" ON project_files';
    EXECUTE 'DROP POLICY IF EXISTS "project_files_delete" ON project_files';
    EXECUTE '
      CREATE POLICY "project_files_select" ON project_files
        FOR SELECT USING (
          uploaded_by = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = project_files.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_files.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "project_files_insert" ON project_files
        FOR INSERT WITH CHECK (
          uploaded_by = auth.uid()
          AND (
            EXISTS (SELECT 1 FROM projects WHERE id = project_files.project_id AND owner_id = auth.uid())
            OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_files.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
          )
        )';
    EXECUTE '
      CREATE POLICY "project_files_update" ON project_files
        FOR UPDATE USING (
          uploaded_by = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = project_files.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_files.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "project_files_delete" ON project_files
        FOR DELETE USING (
          uploaded_by = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = project_files.project_id AND owner_id = auth.uid())
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 8: Fix project_messages policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "project_messages_select" ON project_messages';
    EXECUTE 'DROP POLICY IF EXISTS "project_messages_insert" ON project_messages';
    EXECUTE '
      CREATE POLICY "project_messages_select" ON project_messages
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "project_messages_insert" ON project_messages
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 9: Fix project_links policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_links') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view project links" ON project_links';
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage project links" ON project_links';
    EXECUTE '
      CREATE POLICY "Users can view project links" ON project_links
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = project_links.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_links.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "Users can manage project links" ON project_links
        FOR ALL USING (
          EXISTS (SELECT 1 FROM projects WHERE id = project_links.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_links.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 10: Fix report policies
-- ============================================================
DROP POLICY IF EXISTS "report_templates_select" ON report_templates;
DROP POLICY IF EXISTS "report_templates_manage" ON report_templates;
DROP POLICY IF EXISTS "generated_reports_select" ON generated_reports;
DROP POLICY IF EXISTS "generated_reports_manage" ON generated_reports;
DROP POLICY IF EXISTS "scheduled_reports_select" ON scheduled_reports;
DROP POLICY IF EXISTS "scheduled_reports_manage" ON scheduled_reports;
DROP POLICY IF EXISTS "scheduled_reports_delete" ON scheduled_reports;

-- Only create policies if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_templates') THEN
    EXECUTE '
      CREATE POLICY "report_templates_select" ON report_templates
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = report_templates.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = report_templates.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "report_templates_manage" ON report_templates
        FOR ALL USING (
          EXISTS (SELECT 1 FROM projects WHERE id = report_templates.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = report_templates.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'generated_reports') THEN
    EXECUTE '
      CREATE POLICY "generated_reports_select" ON generated_reports
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = generated_reports.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = generated_reports.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "generated_reports_manage" ON generated_reports
        FOR ALL USING (
          EXISTS (SELECT 1 FROM projects WHERE id = generated_reports.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = generated_reports.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_reports') THEN
    EXECUTE '
      CREATE POLICY "scheduled_reports_select" ON scheduled_reports
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = scheduled_reports.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = scheduled_reports.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "scheduled_reports_manage" ON scheduled_reports
        FOR ALL USING (
          EXISTS (SELECT 1 FROM projects WHERE id = scheduled_reports.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = scheduled_reports.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 11: Fix voice_messages policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'voice_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "voice_messages_select" ON voice_messages';
    EXECUTE 'DROP POLICY IF EXISTS "voice_messages_insert" ON voice_messages';
    EXECUTE 'DROP POLICY IF EXISTS "voice_messages_update" ON voice_messages';
    EXECUTE 'DROP POLICY IF EXISTS "voice_messages_delete" ON voice_messages';
    EXECUTE '
      CREATE POLICY "voice_messages_select" ON voice_messages
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = voice_messages.project_id
            AND (
              p.owner_id = auth.uid()
              OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.status IN (''open'', ''invited'', ''active''))
            )
          )
        )';
    EXECUTE '
      CREATE POLICY "voice_messages_insert" ON voice_messages
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM projects p
            WHERE p.id = voice_messages.project_id
            AND (
              p.owner_id = auth.uid()
              OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid() AND pm.status IN (''open'', ''invited'', ''active''))
            )
          )
        )';
    EXECUTE '
      CREATE POLICY "voice_messages_update" ON voice_messages
        FOR UPDATE USING (
          created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = voice_messages.project_id AND owner_id = auth.uid())
        )';
    EXECUTE '
      CREATE POLICY "voice_messages_delete" ON voice_messages
        FOR DELETE USING (
          created_by = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = voice_messages.project_id AND owner_id = auth.uid())
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 12: Fix activity_log policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_log') THEN
    EXECUTE 'DROP POLICY IF EXISTS "activity_log_select" ON activity_log';
    EXECUTE 'DROP POLICY IF EXISTS "activity_log_insert" ON activity_log';
    EXECUTE '
      CREATE POLICY "activity_log_select" ON activity_log
        FOR SELECT USING (
          user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = activity_log.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = activity_log.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "activity_log_insert" ON activity_log
        FOR INSERT WITH CHECK (
          user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM projects WHERE id = activity_log.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = activity_log.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 13: Fix timeline_events policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timeline_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS "timeline_events_select" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "timeline_events_insert" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "timeline_events_update" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "timeline_events_delete" ON timeline_events';
    EXECUTE '
      CREATE POLICY "timeline_events_select" ON timeline_events
        FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE '
      CREATE POLICY "timeline_events_insert" ON timeline_events
        FOR INSERT WITH CHECK (public.has_project_access(project_id))';
    EXECUTE '
      CREATE POLICY "timeline_events_update" ON timeline_events
        FOR UPDATE USING (public.has_project_access(project_id))';
    EXECUTE '
      CREATE POLICY "timeline_events_delete" ON timeline_events
        FOR DELETE USING (public.has_project_access(project_id))';
  END IF;
END $$;

-- ============================================================
-- STEP 14: Fix project_available_roles policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_available_roles') THEN
    EXECUTE 'DROP POLICY IF EXISTS "project_available_roles_select" ON project_available_roles';
    EXECUTE 'DROP POLICY IF EXISTS "project_available_roles_insert" ON project_available_roles';
    EXECUTE 'DROP POLICY IF EXISTS "project_available_roles_update" ON project_available_roles';
    EXECUTE 'DROP POLICY IF EXISTS "project_available_roles_delete" ON project_available_roles';
    EXECUTE '
      CREATE POLICY "project_available_roles_select" ON project_available_roles
        FOR SELECT USING (public.has_project_access(project_id))';
    EXECUTE '
      CREATE POLICY "project_available_roles_insert" ON project_available_roles
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM projects WHERE id = project_available_roles.project_id AND owner_id = auth.uid())
        )';
    EXECUTE '
      CREATE POLICY "project_available_roles_update" ON project_available_roles
        FOR UPDATE USING (
          EXISTS (SELECT 1 FROM projects WHERE id = project_available_roles.project_id AND owner_id = auth.uid())
        )';
    EXECUTE '
      CREATE POLICY "project_available_roles_delete" ON project_available_roles
        FOR DELETE USING (
          EXISTS (SELECT 1 FROM projects WHERE id = project_available_roles.project_id AND owner_id = auth.uid())
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 15: Fix project_member_permissions policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_member_permissions') THEN
    EXECUTE 'DROP POLICY IF EXISTS "project_member_permissions_select" ON project_member_permissions';
    EXECUTE 'DROP POLICY IF EXISTS "project_member_permissions_manage" ON project_member_permissions';
    EXECUTE '
      CREATE POLICY "project_member_permissions_select" ON project_member_permissions
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE pm.id = project_member_permissions.project_member_id
            AND (p.owner_id = auth.uid() OR pm.user_id = auth.uid())
          )
        )';
    EXECUTE '
      CREATE POLICY "project_member_permissions_manage" ON project_member_permissions
        FOR ALL USING (
          EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE pm.id = project_member_permissions.project_member_id
            AND p.owner_id = auth.uid()
          )
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 16: Fix project_info policies
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_info') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Project members can view project info" ON project_info';
    EXECUTE 'DROP POLICY IF EXISTS "Members with permission can edit project info" ON project_info';
    EXECUTE '
      CREATE POLICY "Project members can view project info" ON project_info
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_info.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 17: Fix timeline_events policies (from general_info migration)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timeline_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Project members can view timeline events" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "Members with schedule permission can create events" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "Members with schedule permission can edit events" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "Members with schedule permission can delete events" ON timeline_events';
    EXECUTE 'DROP POLICY IF EXISTS "Project owners can manage timeline events" ON timeline_events';
    EXECUTE '
      CREATE POLICY "timeline_events_select" ON timeline_events
        FOR SELECT USING (
          EXISTS (SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = timeline_events.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "timeline_events_insert" ON timeline_events
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = timeline_events.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "timeline_events_update" ON timeline_events
        FOR UPDATE USING (
          EXISTS (SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = timeline_events.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
    EXECUTE '
      CREATE POLICY "timeline_events_delete" ON timeline_events
        FOR DELETE USING (
          EXISTS (SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid())
          OR EXISTS (SELECT 1 FROM project_members WHERE project_id = timeline_events.project_id AND user_id = auth.uid() AND status IN (''open'', ''invited'', ''active''))
        )';
  END IF;
END $$;

-- ============================================================
-- STEP 18: Fix storage policies for member access
-- ============================================================
DO $$
BEGIN
  -- Fix project-info-images storage policy
  EXECUTE 'DROP POLICY IF EXISTS "Project members can view info images" ON storage.objects';
  BEGIN
    EXECUTE '
      CREATE POLICY "Project members can view info images"
        ON storage.objects FOR SELECT
        USING (
          bucket_id = ''project-info-images'' AND
          (storage.foldername(name))[1] IN (
            SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
            UNION
            SELECT pm.project_id::text FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.status IN (''open'', ''invited'', ''active'')
          )
        )';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create project-info-images policy: %', SQLERRM;
  END;

  -- Fix project-voice-messages storage policy
  EXECUTE 'DROP POLICY IF EXISTS "Project members can listen to voice messages" ON storage.objects';
  BEGIN
    EXECUTE '
      CREATE POLICY "Project members can listen to voice messages"
        ON storage.objects FOR SELECT
        USING (
          bucket_id = ''project-voice-messages'' AND
          (storage.foldername(name))[1] IN (
            SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
            UNION
            SELECT pm.project_id::text FROM project_members pm WHERE pm.user_id = auth.uid() AND pm.status IN (''open'', ''invited'', ''active'')
          )
        )';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not create project-voice-messages policy: %', SQLERRM;
  END;
END $$;
