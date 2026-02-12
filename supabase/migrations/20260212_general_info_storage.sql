-- =====================================================
-- GENERAL INFO STORAGE BUCKETS
-- Created: 2026-02-12
-- Purpose: Create storage buckets for project info images and voice messages
-- =====================================================

-- =====================================================
-- 1. CREATE STORAGE BUCKETS
-- =====================================================

-- Create bucket for project info images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-info-images',
  'project-info-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create bucket for voice messages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-voice-messages',
  'project-voice-messages',
  true,
  52428800, -- 50MB
  ARRAY['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/m4a']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/m4a'];

-- =====================================================
-- 2. STORAGE POLICIES - PROJECT INFO IMAGES
-- =====================================================

-- Allow authenticated users to upload images to their own projects
CREATE POLICY "Users can upload project info images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

-- Allow authenticated users to view images from their projects
CREATE POLICY "Users can view project info images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
    )
  )
);

-- Allow users to update their project images
CREATE POLICY "Users can update project info images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

-- Allow users to delete their project images
CREATE POLICY "Users can delete project info images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

-- =====================================================
-- 3. STORAGE POLICIES - VOICE MESSAGES
-- =====================================================

-- Allow authenticated users to upload voice messages
CREATE POLICY "Users can upload voice messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

-- Allow authenticated users to view voice messages
CREATE POLICY "Users can view voice messages"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
    )
  )
);

-- Allow users to update voice messages
CREATE POLICY "Users can update voice messages"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

-- Allow users to delete voice messages
CREATE POLICY "Users can delete voice messages"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);
