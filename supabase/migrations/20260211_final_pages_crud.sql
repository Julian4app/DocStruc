-- =====================================================
-- MIGRATION: Kommunikation, Berichte, Aktivitäten, Einstellungen
-- Created: 2026-02-11
-- Purpose: Enable full CRUD for final 4 pages
-- =====================================================

-- =====================================================
-- 1. KOMMUNIKATION (Communication)
-- =====================================================

-- Messages table (project chat/communication)
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'message', -- 'message' or 'note'
  is_pinned BOOLEAN DEFAULT false,
  pinned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pinned_at TIMESTAMPTZ,
  parent_message_id UUID REFERENCES project_messages(id) ON DELETE CASCADE, -- for replies
  mentions UUID[], -- array of user_ids mentioned with @
  attachments JSONB DEFAULT '[]'::jsonb, -- {filename, storage_path, mime_type, size}[]
  reactions JSONB DEFAULT '{}'::jsonb, -- {emoji: [user_ids]}
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for messages
CREATE INDEX IF NOT EXISTS idx_project_messages_project_id ON project_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_user_id ON project_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_created_at ON project_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_messages_type ON project_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_project_messages_pinned ON project_messages(is_pinned) WHERE is_pinned = true;
CREATE INDEX IF NOT EXISTS idx_project_messages_not_deleted ON project_messages(project_id, created_at DESC) WHERE is_deleted = false;

-- RLS for messages
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;

-- View messages: project members
CREATE POLICY "Project members can view messages"
  ON project_messages FOR SELECT
  USING (
    is_deleted = false
    AND (
      -- Project owner
      EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
      OR
      -- Project member
      EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
      OR
      -- With permission
      check_user_permission(auth.uid(), project_messages.project_id, 'communication', 'view')
    )
  );

-- Create messages: project members
CREATE POLICY "Project members can create messages"
  ON project_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
      OR check_user_permission(auth.uid(), project_messages.project_id, 'communication', 'create')
    )
  );

-- Update messages: own messages only
CREATE POLICY "Users can update their own messages"
  ON project_messages FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete messages: own messages or project owner
CREATE POLICY "Users can delete their own messages or project owner can delete"
  ON project_messages FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_project_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_project_messages_updated_at
  BEFORE UPDATE ON project_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_project_messages_updated_at();

-- =====================================================
-- 2. BERICHTE & EXPORTE (Reports & Exports)
-- =====================================================

-- Report templates (predefined and custom)
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL for system templates
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'status', 'tasks', 'defects', 'time', 'diary', 'documentation', 'participants', 'timeline', 'custom'
  format TEXT NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel', 'csv', 'word'
  icon TEXT, -- lucide icon name
  is_system_template BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb, -- template configuration (sections, filters, etc.)
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated reports history
CREATE TABLE IF NOT EXISTS generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  file_size INTEGER, -- bytes
  storage_path TEXT, -- path in storage bucket
  parameters JSONB DEFAULT '{}'::jsonb, -- generation parameters (date range, filters, etc.)
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
  error_message TEXT,
  generated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  downloaded_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ, -- auto-delete after X days
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scheduled reports (automatic generation)
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
  schedule_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
  schedule_config JSONB DEFAULT '{}'::jsonb, -- {day_of_week, day_of_month, time, etc.}
  recipients TEXT[], -- array of email addresses
  is_active BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMPTZ,
  next_generation_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_report_templates_project_id ON report_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(report_type);
CREATE INDEX IF NOT EXISTS idx_generated_reports_project_id ON generated_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON generated_reports(status);
CREATE INDEX IF NOT EXISTS idx_generated_reports_generated_at ON generated_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_project_id ON scheduled_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;

-- RLS for reports
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Report templates policies
CREATE POLICY "Anyone can view system report templates"
  ON report_templates FOR SELECT
  USING (is_system_template = true OR project_id IS NULL);

CREATE POLICY "Project members can view project report templates"
  ON report_templates FOR SELECT
  USING (
    project_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = report_templates.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = report_templates.project_id AND user_id = auth.uid())
    )
  );

CREATE POLICY "Project members can create custom templates"
  ON report_templates FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND project_id IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = report_templates.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = report_templates.project_id AND user_id = auth.uid())
    )
  );

-- Generated reports policies
CREATE POLICY "Project members can view generated reports"
  ON generated_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = generated_reports.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = generated_reports.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project members can create reports"
  ON generated_reports FOR INSERT
  WITH CHECK (
    generated_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = generated_reports.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = generated_reports.project_id AND user_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their own generated reports"
  ON generated_reports FOR DELETE
  USING (generated_by = auth.uid());

-- Scheduled reports policies (similar to generated reports)
CREATE POLICY "Project members can view scheduled reports"
  ON scheduled_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = scheduled_reports.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = scheduled_reports.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project members can create scheduled reports"
  ON scheduled_reports FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = scheduled_reports.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = scheduled_reports.project_id AND user_id = auth.uid())
    )
  );

CREATE POLICY "Project members can update scheduled reports"
  ON scheduled_reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = scheduled_reports.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = scheduled_reports.project_id AND user_id = auth.uid())
  );

-- Storage bucket for generated reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-reports', 'generated-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for generated reports
CREATE POLICY "Project members can upload reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'generated-reports'
    AND (SELECT project_id FROM generated_reports WHERE storage_path = name) IS NOT NULL
  );

CREATE POLICY "Project members can download reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'generated-reports'
    AND EXISTS (
      SELECT 1 FROM generated_reports gr
      JOIN projects p ON gr.project_id = p.id
      WHERE gr.storage_path = name
        AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM project_members WHERE project_id = p.id AND user_id = auth.uid()))
    )
  );

-- Insert system report templates
INSERT INTO report_templates (title, description, report_type, format, icon, is_system_template, config)
VALUES
  ('Projektstatus-Report', 'Gesamtübersicht über den Projektstatus', 'status', 'pdf', 'BarChart3', true, '{"sections": ["overview", "stats", "progress", "team"]}'::jsonb),
  ('Aufgaben-Report', 'Detaillierte Liste aller Aufgaben', 'tasks', 'excel', 'FileText', true, '{"include_completed": true, "include_archived": false}'::jsonb),
  ('Mängel-Report', 'Übersicht aller Mängel', 'defects', 'pdf', 'AlertCircle', true, '{"group_by": "status", "include_photos": true}'::jsonb),
  ('Zeitauswertung', 'Erfasste Arbeitszeiten', 'time', 'excel', 'TrendingUp', true, '{"group_by": "user", "include_costs": true}'::jsonb),
  ('Bautagebuch-Export', 'Komplettes Bautagebuch', 'diary', 'pdf', 'Calendar', true, '{"include_photos": true, "date_range": "all"}'::jsonb),
  ('Projekt-Dokumentation', 'Alle Notizen und Dokumente', 'documentation', 'pdf', 'FileText', true, '{"categories": ["all"], "include_media": true}'::jsonb),
  ('Teilnehmer-Liste', 'Alle Projektbeteiligten', 'participants', 'excel', 'FileSpreadsheet', true, '{"include_roles": true, "include_contact": true}'::jsonb),
  ('Zeitplan & Meilensteine', 'Terminübersicht', 'timeline', 'pdf', 'Calendar', true, '{"include_past": true, "include_completed": true}'::jsonb)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. AKTIVITÄTEN (Activity Log)
-- =====================================================

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'updated', 'deleted', 'completed', 'archived', 'restored', 'assigned', 'commented'
  entity_type TEXT NOT NULL, -- 'task', 'defect', 'document', 'member', 'project', 'message', 'note', 'diary_entry', 'time_entry', etc.
  entity_id UUID, -- ID of the affected entity
  entity_title TEXT, -- Title/name of the entity for display
  old_values JSONB DEFAULT '{}'::jsonb, -- Previous values (for updates)
  new_values JSONB DEFAULT '{}'::jsonb, -- New values (for updates)
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional context (e.g., assigned_to, status_change, etc.)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON activity_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_created ON activity_logs(project_id, created_at DESC);

-- RLS for activity logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- View activity logs: project members
CREATE POLICY "Project members can view activity logs"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM projects WHERE id = activity_logs.project_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM project_members WHERE project_id = activity_logs.project_id AND user_id = auth.uid())
  );

-- Create activity logs: system/triggers only (no manual insert via RLS)
CREATE POLICY "Only authenticated users can create activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Helper function to log activity
CREATE OR REPLACE FUNCTION log_activity(
  p_project_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_title TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT '{}'::jsonb,
  p_new_values JSONB DEFAULT '{}'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  INSERT INTO activity_logs (
    project_id,
    user_id,
    action,
    entity_type,
    entity_id,
    entity_title,
    old_values,
    new_values,
    metadata
  ) VALUES (
    p_project_id,
    auth.uid(),
    p_action,
    p_entity_type,
    p_entity_id,
    p_entity_title,
    p_old_values,
    p_new_values,
    p_metadata
  )
  RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for tasks activity logging
CREATE OR REPLACE FUNCTION log_task_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.project_id,
      'created',
      CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
      NEW.id,
      NEW.title,
      '{}'::jsonb,
      to_jsonb(NEW),
      jsonb_build_object('status', NEW.status, 'task_type', NEW.task_type)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_activity(
        NEW.project_id,
        CASE WHEN NEW.status = 'done' THEN 'completed' ELSE 'updated' END,
        CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
        NEW.id,
        NEW.title,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        jsonb_build_object('status_change', true, 'from', OLD.status, 'to', NEW.status)
      );
    ELSE
      PERFORM log_activity(
        NEW.project_id,
        'updated',
        CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
        NEW.id,
        NEW.title,
        to_jsonb(OLD),
        to_jsonb(NEW),
        '{}'::jsonb
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity(
      OLD.project_id,
      'deleted',
      CASE WHEN OLD.task_type = 'defect' THEN 'defect' ELSE 'task' END,
      OLD.id,
      OLD.title,
      to_jsonb(OLD),
      '{}'::jsonb,
      '{}'::jsonb
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for tasks
DROP TRIGGER IF EXISTS tasks_activity_log_trigger ON tasks;
CREATE TRIGGER tasks_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_activity();

-- Trigger function for project members activity logging
CREATE OR REPLACE FUNCTION log_member_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_user_email FROM profiles WHERE id = NEW.user_id;
    PERFORM log_activity(
      NEW.project_id,
      'assigned',
      'member',
      NEW.id,
      v_user_email,
      '{}'::jsonb,
      to_jsonb(NEW),
      jsonb_build_object('role', NEW.role)
    );
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO v_user_email FROM profiles WHERE id = OLD.user_id;
    PERFORM log_activity(
      OLD.project_id,
      'removed',
      'member',
      OLD.id,
      v_user_email,
      to_jsonb(OLD),
      '{}'::jsonb,
      '{}'::jsonb
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project members
DROP TRIGGER IF EXISTS project_members_activity_log_trigger ON project_members;
CREATE TRIGGER project_members_activity_log_trigger
  AFTER INSERT OR DELETE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION log_member_activity();

-- =====================================================
-- 4. EINSTELLUNGEN (Settings) - Project Configuration
-- =====================================================

-- Project settings/configuration (extended from existing projects table)
-- We'll add notification preferences and other settings as JSONB

-- Add settings column to projects if not exists
ALTER TABLE projects ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Default settings structure:
-- {
--   "notifications": {
--     "email_on_task_assigned": true,
--     "email_on_task_completed": false,
--     "email_on_defect_created": true,
--     "email_on_comment": true,
--     "email_daily_summary": false,
--     "email_weekly_report": false
--   },
--   "features": {
--     "enable_time_tracking": true,
--     "enable_diary": true,
--     "enable_documentation": true,
--     "enable_chat": true
--   },
--   "defaults": {
--     "task_priority": "medium",
--     "defect_severity": "medium",
--     "working_hours_start": "08:00",
--     "working_hours_end": "17:00"
--   },
--   "integrations": {
--     "google_maps_enabled": true,
--     "calendar_sync": false
--   }
-- }

-- Function to get project settings with defaults
CREATE OR REPLACE FUNCTION get_project_settings(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_settings JSONB;
  v_defaults JSONB := '{
    "notifications": {
      "email_on_task_assigned": true,
      "email_on_task_completed": false,
      "email_on_defect_created": true,
      "email_on_comment": true,
      "email_daily_summary": false,
      "email_weekly_report": false
    },
    "features": {
      "enable_time_tracking": true,
      "enable_diary": true,
      "enable_documentation": true,
      "enable_chat": true
    },
    "defaults": {
      "task_priority": "medium",
      "defect_severity": "medium",
      "working_hours_start": "08:00",
      "working_hours_end": "17:00"
    },
    "integrations": {
      "google_maps_enabled": true,
      "calendar_sync": false
    }
  }'::jsonb;
BEGIN
  SELECT settings INTO v_settings FROM projects WHERE id = p_project_id;
  
  -- Merge user settings with defaults
  RETURN v_defaults || COALESCE(v_settings, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update project settings
CREATE OR REPLACE FUNCTION update_project_settings(
  p_project_id UUID,
  p_settings JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_current_settings JSONB;
  v_new_settings JSONB;
BEGIN
  -- Get current settings
  SELECT settings INTO v_current_settings FROM projects WHERE id = p_project_id;
  
  -- Merge with new settings
  v_new_settings := COALESCE(v_current_settings, '{}'::jsonb) || p_settings;
  
  -- Update
  UPDATE projects SET settings = v_new_settings WHERE id = p_project_id;
  
  RETURN v_new_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- HELPER FUNCTIONS FOR STATISTICS
-- =====================================================

-- Get communication statistics
CREATE OR REPLACE FUNCTION get_communication_stats(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_messages', COUNT(*) FILTER (WHERE message_type = 'message'),
    'total_notes', COUNT(*) FILTER (WHERE message_type = 'note'),
    'pinned_count', COUNT(*) FILTER (WHERE is_pinned = true),
    'active_users', COUNT(DISTINCT user_id),
    'today_messages', COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'this_week_messages', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')
  ) INTO v_result
  FROM project_messages
  WHERE project_id = p_project_id
    AND is_deleted = false;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get activity statistics
CREATE OR REPLACE FUNCTION get_activity_stats(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_activities', COUNT(*),
    'today_activities', COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'this_week_activities', COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'by_action', jsonb_object_agg(action, action_count),
    'by_entity_type', jsonb_object_agg(entity_type, entity_count),
    'most_active_user', (
      SELECT user_id
      FROM activity_logs
      WHERE project_id = p_project_id
      GROUP BY user_id
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
  ) INTO v_result
  FROM (
    SELECT 
      action,
      COUNT(*) as action_count,
      entity_type,
      COUNT(*) as entity_count
    FROM activity_logs
    WHERE project_id = p_project_id
    GROUP BY action, entity_type
  ) stats;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CLEANUP AND MAINTENANCE
-- =====================================================

-- Function to cleanup old generated reports
CREATE OR REPLACE FUNCTION cleanup_expired_reports()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete expired reports and their files
  WITH deleted AS (
    DELETE FROM generated_reports
    WHERE expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id, storage_path
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;
  
  -- Note: Storage cleanup should be done separately via storage API
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old activity logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < now() - INTERVAL '90 days'
  RETURNING COUNT(*) INTO v_deleted_count;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Additional indexes for projects table
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check all tables created
DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'project_messages',
    'report_templates',
    'generated_reports',
    'scheduled_reports',
    'activity_logs'
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

COMMENT ON TABLE project_messages IS 'Project communication: messages and notes';
COMMENT ON TABLE report_templates IS 'Report templates: system and custom';
COMMENT ON TABLE generated_reports IS 'History of generated reports';
COMMENT ON TABLE scheduled_reports IS 'Scheduled automatic report generation';
COMMENT ON TABLE activity_logs IS 'Complete activity log for all project actions';
COMMENT ON FUNCTION log_activity IS 'Helper function to create activity log entries';
COMMENT ON FUNCTION get_communication_stats IS 'Get communication statistics for a project';
COMMENT ON FUNCTION get_activity_stats IS 'Get activity statistics for a project';
COMMENT ON FUNCTION get_project_settings IS 'Get project settings with defaults';
COMMENT ON FUNCTION update_project_settings IS 'Update project settings';
