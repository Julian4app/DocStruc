-- Fix storage policies for project-files bucket
-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload files to their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can view files from their projects" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their projects" ON storage.objects;

-- Create corrected storage policies with proper path handling
CREATE POLICY "Users can upload files to their projects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND (
    -- Check if user is project owner
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id::text = split_part(name, '/', 1)
      AND owner_id = auth.uid()
    )
    OR
    -- Check if user is project member
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id::text = split_part(name, '/', 1)
      AND user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can view files from their projects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND (
    -- Check if user is project owner
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id::text = split_part(name, '/', 1)
      AND owner_id = auth.uid()
    )
    OR
    -- Check if user is project member
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id::text = split_part(name, '/', 1)
      AND user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can delete files from their projects"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files'
  AND (
    -- Only project owners can delete
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id::text = split_part(name, '/', 1)
      AND owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can update files from their projects"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-files'
  AND (
    -- Check if user is project owner
    EXISTS (
      SELECT 1 FROM projects 
      WHERE id::text = split_part(name, '/', 1)
      AND owner_id = auth.uid()
    )
    OR
    -- Check if user is project member
    EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_id::text = split_part(name, '/', 1)
      AND user_id = auth.uid()
    )
  )
);
