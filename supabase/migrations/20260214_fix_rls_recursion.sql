-- FIX: Remove infinite recursion in RLS policies
-- The issue: Policies on project_file_shares and project_file_versions query project_files,
-- which has RLS enabled, causing circular dependency

-- Step 1: Drop all problematic policies
DROP POLICY IF EXISTS "Users can view files in their projects" ON project_files;
DROP POLICY IF EXISTS "Users can upload files to their projects" ON project_files;
DROP POLICY IF EXISTS "Users can update files in their projects" ON project_files;
DROP POLICY IF EXISTS "Users can delete files in their projects" ON project_files;

DROP POLICY IF EXISTS "Users can view file versions" ON project_file_versions;
DROP POLICY IF EXISTS "Users can create file versions" ON project_file_versions;

DROP POLICY IF EXISTS "Users can view file shares" ON project_file_shares;
DROP POLICY IF EXISTS "Users can create file shares" ON project_file_shares;
DROP POLICY IF EXISTS "Users can delete file shares" ON project_file_shares;

-- Step 2: Create FIXED policies without circular dependencies

-- PROJECT_FILES policies - direct checks only, no subqueries to same table
CREATE POLICY "project_files_select"
  ON project_files FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_files.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_files.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "project_files_insert"
  ON project_files FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_files.project_id 
        AND owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = project_files.project_id 
        AND user_id = auth.uid()
      )
    )
  );

CREATE POLICY "project_files_update"
  ON project_files FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_files.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_files.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "project_files_delete"
  ON project_files FOR DELETE
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_files.project_id 
      AND owner_id = auth.uid()
    )
  );

-- PROJECT_FILE_VERSIONS policies - use direct project_id instead of joining through project_files
-- First add project_id to file_versions for direct lookup (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_file_versions' 
    AND column_name = 'project_id'
  ) THEN
    ALTER TABLE project_file_versions ADD COLUMN project_id UUID;
    
    -- Populate project_id from parent file
    UPDATE project_file_versions pfv
    SET project_id = pf.project_id
    FROM project_files pf
    WHERE pfv.file_id = pf.id;
    
    -- Make it NOT NULL after populating
    ALTER TABLE project_file_versions ALTER COLUMN project_id SET NOT NULL;
    
    -- Add foreign key
    ALTER TABLE project_file_versions 
    ADD CONSTRAINT project_file_versions_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    
    -- Add index
    CREATE INDEX idx_project_file_versions_project_id ON project_file_versions(project_id);
  END IF;
END $$;

CREATE POLICY "project_file_versions_select"
  ON project_file_versions FOR SELECT
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_file_versions.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_file_versions.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "project_file_versions_insert"
  ON project_file_versions FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_file_versions.project_id 
        AND owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = project_file_versions.project_id 
        AND user_id = auth.uid()
      )
    )
  );

-- PROJECT_FILE_SHARES policies - simplified, no recursive checks
CREATE POLICY "project_file_shares_select"
  ON project_file_shares FOR SELECT
  USING (
    shared_with_user_id = auth.uid()
    OR shared_by = auth.uid()
  );

CREATE POLICY "project_file_shares_insert"
  ON project_file_shares FOR INSERT
  WITH CHECK (
    shared_by = auth.uid()
  );

CREATE POLICY "project_file_shares_delete"
  ON project_file_shares FOR DELETE
  USING (
    shared_by = auth.uid()
    OR shared_with_user_id = auth.uid()
  );

-- Create trigger to automatically set project_id on file_versions insert
CREATE OR REPLACE FUNCTION set_file_version_project_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT project_id INTO NEW.project_id
  FROM project_files
  WHERE id = NEW.file_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_file_version_project_id_trigger ON project_file_versions;
CREATE TRIGGER set_file_version_project_id_trigger
  BEFORE INSERT ON project_file_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_file_version_project_id();
