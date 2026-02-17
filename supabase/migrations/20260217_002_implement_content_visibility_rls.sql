-- =====================================================
-- CONTENT VISIBILITY RLS POLICIES
-- Implements server-side security for content visibility
-- =====================================================

-- Drop existing permissive policies that allow all project members
-- We'll replace them with visibility-aware policies

-- Tasks (includes both tasks and defects via task_type)
DROP POLICY IF EXISTS "Project members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;

CREATE POLICY "Users can view tasks based on visibility settings"
ON tasks FOR SELECT
USING (
  -- Project owner and superusers can see everything
  (auth.uid() IN (
    SELECT owner_id FROM projects WHERE id = tasks.project_id
  ))
  OR
  (auth.uid() IN (
    SELECT id FROM profiles WHERE is_superuser = true
  ))
  OR
  -- Otherwise check visibility rules
  (
    -- User must be a project member
    has_project_access(tasks.project_id)
    AND
    -- Apply visibility filtering
    CASE
      -- Get the effective visibility for this task
      WHEN EXISTS (
        SELECT 1 FROM content_visibility_overrides cvo
        WHERE cvo.module_key = CASE 
          WHEN tasks.task_type = 'defect' THEN 'defects'
          ELSE 'tasks'
        END
        AND cvo.content_id = tasks.id
      ) THEN
        -- Has override - use override visibility
        can_user_see_content(
          auth.uid(),
          tasks.project_id,
          CASE WHEN tasks.task_type = 'defect' THEN 'defects' ELSE 'tasks' END,
          tasks.id,
          COALESCE(
            (SELECT team_id FROM profiles WHERE id = tasks.creator_id),
            (SELECT member_team_id FROM project_members WHERE project_id = tasks.project_id AND user_id = tasks.creator_id)
          )
        )
      ELSE
        -- No override - use module default
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM project_content_defaults pcd
            WHERE pcd.project_id = tasks.project_id
            AND pcd.module_key = CASE WHEN tasks.task_type = 'defect' THEN 'defects' ELSE 'tasks' END
          ) THEN true  -- No default set = all_participants
          
          WHEN (
            SELECT default_visibility FROM project_content_defaults
            WHERE project_id = tasks.project_id
            AND module_key = CASE WHEN tasks.task_type = 'defect' THEN 'defects' ELSE 'tasks' END
          ) = 'all_participants' THEN true
          
          WHEN (
            SELECT default_visibility FROM project_content_defaults
            WHERE project_id = tasks.project_id
            AND module_key = CASE WHEN tasks.task_type = 'defect' THEN 'defects' ELSE 'tasks' END
          ) = 'owner_only' THEN false  -- Already checked owner above
          
          WHEN (
            SELECT default_visibility FROM project_content_defaults
            WHERE project_id = tasks.project_id
            AND module_key = CASE WHEN tasks.task_type = 'defect' THEN 'defects' ELSE 'tasks' END
          ) = 'team_only' THEN
            -- Check if user is in same team as creator OR is the creator
            (tasks.creator_id = auth.uid())
            OR
            (
              COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = tasks.project_id AND user_id = auth.uid())
              ) = COALESCE(
                (SELECT team_id FROM profiles WHERE id = tasks.creator_id),
                (SELECT member_team_id FROM project_members WHERE project_id = tasks.project_id AND user_id = tasks.creator_id)
              )
              AND COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = tasks.project_id AND user_id = auth.uid())
              ) IS NOT NULL
            )
          ELSE true
        END
    END
  )
);

-- Diary Entries
DROP POLICY IF EXISTS "Project members can view diary entries" ON diary_entries;
DROP POLICY IF EXISTS "Users can view diary in their projects" ON diary_entries;

CREATE POLICY "Users can view diary entries based on visibility settings"
ON diary_entries FOR SELECT
USING (
  (auth.uid() IN (SELECT owner_id FROM projects WHERE id = diary_entries.project_id))
  OR
  (auth.uid() IN (SELECT id FROM profiles WHERE is_superuser = true))
  OR
  (
    has_project_access(diary_entries.project_id)
    AND
    CASE
      WHEN EXISTS (
        SELECT 1 FROM content_visibility_overrides
        WHERE module_key = 'diary' AND content_id = diary_entries.id
      ) THEN
        can_user_see_content(
          auth.uid(),
          diary_entries.project_id,
          'diary',
          diary_entries.id,
          COALESCE(
            (SELECT team_id FROM profiles WHERE id = diary_entries.created_by),
            (SELECT member_team_id FROM project_members WHERE project_id = diary_entries.project_id AND user_id = diary_entries.created_by)
          )
        )
      ELSE
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM project_content_defaults
            WHERE project_id = diary_entries.project_id AND module_key = 'diary'
          ) THEN true
          
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = diary_entries.project_id AND module_key = 'diary') = 'all_participants' THEN true
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = diary_entries.project_id AND module_key = 'diary') = 'owner_only' THEN false
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = diary_entries.project_id AND module_key = 'diary') = 'team_only' THEN
            (diary_entries.created_by = auth.uid())
            OR
            (
              COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = diary_entries.project_id AND user_id = auth.uid())
              ) = COALESCE(
                (SELECT team_id FROM profiles WHERE id = diary_entries.created_by),
                (SELECT member_team_id FROM project_members WHERE project_id = diary_entries.project_id AND user_id = diary_entries.created_by)
              )
              AND COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = diary_entries.project_id AND user_id = auth.uid())
              ) IS NOT NULL
            )
          ELSE true
        END
    END
  )
);

-- Project Messages (includes both messages and notes via message_type)
DROP POLICY IF EXISTS "Project members can view messages" ON project_messages;
DROP POLICY IF EXISTS "Users can view messages in their projects" ON project_messages;

CREATE POLICY "Users can view messages based on visibility settings"
ON project_messages FOR SELECT
USING (
  (auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_messages.project_id))
  OR
  (auth.uid() IN (SELECT id FROM profiles WHERE is_superuser = true))
  OR
  (
    has_project_access(project_messages.project_id)
    AND
    CASE
      WHEN EXISTS (
        SELECT 1 FROM content_visibility_overrides
        WHERE module_key = 'communication' AND content_id = project_messages.id
      ) THEN
        can_user_see_content(
          auth.uid(),
          project_messages.project_id,
          'communication',
          project_messages.id,
          COALESCE(
            (SELECT team_id FROM profiles WHERE id = project_messages.user_id),
            (SELECT member_team_id FROM project_members WHERE project_id = project_messages.project_id AND user_id = project_messages.user_id)
          )
        )
      ELSE
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM project_content_defaults
            WHERE project_id = project_messages.project_id AND module_key = 'communication'
          ) THEN true
          
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_messages.project_id AND module_key = 'communication') = 'all_participants' THEN true
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_messages.project_id AND module_key = 'communication') = 'owner_only' THEN false
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_messages.project_id AND module_key = 'communication') = 'team_only' THEN
            (project_messages.user_id = auth.uid())
            OR
            (
              COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
              ) = COALESCE(
                (SELECT team_id FROM profiles WHERE id = project_messages.user_id),
                (SELECT member_team_id FROM project_members WHERE project_id = project_messages.project_id AND user_id = project_messages.user_id)
              )
              AND COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
              ) IS NOT NULL
            )
          ELSE true
        END
    END
  )
);

-- Project Files
DROP POLICY IF EXISTS "Project members can view files" ON project_files;

CREATE POLICY "Users can view files based on visibility settings"
ON project_files FOR SELECT
USING (
  (auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_files.project_id))
  OR
  (auth.uid() IN (SELECT id FROM profiles WHERE is_superuser = true))
  OR
  (
    has_project_access(project_files.project_id)
    AND
    CASE
      WHEN EXISTS (
        SELECT 1 FROM content_visibility_overrides
        WHERE module_key = 'files' AND content_id = project_files.id
      ) THEN
        can_user_see_content(
          auth.uid(),
          project_files.project_id,
          'files',
          project_files.id,
          COALESCE(
            (SELECT team_id FROM profiles WHERE id = project_files.uploaded_by),
            (SELECT member_team_id FROM project_members WHERE project_id = project_files.project_id AND user_id = project_files.uploaded_by)
          )
        )
      ELSE
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM project_content_defaults
            WHERE project_id = project_files.project_id AND module_key = 'files'
          ) THEN true
          
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_files.project_id AND module_key = 'files') = 'all_participants' THEN true
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_files.project_id AND module_key = 'files') = 'owner_only' THEN false
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_files.project_id AND module_key = 'files') = 'team_only' THEN
            (project_files.uploaded_by = auth.uid())
            OR
            (
              COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = project_files.project_id AND user_id = auth.uid())
              ) = COALESCE(
                (SELECT team_id FROM profiles WHERE id = project_files.uploaded_by),
                (SELECT member_team_id FROM project_members WHERE project_id = project_files.project_id AND user_id = project_files.uploaded_by)
              )
              AND COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members WHERE project_id = project_files.project_id AND user_id = auth.uid())
              ) IS NOT NULL
            )
          ELSE true
        END
    END
  )
);

-- Task Documentation
DROP POLICY IF EXISTS "Project members can view documentation" ON task_documentation;
DROP POLICY IF EXISTS "Users can view documentation in their projects" ON task_documentation;

CREATE POLICY "Users can view documentation based on visibility settings"
ON task_documentation FOR SELECT
USING (
  (auth.uid() IN (SELECT owner_id FROM projects p JOIN tasks t ON t.project_id = p.id WHERE t.id = task_documentation.task_id))
  OR
  (auth.uid() IN (SELECT id FROM profiles WHERE is_superuser = true))
  OR
  (
    EXISTS (
      SELECT 1 FROM tasks t 
      WHERE t.id = task_documentation.task_id 
      AND has_project_access(t.project_id)
    )
    AND
    CASE
      WHEN EXISTS (
        SELECT 1 FROM content_visibility_overrides
        WHERE module_key = 'documentation' AND content_id = task_documentation.id
      ) THEN
        can_user_see_content(
          auth.uid(),
          (SELECT project_id FROM tasks WHERE id = task_documentation.task_id),
          'documentation',
          task_documentation.id,
          COALESCE(
            (SELECT team_id FROM profiles WHERE id = task_documentation.user_id),
            (SELECT member_team_id FROM project_members pm JOIN tasks t ON pm.project_id = t.project_id WHERE pm.user_id = task_documentation.user_id AND t.id = task_documentation.task_id)
          )
        )
      ELSE
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM project_content_defaults pcd
            JOIN tasks t ON t.project_id = pcd.project_id
            WHERE t.id = task_documentation.task_id AND pcd.module_key = 'documentation'
          ) THEN true
          
          WHEN (
            SELECT default_visibility FROM project_content_defaults pcd
            JOIN tasks t ON t.project_id = pcd.project_id
            WHERE t.id = task_documentation.task_id AND pcd.module_key = 'documentation'
          ) = 'all_participants' THEN true
          WHEN (
            SELECT default_visibility FROM project_content_defaults pcd
            JOIN tasks t ON t.project_id = pcd.project_id
            WHERE t.id = task_documentation.task_id AND pcd.module_key = 'documentation'
          ) = 'owner_only' THEN false
          WHEN (
            SELECT default_visibility FROM project_content_defaults pcd
            JOIN tasks t ON t.project_id = pcd.project_id
            WHERE t.id = task_documentation.task_id AND pcd.module_key = 'documentation'
          ) = 'team_only' THEN
            (task_documentation.user_id = auth.uid())
            OR
            (
              COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members pm JOIN tasks t ON pm.project_id = t.project_id WHERE pm.user_id = auth.uid() AND t.id = task_documentation.task_id)
              ) = COALESCE(
                (SELECT team_id FROM profiles WHERE id = task_documentation.user_id),
                (SELECT member_team_id FROM project_members pm JOIN tasks t ON pm.project_id = t.project_id WHERE pm.user_id = task_documentation.user_id AND t.id = task_documentation.task_id)
              )
              AND COALESCE(
                (SELECT team_id FROM profiles WHERE id = auth.uid()),
                (SELECT member_team_id FROM project_members pm JOIN tasks t ON pm.project_id = t.project_id WHERE pm.user_id = auth.uid() AND t.id = task_documentation.task_id)
              ) IS NOT NULL
            )
          ELSE true
        END
    END
  )
);

-- Timeline/Schedule Milestones
DROP POLICY IF EXISTS "Project members can view timeline" ON project_timeline;

CREATE POLICY "Users can view timeline based on visibility settings"
ON project_timeline FOR SELECT
USING (
  (auth.uid() IN (SELECT owner_id FROM projects WHERE id = project_timeline.project_id))
  OR
  (auth.uid() IN (SELECT id FROM profiles WHERE is_superuser = true))
  OR
  (
    has_project_access(project_timeline.project_id)
    AND
    CASE
      WHEN EXISTS (
        SELECT 1 FROM content_visibility_overrides
        WHERE module_key = 'schedule' AND content_id = project_timeline.id
      ) THEN
        can_user_see_content(
          auth.uid(),
          project_timeline.project_id,
          'schedule',
          project_timeline.id,
          NULL  -- Milestones have no creator
        )
      ELSE
        CASE
          WHEN NOT EXISTS (
            SELECT 1 FROM project_content_defaults
            WHERE project_id = project_timeline.project_id AND module_key = 'schedule'
          ) THEN true
          
          WHEN (SELECT default_visibility FROM project_content_defaults WHERE project_id = project_timeline.project_id AND module_key = 'schedule') = 'all_participants' THEN true
          -- For schedule, team_only and owner_only behave like all_participants since milestones have no creator
          ELSE true
        END
    END
  )
);

-- Keep INSERT/UPDATE/DELETE policies simple - just check project access
-- Visibility controls what users SEE, not what they can create/edit
-- (Users can still edit their own content or content they can see)

COMMENT ON POLICY "Users can view tasks based on visibility settings" ON tasks IS 
'Enforces content visibility rules at database level for maximum security';

COMMENT ON POLICY "Users can view diary entries based on visibility settings" ON diary_entries IS 
'Enforces content visibility rules at database level for maximum security';

COMMENT ON POLICY "Users can view messages based on visibility settings" ON project_messages IS 
'Enforces content visibility rules at database level for maximum security';

COMMENT ON POLICY "Users can view files based on visibility settings" ON project_files IS 
'Enforces content visibility rules at database level for maximum security';

COMMENT ON POLICY "Users can view documentation based on visibility settings" ON task_documentation IS 
'Enforces content visibility rules at database level for maximum security';

COMMENT ON POLICY "Users can view timeline based on visibility settings" ON project_timeline IS 
'Enforces content visibility rules at database level for maximum security';
