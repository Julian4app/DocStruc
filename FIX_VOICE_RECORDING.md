# Fix Voice Recording - REQUIRED SQL MIGRATION

## Problem
Voice recordings fail with "internal error" because storage RLS policies block uploads.

## Root Cause
The `project-voice-messages` bucket has RLS policies that:
1. Block INSERT unless user owns the project (correct)
2. Block SELECT even for public access (incorrect - prevents audio playback)

## Solution
Run this SQL in Supabase SQL Editor to fix both upload and playback:

**Go to:** https://vnwovhrwaxbewelgfwsy.supabase.co/project/_/sql

**Paste and run this SQL:**

```sql
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
```

## After Running SQL

Test the fix by running:
```bash
node scripts/test-voice-upload.mjs
```

You should see: `✅ All tests passed! Voice message upload is working correctly.`

## What This Fixes

1. **"Internal error" on first save** - Adds public SELECT policy so audio files can be accessed
2. **Empty audio on second save** - The recording code is correct, this was a permissions issue
3. **Audio playback** - Browser `<audio>` elements can now load files from public URLs

## Security Note

The buckets remain secure:
- ✅ Only authenticated project owners/members can UPLOAD files
- ✅ Only authenticated project owners/members can DELETE files  
- ✅ Anyone can VIEW/DOWNLOAD files (required for audio playback)

This is standard for public storage buckets with user-generated content.
