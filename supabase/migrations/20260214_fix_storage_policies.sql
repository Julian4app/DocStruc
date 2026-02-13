-- Fix storage policies for project-files bucket
-- First, ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop ALL existing policies for this bucket to avoid conflicts
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname LIKE '%project%file%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Create NEW corrected storage policies with proper path handling
CREATE POLICY "project_files_insert_policy"
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

CREATE POLICY "project_files_select_policy"
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

CREATE POLICY "project_files_update_policy"
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

CREATE POLICY "project_files_delete_policy"
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
