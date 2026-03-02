-- ============================================================
-- Migration: Add tags to project_files and icon_name to project_folders
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add tags column to project_files (text array, default empty)
ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- 2. Add icon_name column to project_folders (text, default 'Folder')
ALTER TABLE project_folders
  ADD COLUMN IF NOT EXISTS icon_name text DEFAULT 'Folder';

-- 3. Update existing rows to have empty tags array (not NULL)
UPDATE project_files
  SET tags = '{}'
  WHERE tags IS NULL;

-- 4. Update existing folders to have default icon
UPDATE project_folders
  SET icon_name = 'Folder'
  WHERE icon_name IS NULL;

-- Done!
