-- Project Files System with Folders, Versioning, and Sharing
-- Manages document organization, version control, and access permissions

-- Create folders table
CREATE TABLE IF NOT EXISTS project_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create files table
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES project_folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_latest_version BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create file versions table for version control
CREATE TABLE IF NOT EXISTS project_file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_notes TEXT,
  
  UNIQUE(file_id, version)
);

-- Create file shares table for sharing permissions
CREATE TABLE IF NOT EXISTS project_file_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES project_files(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES project_folders(id) ON DELETE CASCADE,
  shared_with_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  shared_with_role TEXT, -- 'viewer', 'editor', 'admin'
  permission_level TEXT NOT NULL DEFAULT 'viewer', -- 'viewer', 'editor', 'owner'
  can_download BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  can_share BOOLEAN NOT NULL DEFAULT false,
  shared_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Either file_id or folder_id must be set
  CONSTRAINT check_share_target CHECK (
    (file_id IS NOT NULL AND folder_id IS NULL) OR
    (file_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_folders_project_id ON project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent_id ON project_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_folder_id ON project_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_project_files_latest ON project_files(project_id, is_latest_version);
CREATE INDEX IF NOT EXISTS idx_project_file_versions_file_id ON project_file_versions(file_id);
CREATE INDEX IF NOT EXISTS idx_project_file_shares_file_id ON project_file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_project_file_shares_folder_id ON project_file_shares(folder_id);
CREATE INDEX IF NOT EXISTS idx_project_file_shares_user_id ON project_file_shares(shared_with_user_id);

-- Enable RLS
ALTER TABLE project_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_file_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_folders
CREATE POLICY "Users can view folders in their projects"
  ON project_folders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_folders.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_folders.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create folders in their projects"
  ON project_folders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_folders.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_folders.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update folders in their projects"
  ON project_folders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_folders.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id = project_folders.project_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete folders in their projects"
  ON project_folders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_folders.project_id 
      AND owner_id = auth.uid()
    )
  );

-- RLS Policies for project_files
CREATE POLICY "Users can view files in their projects"
  ON project_files FOR SELECT
  USING (
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
    OR EXISTS (
      SELECT 1 FROM project_file_shares
      WHERE file_id = project_files.id
      AND shared_with_user_id = auth.uid()
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

CREATE POLICY "Users can upload files to their projects"
  ON project_files FOR INSERT
  WITH CHECK (
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
  );

CREATE POLICY "Users can update files in their projects"
  ON project_files FOR UPDATE
  USING (
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
    OR EXISTS (
      SELECT 1 FROM project_file_shares
      WHERE file_id = project_files.id
      AND shared_with_user_id = auth.uid()
      AND can_edit = true
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

CREATE POLICY "Users can delete files in their projects"
  ON project_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id = project_files.project_id 
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_file_shares
      WHERE file_id = project_files.id
      AND shared_with_user_id = auth.uid()
      AND can_delete = true
      AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- RLS Policies for project_file_versions
CREATE POLICY "Users can view file versions"
  ON project_file_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = project_file_versions.file_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = p.id 
        AND user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can create file versions"
  ON project_file_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = project_file_versions.file_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM project_members 
        WHERE project_id = p.id 
        AND user_id = auth.uid()
      ))
    )
  );

-- RLS Policies for project_file_shares
CREATE POLICY "Users can view file shares"
  ON project_file_shares FOR SELECT
  USING (
    shared_with_user_id = auth.uid()
    OR shared_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = project_file_shares.file_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create file shares"
  ON project_file_shares FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_files pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = project_file_shares.file_id
      AND (p.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM project_file_shares
        WHERE file_id = pf.id
        AND shared_with_user_id = auth.uid()
        AND can_share = true
      ))
    )
    OR EXISTS (
      SELECT 1 FROM project_folders pf
      JOIN projects p ON p.id = pf.project_id
      WHERE pf.id = project_file_shares.folder_id
      AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their shares"
  ON project_file_shares FOR DELETE
  USING (shared_by = auth.uid() OR shared_with_user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_project_folders_updated_at
  BEFORE UPDATE ON project_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for project files if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for project files
CREATE POLICY "Users can upload files to their projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view files from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id::text = (storage.foldername(name))[1]
      AND owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id::text = (storage.foldername(name))[1]
      AND user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete files from their projects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files'
  AND EXISTS (
    SELECT 1 FROM projects 
    WHERE id::text = (storage.foldername(name))[1]
    AND owner_id = auth.uid()
  )
);
