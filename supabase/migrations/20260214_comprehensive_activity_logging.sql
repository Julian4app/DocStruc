-- Comprehensive Activity Logging for All Entities
-- This migration adds activity logging triggers for diary entries, messages, milestones, and file uploads

-- ============================================
-- DIARY ENTRIES ACTIVITY LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_diary_entry_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.project_id,
      'created',
      'diary_entry',
      NEW.id,
      format('Tagebucheintrag vom %s', to_char(NEW.entry_date, 'DD.MM.YYYY')),
      '{}'::jsonb,
      jsonb_build_object(
        'entry_date', NEW.entry_date,
        'weather', NEW.weather,
        'temperature', NEW.temperature
      ),
      jsonb_build_object('workers_present', NEW.workers_present)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_activity(
      NEW.project_id,
      'updated',
      'diary_entry',
      NEW.id,
      format('Tagebucheintrag vom %s', to_char(NEW.entry_date, 'DD.MM.YYYY')),
      jsonb_build_object(
        'work_performed', OLD.work_performed,
        'progress_notes', OLD.progress_notes
      ),
      jsonb_build_object(
        'work_performed', NEW.work_performed,
        'progress_notes', NEW.progress_notes
      ),
      '{}'::jsonb
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity(
      OLD.project_id,
      'deleted',
      'diary_entry',
      OLD.id,
      format('Tagebucheintrag vom %s', to_char(OLD.entry_date, 'DD.MM.YYYY')),
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS diary_entries_activity_log_trigger ON diary_entries;
CREATE TRIGGER diary_entries_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION log_diary_entry_activity();

-- ============================================
-- PROJECT MESSAGES ACTIVITY LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_title TEXT;
BEGIN
  -- Truncate content for title
  v_entity_title := substring(COALESCE(NEW.content, OLD.content) from 1 for 50);
  IF length(COALESCE(NEW.content, OLD.content)) > 50 THEN
    v_entity_title := v_entity_title || '...';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.project_id,
      'created',
      CASE WHEN NEW.message_type = 'note' THEN 'note' ELSE 'message' END,
      NEW.id,
      v_entity_title,
      '{}'::jsonb,
      jsonb_build_object(
        'message_type', NEW.message_type,
        'is_pinned', NEW.is_pinned
      ),
      jsonb_build_object('content_length', length(NEW.content))
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log different actions based on what changed
    IF OLD.content != NEW.content THEN
      PERFORM log_activity(
        NEW.project_id,
        'updated',
        CASE WHEN NEW.message_type = 'note' THEN 'note' ELSE 'message' END,
        NEW.id,
        v_entity_title,
        jsonb_build_object('content', substring(OLD.content from 1 for 100)),
        jsonb_build_object('content', substring(NEW.content from 1 for 100)),
        '{}'::jsonb
      );
    END IF;
    
    IF OLD.is_pinned != NEW.is_pinned AND NEW.is_pinned = TRUE THEN
      PERFORM log_activity(
        NEW.project_id,
        'pinned',
        CASE WHEN NEW.message_type = 'note' THEN 'note' ELSE 'message' END,
        NEW.id,
        v_entity_title,
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb
      );
    END IF;
    
    IF OLD.is_deleted != NEW.is_deleted AND NEW.is_deleted = TRUE THEN
      PERFORM log_activity(
        NEW.project_id,
        'deleted',
        CASE WHEN NEW.message_type = 'note' THEN 'note' ELSE 'message' END,
        NEW.id,
        v_entity_title,
        '{}'::jsonb,
        '{}'::jsonb,
        '{}'::jsonb
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS project_messages_activity_log_trigger ON project_messages;
CREATE TRIGGER project_messages_activity_log_trigger
  AFTER INSERT OR UPDATE ON project_messages
  FOR EACH ROW EXECUTE FUNCTION log_message_activity();

-- ============================================
-- MILESTONES (TIMELINE_EVENTS) ACTIVITY LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_milestone_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_activity(
      NEW.project_id,
      'created',
      'milestone',
      NEW.id,
      NEW.title,
      '{}'::jsonb,
      jsonb_build_object(
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'event_type', NEW.event_type
      ),
      jsonb_build_object('description', NEW.description)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log other updates (title, description, dates, etc.)
    IF OLD.title != NEW.title OR 
       COALESCE(OLD.description, '') != COALESCE(NEW.description, '') OR
       COALESCE(OLD.start_date::TEXT, '') != COALESCE(NEW.start_date::TEXT, '') OR
       COALESCE(OLD.end_date::TEXT, '') != COALESCE(NEW.end_date::TEXT, '') THEN
      PERFORM log_activity(
        NEW.project_id,
        'updated',
        'milestone',
        NEW.id,
        NEW.title,
        jsonb_build_object(
          'title', OLD.title,
          'start_date', OLD.start_date,
          'end_date', OLD.end_date
        ),
        jsonb_build_object(
          'title', NEW.title,
          'start_date', NEW.start_date,
          'end_date', NEW.end_date
        ),
        '{}'::jsonb
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity(
      OLD.project_id,
      'deleted',
      'milestone',
      OLD.id,
      OLD.title,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS timeline_events_activity_log_trigger ON timeline_events;
CREATE TRIGGER timeline_events_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON timeline_events
  FOR EACH ROW EXECUTE FUNCTION log_milestone_activity();

-- ============================================
-- STORAGE (FILE UPLOADS) ACTIVITY LOGGING
-- Note: This is handled via storage hooks in Supabase
-- We create a function that can be called from the application
-- ============================================

CREATE OR REPLACE FUNCTION log_file_upload(
  p_project_id UUID,
  p_file_name TEXT,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_entity_type TEXT DEFAULT 'file',
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  RETURN log_activity(
    p_project_id,
    'uploaded',
    p_entity_type,
    p_entity_id,
    p_file_name,
    '{}'::jsonb,
    jsonb_build_object(
      'file_path', p_file_path,
      'file_size', p_file_size
    ),
    jsonb_build_object('timestamp', now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ENHANCED TASK ACTIVITY LOGGING
-- Update existing task trigger to log more details
-- ============================================

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
      jsonb_build_object(
        'status', NEW.status,
        'priority', NEW.priority,
        'assigned_to', NEW.assigned_to
      ),
      jsonb_build_object('task_type', NEW.task_type)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status != NEW.status THEN
      PERFORM log_activity(
        NEW.project_id,
        CASE WHEN NEW.status = 'done' THEN 'completed' ELSE 'status_changed' END,
        CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
        NEW.id,
        NEW.title,
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status),
        '{}'::jsonb
      );
    END IF;
    
    -- Log priority changes
    IF OLD.priority != NEW.priority THEN
      PERFORM log_activity(
        NEW.project_id,
        'priority_changed',
        CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
        NEW.id,
        NEW.title,
        jsonb_build_object('priority', OLD.priority),
        jsonb_build_object('priority', NEW.priority),
        '{}'::jsonb
      );
    END IF;
    
    -- Log assignment changes
    IF COALESCE(OLD.assigned_to::TEXT, '') != COALESCE(NEW.assigned_to::TEXT, '') THEN
      IF NEW.assigned_to IS NOT NULL THEN
        PERFORM log_activity(
          NEW.project_id,
          'assigned',
          CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
          NEW.id,
          NEW.title,
          '{}'::jsonb,
          jsonb_build_object('assigned_to', NEW.assigned_to),
          '{}'::jsonb
        );
      ELSE
        PERFORM log_activity(
          NEW.project_id,
          'unassigned',
          CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
          NEW.id,
          NEW.title,
          jsonb_build_object('assigned_to', OLD.assigned_to),
          '{}'::jsonb,
          '{}'::jsonb
        );
      END IF;
    END IF;
    
    -- Log other updates (title, description, etc.)
    IF OLD.title != NEW.title OR COALESCE(OLD.description, '') != COALESCE(NEW.description, '') THEN
      PERFORM log_activity(
        NEW.project_id,
        'updated',
        CASE WHEN NEW.task_type = 'defect' THEN 'defect' ELSE 'task' END,
        NEW.id,
        NEW.title,
        jsonb_build_object('title', OLD.title),
        jsonb_build_object('title', NEW.title),
        jsonb_build_object('fields', ARRAY['title', 'description'])
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_activity(
      OLD.project_id,
      'deleted',
      CASE WHEN OLD.task_type = 'defect' THEN 'defect' ELSE 'task' END,
      OLD.id,
      OLD.title,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the existing trigger
DROP TRIGGER IF EXISTS tasks_activity_log_trigger ON tasks;
CREATE TRIGGER tasks_activity_log_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_task_activity();

-- ============================================
-- COMMENTS ON FUNCTIONS
-- ============================================

COMMENT ON FUNCTION log_diary_entry_activity IS 'Logs all diary entry activities (create, update, delete)';
COMMENT ON FUNCTION log_message_activity IS 'Logs all message and note activities (create, update, pin, delete)';
COMMENT ON FUNCTION log_milestone_activity IS 'Logs all milestone (timeline_events) activities (create, update, delete)';
COMMENT ON FUNCTION log_file_upload IS 'Logs file upload activities - call this from application code';
COMMENT ON FUNCTION log_task_activity IS 'Enhanced task activity logging with status, priority, and assignment tracking';
