
-- 1. Enable RLS on storage.objects (if not already enabled)
-- Note: 'storage' schema tables are usually managed by Supabase, but we can add policies.
-- Usually, you don't need to enable RLS on storage.objects manually, Supabase does it.
-- But we must ensure policies exist.

-- Function to check if policy exists to avoid errors (or just use DROP IF EXISTS)

-- Policy for 'logos' bucket
DROP POLICY IF EXISTS "Give admin access to logos" ON storage.objects;
CREATE POLICY "Give admin access to logos"
ON storage.objects FOR ALL
USING ( bucket_id = 'logos' )
WITH CHECK ( bucket_id = 'logos' );

-- Policy for 'company-files' bucket (used for general files and recipes)
-- Note: User code uses 'company-files'
DROP POLICY IF EXISTS "Give admin access to company-files" ON storage.objects;
CREATE POLICY "Give admin access to company-files"
ON storage.objects FOR ALL
USING ( bucket_id = 'company-files' )
WITH CHECK ( bucket_id = 'company-files' );


-- Policy for 'contracts' bucket (used in subscription tab)
-- Note: User code uses 'contracts'
DROP POLICY IF EXISTS "Give admin access to contracts" ON storage.objects;
CREATE POLICY "Give admin access to contracts"
ON storage.objects FOR ALL
USING ( bucket_id = 'contracts' )
WITH CHECK ( bucket_id = 'contracts' );


-- IMPORTANT: BUCKET CREATION
-- We cannot create buckets easily via standard SQL in the public schema without pg_net or using Supabase API.
-- However, we can try to insert into storage.buckets if the user has permissions.
-- This is often the way to do it in SQL migrations for Supabase.

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-files', 'company-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO UPDATE SET public = true;
