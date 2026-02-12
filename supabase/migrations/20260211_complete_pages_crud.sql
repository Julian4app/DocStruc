-- =====================================================
-- COMPLETE CRUD FOR: Schedule, Time Tracking, Documentation, Diary
-- Created: 2026-02-11
-- Purpose: Enable full CRUD operations for all project pages
-- =====================================================

-- =====================================================
-- 1. TIMELINE_EVENTS TABLE (Termine & Ablauf)
-- Already created in previous migration, but add missing columns
-- =====================================================

-- Ensure timeline_events has all needed columns
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_timeline_events_created_by ON timeline_events(created_by);

-- Update RLS policies for timeline_events to allow members to create/edit/delete
-- (Previous migration only had owner + permission-based access)

DROP POLICY IF EXISTS "Members with schedule permission can edit events" ON timeline_events;
CREATE POLICY "Members with schedule permission can edit events"
  ON timeline_events FOR UPDATE
  USING (
    -- Owner can edit
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    -- Member with permission can edit
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'edit')
    OR
    -- Creator can edit their own events
    created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'edit')
    OR
    created_by = auth.uid()
  );

-- =====================================================
-- 2. TIME_ENTRIES TABLE (Zeiten & Dauer)
-- =====================================================

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  
  -- Time tracking
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL, -- Calculated or manual entry
  
  -- Metadata
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  is_billable BOOLEAN DEFAULT true,
  hourly_rate NUMERIC(10, 2),
  
  -- Timer state
  is_running BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for time_entries
CREATE POLICY "Users can view their own time entries"
  ON time_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Project owners can view all time entries"
  ON time_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Project members can view time entries with permission"
  ON time_entries FOR SELECT
  USING (
    check_user_permission(auth.uid(), time_entries.project_id, 'time_tracking', 'view')
  );

CREATE POLICY "Users can create their own time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
      )
      OR
      check_user_permission(auth.uid(), time_entries.project_id, 'time_tracking', 'create')
    )
  );

CREATE POLICY "Users can update their own time entries"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Project owners can update all time entries"
  ON time_entries FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own time entries"
  ON time_entries FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Project owners can delete time entries"
  ON time_entries FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
CREATE TRIGGER update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 3. DOCUMENTATION_ITEMS TABLE (Dokumentation)
-- =====================================================

CREATE TABLE IF NOT EXISTS documentation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  
  -- Content
  title TEXT NOT NULL,
  description TEXT,
  content TEXT, -- Rich text content
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'progress', 'issue', 'solution', 'meeting', 'inspection', 'other')),
  
  -- Media flags
  has_photos BOOLEAN DEFAULT false,
  has_videos BOOLEAN DEFAULT false,
  has_documents BOOLEAN DEFAULT false,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id) NOT NULL,
  tags TEXT[],
  is_archived BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE documentation_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Project members can view documentation"
  ON documentation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_members WHERE project_id = documentation_items.project_id AND user_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'view')
  );

CREATE POLICY "Members with permission can create documentation"
  ON documentation_items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
      )
      OR
      check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'create')
    )
  );

CREATE POLICY "Members with permission can edit documentation"
  ON documentation_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'edit')
    OR
    created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'edit')
    OR
    created_by = auth.uid()
  );

CREATE POLICY "Members with permission can delete documentation"
  ON documentation_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'delete')
    OR
    created_by = auth.uid()
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documentation_items_project_id ON documentation_items(project_id);
CREATE INDEX IF NOT EXISTS idx_documentation_items_task_id ON documentation_items(task_id);
CREATE INDEX IF NOT EXISTS idx_documentation_items_created_by ON documentation_items(created_by);
CREATE INDEX IF NOT EXISTS idx_documentation_items_category ON documentation_items(category);

-- Trigger
DROP TRIGGER IF EXISTS update_documentation_items_updated_at ON documentation_items;
CREATE TRIGGER update_documentation_items_updated_at
  BEFORE UPDATE ON documentation_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. DOCUMENTATION_MEDIA TABLE (Photos, Videos, Files)
-- =====================================================

CREATE TABLE IF NOT EXISTS documentation_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documentation_item_id UUID REFERENCES documentation_items(id) ON DELETE CASCADE NOT NULL,
  
  -- File information
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  media_type TEXT CHECK (media_type IN ('photo', 'video', 'document', 'audio')) NOT NULL,
  
  -- Metadata
  caption TEXT,
  thumbnail_path TEXT,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE documentation_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view media for accessible documentation"
  ON documentation_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM documentation_items di
    WHERE di.id = documentation_media.documentation_item_id
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = di.project_id AND owner_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM project_members WHERE project_id = di.project_id AND user_id = auth.uid())
    )
  ));

CREATE POLICY "Users can create media for their documentation"
  ON documentation_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM documentation_items di
    WHERE di.id = documentation_media.documentation_item_id
    AND (
      di.created_by = auth.uid()
      OR
      EXISTS (SELECT 1 FROM projects WHERE id = di.project_id AND owner_id = auth.uid())
    )
  ));

CREATE POLICY "Users can delete media from their documentation"
  ON documentation_media FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM documentation_items di
    WHERE di.id = documentation_media.documentation_item_id
    AND (
      di.created_by = auth.uid()
      OR
      EXISTS (SELECT 1 FROM projects WHERE id = di.project_id AND owner_id = auth.uid())
    )
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documentation_media_doc_id ON documentation_media(documentation_item_id);

-- =====================================================
-- 5. DIARY_ENTRIES TABLE (Bautagebuch)
-- =====================================================

CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  
  -- Daily information
  entry_date DATE NOT NULL,
  
  -- Weather
  weather TEXT CHECK (weather IN ('sunny', 'cloudy', 'rainy', 'snowy', 'stormy', 'foggy')) DEFAULT 'sunny',
  temperature INTEGER, -- In Celsius
  
  -- Personnel
  workers_present INTEGER,
  workers_list TEXT, -- Comma-separated names or details
  contractors TEXT, -- External contractors present
  
  -- Work performed
  work_performed TEXT NOT NULL,
  progress_notes TEXT,
  
  -- Events
  special_events TEXT,
  visitors TEXT,
  inspections TEXT,
  
  -- Materials & Equipment
  deliveries TEXT,
  materials_used TEXT,
  equipment_used TEXT,
  
  -- Issues & Safety
  incidents TEXT,
  safety_notes TEXT,
  delays TEXT,
  delay_reasons TEXT,
  
  -- Hours
  working_hours_start TIME,
  working_hours_end TIME,
  
  -- Metadata
  created_by UUID REFERENCES profiles(id) NOT NULL,
  photos_attached BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure one entry per day per project
  UNIQUE(project_id, entry_date)
);

-- Enable RLS
ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Project members can view diary entries"
  ON diary_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_members WHERE project_id = diary_entries.project_id AND user_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'view')
  );

CREATE POLICY "Members with permission can create diary entries"
  ON diary_entries FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
      )
      OR
      check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'create')
    )
  );

CREATE POLICY "Members with permission can edit diary entries"
  ON diary_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'edit')
    OR
    created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'edit')
    OR
    created_by = auth.uid()
  );

CREATE POLICY "Members with permission can delete diary entries"
  ON diary_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'delete')
    OR
    created_by = auth.uid()
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diary_entries_project_id ON diary_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_entry_date ON diary_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_diary_entries_created_by ON diary_entries(created_by);

-- Trigger
DROP TRIGGER IF EXISTS update_diary_entries_updated_at ON diary_entries;
CREATE TRIGGER update_diary_entries_updated_at
  BEFORE UPDATE ON diary_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. DIARY_PHOTOS TABLE (Bautagebuch Fotos)
-- =====================================================

CREATE TABLE IF NOT EXISTS diary_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_entry_id UUID REFERENCES diary_entries(id) ON DELETE CASCADE NOT NULL,
  
  -- File information
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  
  -- Metadata
  caption TEXT,
  location TEXT, -- Where on site the photo was taken
  timestamp TIMESTAMPTZ DEFAULT now(),
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE diary_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view photos for accessible diary entries"
  ON diary_photos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM diary_entries de
    WHERE de.id = diary_photos.diary_entry_id
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = de.project_id AND owner_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM project_members WHERE project_id = de.project_id AND user_id = auth.uid())
    )
  ));

CREATE POLICY "Users can create photos for their diary entries"
  ON diary_photos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM diary_entries de
    WHERE de.id = diary_photos.diary_entry_id
    AND (
      de.created_by = auth.uid()
      OR
      EXISTS (SELECT 1 FROM projects WHERE id = de.project_id AND owner_id = auth.uid())
    )
  ));

CREATE POLICY "Users can delete photos from their diary entries"
  ON diary_photos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM diary_entries de
    WHERE de.id = diary_photos.diary_entry_id
    AND (
      de.created_by = auth.uid()
      OR
      EXISTS (SELECT 1 FROM projects WHERE id = de.project_id AND owner_id = auth.uid())
    )
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_diary_photos_entry_id ON diary_photos(diary_entry_id);

-- =====================================================
-- 7. STORAGE BUCKETS FOR DOCUMENTATION & DIARY
-- =====================================================

-- Documentation media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentation-media', 'documentation-media', false)
ON CONFLICT (id) DO NOTHING;

-- Diary photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('diary-photos', 'diary-photos', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 8. STORAGE POLICIES
-- =====================================================

-- Documentation media storage policies
CREATE POLICY "Project members can upload documentation media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documentation-media' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p 
      WHERE p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  );

CREATE POLICY "Project members can view documentation media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentation-media' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p 
      WHERE p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  );

CREATE POLICY "Project owners can delete documentation media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documentation-media' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

-- Diary photos storage policies
CREATE POLICY "Project members can upload diary photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'diary-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p 
      WHERE p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  );

CREATE POLICY "Project members can view diary photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'diary-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p 
      WHERE p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  );

CREATE POLICY "Project owners can delete diary photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'diary-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT p.id::text FROM projects p WHERE p.owner_id = auth.uid()
    )
  );

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function to get time statistics for a project
CREATE OR REPLACE FUNCTION get_time_statistics(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_hours', COALESCE(SUM(duration_minutes) / 60.0, 0),
    'this_week', COALESCE(SUM(CASE WHEN date >= CURRENT_DATE - INTERVAL '7 days' THEN duration_minutes ELSE 0 END) / 60.0, 0),
    'this_month', COALESCE(SUM(CASE WHEN date >= DATE_TRUNC('month', CURRENT_DATE) THEN duration_minutes ELSE 0 END) / 60.0, 0),
    'billable_hours', COALESCE(SUM(CASE WHEN is_billable THEN duration_minutes ELSE 0 END) / 60.0, 0),
    'total_cost', COALESCE(SUM((duration_minutes / 60.0) * COALESCE(hourly_rate, 0)), 0),
    'unique_users', COUNT(DISTINCT user_id)
  ) INTO result
  FROM time_entries
  WHERE project_id = p_project_id;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_time_statistics(UUID) TO authenticated;

-- Function to get documentation statistics
CREATE OR REPLACE FUNCTION get_documentation_statistics(p_project_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_items', COUNT(*),
    'with_photos', SUM(CASE WHEN has_photos THEN 1 ELSE 0 END),
    'with_videos', SUM(CASE WHEN has_videos THEN 1 ELSE 0 END),
    'with_documents', SUM(CASE WHEN has_documents THEN 1 ELSE 0 END),
    'by_category', (
      SELECT json_object_agg(category, count)
      FROM (
        SELECT category, COUNT(*) as count
        FROM documentation_items
        WHERE project_id = p_project_id AND NOT is_archived
        GROUP BY category
      ) cat_counts
    )
  ) INTO result
  FROM documentation_items
  WHERE project_id = p_project_id AND NOT is_archived;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_documentation_statistics(UUID) TO authenticated;

-- Function to get diary entry for specific date (or create placeholder)
CREATE OR REPLACE FUNCTION get_or_create_diary_entry(p_project_id UUID, p_date DATE)
RETURNS UUID AS $$
DECLARE
  entry_id UUID;
  user_id_var UUID;
BEGIN
  -- Get current user
  user_id_var := auth.uid();
  
  -- Try to get existing entry
  SELECT id INTO entry_id
  FROM diary_entries
  WHERE project_id = p_project_id AND entry_date = p_date;
  
  -- If not exists, create new entry
  IF entry_id IS NULL THEN
    INSERT INTO diary_entries (project_id, entry_date, work_performed, created_by)
    VALUES (p_project_id, p_date, '', user_id_var)
    RETURNING id INTO entry_id;
  END IF;
  
  RETURN entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_or_create_diary_entry(UUID, DATE) TO authenticated;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

/**
 * SUMMARY OF CHANGES:
 * 
 * 1. TIME_ENTRIES table - Full time tracking with timer support
 * 2. DOCUMENTATION_ITEMS table - Rich documentation with categories
 * 3. DOCUMENTATION_MEDIA table - Photos, videos, documents
 * 4. DIARY_ENTRIES table - Daily construction diary
 * 5. DIARY_PHOTOS table - Photos for diary entries
 * 6. Storage buckets and policies for all media
 * 7. Helper functions for statistics
 * 8. All tables have proper RLS policies
 * 9. All tables have indexes for performance
 * 10. Triggers for updated_at columns
 * 
 * NEXT STEPS:
 * 1. Run this migration: psql "$DATABASE_URL" -f supabase/migrations/20260211_complete_pages_crud.sql
 * 2. Update frontend components to use new tables
 * 3. Implement CRUD operations in TypeScript
 * 4. Test all permissions
 */
