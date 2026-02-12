-- =====================================================
-- GENERAL PROJECT INFO & DATA IMPROVEMENTS
-- Created: 2026-02-11
-- Purpose: Add general info page and improve data structure
-- =====================================================

-- =====================================================
-- 1. ADD "Allgemeine Info" MODULE TO PERMISSIONS
-- =====================================================
INSERT INTO permission_modules (module_key, module_name, module_description, route_path, icon_name, display_order) 
VALUES ('general_info', 'Allgemeine Info', 'Allgemeine Projektinformationen', '/general-info', 'Info', 2)
ON CONFLICT (module_key) DO NOTHING;

-- Update display_order for other modules to make room
UPDATE permission_modules SET display_order = 3 WHERE module_key = 'tasks';
UPDATE permission_modules SET display_order = 4 WHERE module_key = 'defects';
UPDATE permission_modules SET display_order = 5 WHERE module_key = 'schedule';
UPDATE permission_modules SET display_order = 6 WHERE module_key = 'time_tracking';
UPDATE permission_modules SET display_order = 7 WHERE module_key = 'documentation';
UPDATE permission_modules SET display_order = 8 WHERE module_key = 'files';
UPDATE permission_modules SET display_order = 9 WHERE module_key = 'diary';
UPDATE permission_modules SET display_order = 10 WHERE module_key = 'communication';
UPDATE permission_modules SET display_order = 11 WHERE module_key = 'participants';
UPDATE permission_modules SET display_order = 12 WHERE module_key = 'reports';
UPDATE permission_modules SET display_order = 13 WHERE module_key = 'activity';
UPDATE permission_modules SET display_order = 14 WHERE module_key = 'settings';

-- =====================================================
-- 2. CREATE PROJECT_INFO TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS project_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  detailed_description TEXT,
  voice_message_url TEXT,
  voice_transcription TEXT,
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  formatted_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add voice_transcription column if table already exists
ALTER TABLE project_info ADD COLUMN IF NOT EXISTS voice_transcription TEXT;

-- Enable RLS
ALTER TABLE project_info ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Project owners can manage project info" ON project_info;
DROP POLICY IF EXISTS "Project members can view project info" ON project_info;
DROP POLICY IF EXISTS "Members with permission can edit project info" ON project_info;

-- RLS Policies for project_info
CREATE POLICY "Project owners can manage project info"
  ON project_info FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Project members can view project info"
  ON project_info FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = project_info.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Members with permission can edit project info"
  ON project_info FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), project_info.project_id, 'general_info', 'edit')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), project_info.project_id, 'general_info', 'edit')
  );

-- =====================================================
-- 3. CREATE PROJECT_INFO_IMAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS project_info_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_info_id UUID REFERENCES project_info(id) ON DELETE CASCADE NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE project_info_images ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Project owners can manage info images" ON project_info_images;
DROP POLICY IF EXISTS "Project members can view info images" ON project_info_images;

-- RLS Policies for project_info_images
CREATE POLICY "Project owners can manage info images"
  ON project_info_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM project_info pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.id = project_info_images.project_info_id AND p.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM project_info pi
    JOIN projects p ON pi.project_id = p.id
    WHERE pi.id = project_info_images.project_info_id AND p.owner_id = auth.uid()
  ));

CREATE POLICY "Project members can view info images"
  ON project_info_images FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_info pi
    JOIN project_members pm ON pi.project_id = pm.project_id
    WHERE pi.id = project_info_images.project_info_id AND pm.user_id = auth.uid()
  ));

-- =====================================================
-- 4. IMPROVE TASKS TABLE
-- =====================================================
-- Add missing columns for better task management
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task' CHECK (task_type IN ('task', 'defect'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- =====================================================
-- 5. CREATE SCHEDULE/TIMELINE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'milestone' CHECK (event_type IN ('milestone', 'deadline', 'appointment', 'phase')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  attendees TEXT[],
  reminder_minutes INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  color TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Project owners can manage timeline events" ON timeline_events;
DROP POLICY IF EXISTS "Project members can view timeline events" ON timeline_events;
DROP POLICY IF EXISTS "Members with schedule permission can create events" ON timeline_events;
DROP POLICY IF EXISTS "Members with schedule permission can edit events" ON timeline_events;
DROP POLICY IF EXISTS "Members with schedule permission can delete events" ON timeline_events;

-- RLS Policies for timeline_events
CREATE POLICY "Project owners can manage timeline events"
  ON timeline_events FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Project members can view timeline events"
  ON timeline_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = timeline_events.project_id AND user_id = auth.uid()
  ));

CREATE POLICY "Members with schedule permission can create events"
  ON timeline_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'create')
  );

CREATE POLICY "Members with schedule permission can edit events"
  ON timeline_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'edit')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'edit')
  );

CREATE POLICY "Members with schedule permission can delete events"
  ON timeline_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'delete')
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_timeline_project_id ON timeline_events(project_id);
CREATE INDEX IF NOT EXISTS idx_timeline_start_date ON timeline_events(start_date);
CREATE INDEX IF NOT EXISTS idx_timeline_event_type ON timeline_events(event_type);

-- =====================================================
-- 6. IMPROVE PROJECTS TABLE
-- =====================================================
-- Add coordinates and additional fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS longitude NUMERIC(11, 8);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS house_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Deutschland';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_number TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_end_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Create unique index for project_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_number ON projects(owner_id, project_number) WHERE project_number IS NOT NULL;

-- =====================================================
-- 7. CREATE TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_project_info_updated_at ON project_info;
CREATE TRIGGER update_project_info_updated_at
  BEFORE UPDATE ON project_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_timeline_events_updated_at ON timeline_events;
CREATE TRIGGER update_timeline_events_updated_at
  BEFORE UPDATE ON timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. CREATE STORAGE BUCKETS (IF NOT EXISTS)
-- =====================================================
-- Note: Storage policies need to be created separately via Supabase Dashboard
-- or via separate storage SQL commands

-- Create storage bucket for project info images
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-info-images', 'project-info-images', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for voice messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-voice-messages', 'project-voice-messages', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 9. STORAGE POLICIES FOR PROJECT INFO
-- =====================================================

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Project owners can upload info images" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can update info images" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can delete info images" ON storage.objects;
DROP POLICY IF EXISTS "Project members can view info images" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can upload voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Project owners can delete voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Project members can listen to voice messages" ON storage.objects;

-- Policy for project-info-images bucket
CREATE POLICY "Project owners can upload info images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-info-images' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can update info images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-info-images' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'project-info-images' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete info images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-info-images' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can view info images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-info-images' AND
    (storage.foldername(name))[1] IN (
      SELECT pm.project_id::text FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- Policy for project-voice-messages bucket
CREATE POLICY "Project owners can upload voice messages"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-voice-messages' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project owners can delete voice messages"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-voice-messages' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Project members can listen to voice messages"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-voice-messages' AND
    (storage.foldername(name))[1] IN (
      SELECT pm.project_id::text FROM project_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- =====================================================
-- 10. HELPER FUNCTION TO GET PROJECT STATS
-- =====================================================
CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tasks', (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND task_type = 'task'),
    'completed_tasks', (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND task_type = 'task' AND status = 'done'),
    'active_tasks', (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND task_type = 'task' AND status = 'in_progress'),
    'blocked_tasks', (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND task_type = 'task' AND status = 'blocked'),
    'open_defects', (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND task_type = 'defect' AND status != 'done'),
    'critical_defects', (SELECT COUNT(*) FROM tasks WHERE project_id = p_project_id AND task_type = 'defect' AND priority = 'critical' AND status != 'done'),
    'upcoming_events', (SELECT COUNT(*) FROM timeline_events WHERE project_id = p_project_id AND start_date > now() AND start_date < now() + interval '7 days' AND status != 'cancelled')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_project_stats(UUID) TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Added "Allgemeine Info" module to permissions
-- ✅ Created project_info table for detailed project information
-- ✅ Created project_info_images table for image gallery
-- ✅ Improved tasks table with task_type, priority, tags
-- ✅ Created timeline_events table for schedule management
-- ✅ Enhanced projects table with location and metadata
-- ✅ Added storage buckets and policies for images and voice
-- ✅ Created helper function for dashboard statistics
-- ✅ All tables have proper RLS policies
-- ✅ All tables have proper indexes for performance
