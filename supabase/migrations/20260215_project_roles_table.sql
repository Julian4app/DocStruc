-- Migration: Add project_roles table to track which roles are available for each project
-- Date: 2026-02-15

-- Create project_roles junction table
CREATE TABLE IF NOT EXISTS project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, role_id)
);

-- Add RLS policies
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view project_roles if they have access to the project
CREATE POLICY "Users can view project_roles for their projects"
  ON project_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_roles.project_id
      AND (
        projects.created_by = auth.uid()
        OR projects.owner_id = auth.uid()
        OR has_project_access(project_roles.project_id)
      )
    )
  );

-- Policy: Only project owners can insert project_roles
CREATE POLICY "Project owners can manage project_roles"
  ON project_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_roles.project_id
      AND (
        projects.created_by = auth.uid()
        OR projects.owner_id = auth.uid()
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_roles_project_id ON project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roles_role_id ON project_roles(role_id);

-- Add comment
COMMENT ON TABLE project_roles IS 'Tracks which roles are available for assignment in each project';
