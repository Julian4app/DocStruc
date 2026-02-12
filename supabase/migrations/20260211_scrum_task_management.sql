-- =====================================================
-- MIGRATION: Scrum Task Management Enhancement
-- Created: 2026-02-11
-- Purpose: Full Scrum/Kanban features with documentation
-- =====================================================

-- =====================================================
-- 1. EXTEND TASKS TABLE
-- =====================================================

-- Add new columns for Scrum features
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id UUID;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS labels TEXT[] DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(10, 2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_position INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board_position ON tasks(board_position);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- =====================================================
-- 2. TASK DOCUMENTATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_documentation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT,
  documentation_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'voice', 'image', 'video'
  
  -- Media (for images/videos/voice recordings)
  storage_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  duration_seconds INTEGER, -- For voice/video
  thumbnail_path TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for task documentation
CREATE INDEX IF NOT EXISTS idx_task_documentation_task_id ON task_documentation(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documentation_project_id ON task_documentation(project_id);
CREATE INDEX IF NOT EXISTS idx_task_documentation_user_id ON task_documentation(user_id);
CREATE INDEX IF NOT EXISTS idx_task_documentation_created_at ON task_documentation(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_documentation_type ON task_documentation(documentation_type);

-- RLS for task documentation
ALTER TABLE task_documentation ENABLE ROW LEVEL SECURITY;

-- View task documentation: project members
CREATE POLICY "Project members can view task documentation"
  ON task_documentation FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = task_documentation.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_documentation.project_id AND user_id = auth.uid())
  );

-- Create task documentation: project members
CREATE POLICY "Project members can create task documentation"
  ON task_documentation FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = task_documentation.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_documentation.project_id AND user_id = auth.uid())
    )
  );

-- Update task documentation: own documentation
CREATE POLICY "Users can update their own task documentation"
  ON task_documentation FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete task documentation: own documentation or project owner
CREATE POLICY "Users can delete their own task documentation or project owner"
  ON task_documentation FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM projects WHERE id = task_documentation.project_id AND owner_id = auth.uid())
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_task_documentation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_task_documentation_updated_at
  BEFORE UPDATE ON task_documentation
  FOR EACH ROW
  EXECUTE FUNCTION update_task_documentation_updated_at();

-- =====================================================
-- 3. TASK IMAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS task_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Image data
  storage_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',
  width INTEGER,
  height INTEGER,
  thumbnail_path TEXT,
  
  -- Description
  caption TEXT,
  description TEXT,
  
  -- Display order
  display_order INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for task images
CREATE INDEX IF NOT EXISTS idx_task_images_task_id ON task_images(task_id);
CREATE INDEX IF NOT EXISTS idx_task_images_project_id ON task_images(project_id);
CREATE INDEX IF NOT EXISTS idx_task_images_display_order ON task_images(display_order);

-- RLS for task images
ALTER TABLE task_images ENABLE ROW LEVEL SECURITY;

-- View task images: project members
CREATE POLICY "Project members can view task images"
  ON task_images FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = task_images.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_images.project_id AND user_id = auth.uid())
  );

-- Create task images: project members
CREATE POLICY "Project members can upload task images"
  ON task_images FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = task_images.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = task_images.project_id AND user_id = auth.uid())
    )
  );

-- Delete task images: uploader or project owner
CREATE POLICY "Users can delete their own task images or project owner"
  ON task_images FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (SELECT 1 FROM projects WHERE id = task_images.project_id AND owner_id = auth.uid())
  );

-- =====================================================
-- 4. SPRINTS TABLE (for Scrum)
-- =====================================================

CREATE TABLE IF NOT EXISTS sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned', -- 'planned', 'active', 'completed', 'cancelled'
  velocity INTEGER, -- Completed story points
  
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT sprint_dates_valid CHECK (end_date >= start_date)
);

-- Indexes for sprints
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
CREATE INDEX IF NOT EXISTS idx_sprints_dates ON sprints(start_date, end_date);

-- RLS for sprints
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;

-- View sprints: project members
CREATE POLICY "Project members can view sprints"
  ON sprints FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = sprints.project_id AND user_id = auth.uid())
  );

-- Create sprints: project members
CREATE POLICY "Project members can create sprints"
  ON sprints FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = sprints.project_id AND user_id = auth.uid())
    )
  );

-- Update sprints: project members
CREATE POLICY "Project members can update sprints"
  ON sprints FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = sprints.project_id AND user_id = auth.uid())
  );

-- Delete sprints: project owner
CREATE POLICY "Project owners can delete sprints"
  ON sprints FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = sprints.project_id AND owner_id = auth.uid())
  );

-- =====================================================
-- 5. STORAGE BUCKETS
-- =====================================================

-- Task attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Task documentation bucket (for voice/video recordings)
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-documentation', 'task-documentation', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 6. STORAGE POLICIES
-- =====================================================

-- Task attachments policies
CREATE POLICY "Project members can upload task attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Project members can view task attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Project members can delete task attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND auth.role() = 'authenticated'
  );

-- Task documentation policies
CREATE POLICY "Project members can upload task documentation"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-documentation'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Project members can view task documentation"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-documentation'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Project members can delete task documentation"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-documentation'
    AND auth.role() = 'authenticated'
  );

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Get task with all relations
CREATE OR REPLACE FUNCTION get_task_details(p_task_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'task', to_jsonb(t.*),
    'images', (
      SELECT COALESCE(jsonb_agg(ti.*), '[]'::jsonb)
      FROM task_images ti
      WHERE ti.task_id = p_task_id
      ORDER BY ti.display_order
    ),
    'documentation', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', td.id,
          'content', td.content,
          'documentation_type', td.documentation_type,
          'storage_path', td.storage_path,
          'file_name', td.file_name,
          'created_at', td.created_at,
          'user', jsonb_build_object(
            'id', p.id,
            'email', p.email,
            'first_name', p.first_name,
            'last_name', p.last_name
          )
        )
      ), '[]'::jsonb)
      FROM task_documentation td
      JOIN profiles p ON td.user_id = p.id
      WHERE td.task_id = p_task_id
      ORDER BY td.created_at DESC
    ),
    'assigned_user', (
      SELECT to_jsonb(p.*)
      FROM profiles p
      WHERE p.id = t.assigned_to
    )
  ) INTO v_result
  FROM tasks t
  WHERE t.id = p_task_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get sprint statistics
CREATE OR REPLACE FUNCTION get_sprint_stats(p_sprint_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_tasks', COUNT(*),
    'completed_tasks', COUNT(*) FILTER (WHERE status = 'done'),
    'in_progress_tasks', COUNT(*) FILTER (WHERE status = 'in_progress'),
    'open_tasks', COUNT(*) FILTER (WHERE status = 'open'),
    'blocked_tasks', COUNT(*) FILTER (WHERE status = 'blocked'),
    'total_story_points', SUM(story_points),
    'completed_story_points', SUM(story_points) FILTER (WHERE status = 'done'),
    'completion_percentage', 
      CASE 
        WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'done')::NUMERIC / COUNT(*)) * 100, 2)
        ELSE 0
      END
  ) INTO v_result
  FROM tasks
  WHERE sprint_id = p_sprint_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get project task statistics
CREATE OR REPLACE FUNCTION get_project_task_stats(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_tasks', COUNT(*),
    'by_status', jsonb_object_agg(
      status,
      status_count
    ),
    'by_priority', jsonb_object_agg(
      priority,
      priority_count
    ),
    'assigned_count', COUNT(*) FILTER (WHERE assigned_to IS NOT NULL),
    'unassigned_count', COUNT(*) FILTER (WHERE assigned_to IS NULL),
    'with_images', COUNT(DISTINCT t.id) FILTER (WHERE ti.id IS NOT NULL),
    'with_documentation', COUNT(DISTINCT t.id) FILTER (WHERE td.id IS NOT NULL)
  ) INTO v_result
  FROM tasks t
  LEFT JOIN task_images ti ON t.id = ti.task_id
  LEFT JOIN task_documentation td ON t.id = td.task_id
  CROSS JOIN LATERAL (
    SELECT status, COUNT(*) as status_count
    FROM tasks
    WHERE project_id = p_project_id
    GROUP BY status
  ) s
  CROSS JOIN LATERAL (
    SELECT priority, COUNT(*) as priority_count
    FROM tasks
    WHERE project_id = p_project_id
    GROUP BY priority
  ) pr
  WHERE t.project_id = p_project_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 8. ACTIVITY LOG TRIGGER FOR TASK DOCUMENTATION
-- =====================================================

CREATE OR REPLACE FUNCTION log_task_documentation_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_task_title TEXT;
BEGIN
  SELECT title INTO v_task_title FROM tasks WHERE id = NEW.task_id;
  
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.project_id,
      'created',
      'task_documentation',
      NEW.id,
      v_task_title || ' - Dokumentation',
      '{}'::jsonb,
      jsonb_build_object('type', NEW.documentation_type),
      jsonb_build_object('task_id', NEW.task_id, 'type', NEW.documentation_type)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER task_documentation_activity_log_trigger
  AFTER INSERT ON task_documentation
  FOR EACH ROW
  EXECUTE FUNCTION log_task_documentation_activity();

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'task_documentation',
    'task_images',
    'sprints'
  ];
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY v_tables
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = v_table) THEN
      RAISE EXCEPTION 'Table % not created!', v_table;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'All tables created successfully!';
END;
$$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON TABLE task_documentation IS 'Documentation entries for tasks (text, voice, images, videos)';
COMMENT ON TABLE task_images IS 'Images attached to tasks';
COMMENT ON TABLE sprints IS 'Scrum sprints for agile project management';
COMMENT ON FUNCTION get_task_details IS 'Get complete task with images, documentation, and assigned user';
COMMENT ON FUNCTION get_sprint_stats IS 'Get statistics for a sprint';
COMMENT ON FUNCTION get_project_task_stats IS 'Get comprehensive task statistics for a project';
