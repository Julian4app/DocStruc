-- =====================================================
-- FIX VOICE MESSAGES STORAGE PUBLIC ACCESS
-- Created: 2026-02-12
-- Purpose: Allow public access to voice message files in public bucket
-- Issue: Public bucket with authenticated-only RLS policies blocks audio playback
-- =====================================================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public can view voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Public can view project info images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can view project info images" ON storage.objects;

-- Add policy to allow PUBLIC (unauthenticated) access to voice messages
-- This is required for <audio> elements to load files from public URLs
CREATE POLICY "Public can view voice messages"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'project-voice-messages'
);

-- Also add policy for public access to project info images
CREATE POLICY "Public can view project info images"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'project-info-images'
);

-- Recreate the authenticated SELECT policies for backwards compatibility
-- (these will allow authenticated users to query storage.objects table directly)
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

-- Note: The INSERT, UPDATE, DELETE policies remain unchanged and still require authentication

