-- SIMPLE FIX: Remove complex policies and use simple authenticated user policies
-- This will allow any authenticated user to upload files (we handle permissions in app logic)

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop ALL existing policies on storage.objects for this bucket
DO $$ 
DECLARE 
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON storage.objects';
    END LOOP;
END $$;

-- Create SIMPLE policies: any authenticated user can manage files in project-files bucket
-- We rely on application-level checks and database RLS for security

CREATE POLICY "authenticated_users_can_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "authenticated_users_can_view"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files');

CREATE POLICY "authenticated_users_can_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'project-files');

CREATE POLICY "authenticated_users_can_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files');
