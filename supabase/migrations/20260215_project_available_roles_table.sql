-- Migration: Add project_available_roles table to track which roles are available for each project
-- Date: 2026-02-15
-- Note: Renamed from 'project_roles' to avoid conflict with existing table

-- Step 1: Drop existing policies first (if they exist)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view project_available_roles for their projects" ON project_available_roles;
  DROP POLICY IF EXISTS "Project owners can manage project_available_roles" ON project_available_roles;
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist yet, that's fine
  NULL;
END $$;

-- Step 2: Drop and recreate table
DROP TABLE IF EXISTS project_available_roles CASCADE;

-- Step 3: Create project_available_roles junction table
CREATE TABLE project_available_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, role_id)
);

-- Step 4: Create indexes BEFORE enabling RLS
CREATE INDEX idx_project_available_roles_project_id ON project_available_roles(project_id);
CREATE INDEX idx_project_available_roles_role_id ON project_available_roles(role_id);

-- Step 5: Enable RLS
ALTER TABLE project_available_roles ENABLE ROW LEVEL SECURITY;

-- Step 6: Add RLS policies
-- Policy: Users can view project_available_roles if they have access to the project
CREATE POLICY "Users can view project_available_roles for their projects"
  ON project_available_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_available_roles.project_id
      AND (
        projects.created_by = auth.uid()
        OR projects.owner_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_available_roles.project_id
      AND project_members.user_id = auth.uid()
    )
  );

-- Policy: Only project owners can manage project_available_roles
CREATE POLICY "Project owners can manage project_available_roles"
  ON project_available_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_available_roles.project_id
      AND (
        projects.created_by = auth.uid()
        OR projects.owner_id = auth.uid()
      )
    )
  );

-- Step 7: Add table comment
COMMENT ON TABLE project_available_roles IS 'Tracks which roles are available for assignment in each project';
