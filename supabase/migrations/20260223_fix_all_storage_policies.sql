-- ============================================================================
-- FIX ALL STORAGE BUCKET POLICIES  (v4 — definitive)
-- ============================================================================
-- Security model:
--   • All media buckets are PUBLIC so getPublicUrl() works in <img>/<audio> tags.
--   • Only authenticated users can upload/update/delete (write operations).
--   • SELECT has no restriction (public read — consistent with getPublicUrl usage).
--   • Project-level access control is enforced at the DATABASE table level via
--     project_members RLS. We do NOT repeat it in storage because path formats
--     differ between web and Flutter apps, making path-based checks unreliable.
--
-- Bucket path formats reference:
--   task-attachments       web:     {projectId}/{taskId}/{filename}
--   task-images            flutter: {projectId}/defects/{taskId}/...  or  tasks/...
--   task-docs              flutter: {projectId}/tasks/{taskId}/...
--   project-files          both:    {projectId}/...
--   project-images         flutter: projects/{projectId}/...   web: {ts}-{file}
--   project-info-images    web:     {projectId}/{file}         flutter: {uid}/{projectId}/{file}
--   project-voice-messages web:     {projectId}/{file}         flutter: {uid}/{projectId}/{file}
--   avatars                flutter: avatars/{userId}/{name}
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Ensure every bucket exists and is PUBLIC
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('task-attachments',       'task-attachments',       true,  104857600),
  ('task-images',            'task-images',            true,  104857600),
  ('task-docs',              'task-docs',              true,  104857600),
  ('project-files',          'project-files',          true,  104857600),
  ('project-images',         'project-images',         true,   10485760),
  ('project-info-images',    'project-info-images',    true,   10485760),
  ('project-voice-messages', 'project-voice-messages', true,  104857600),
  ('avatars',                'avatars',                true,    5242880)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop ALL existing storage.objects policies — clean slate
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    RAISE NOTICE 'Dropped storage policy: %', pol.policyname;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. One set of policies per bucket:
--      SELECT  — anyone (anon + authenticated) can read public files
--      INSERT  — authenticated users only
--      UPDATE  — authenticated users only
--      DELETE  — authenticated users only
-- ─────────────────────────────────────────────────────────────────────────────

-- ── task-attachments ──────────────────────────────────────────────────────
CREATE POLICY "task_attachments_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-attachments');

-- ── task-images ───────────────────────────────────────────────────────────
CREATE POLICY "task_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-images');

CREATE POLICY "task_images_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-images');

CREATE POLICY "task_images_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'task-images');

CREATE POLICY "task_images_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-images');

-- ── task-docs ─────────────────────────────────────────────────────────────
CREATE POLICY "task_docs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'task-docs');

CREATE POLICY "task_docs_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'task-docs');

CREATE POLICY "task_docs_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'task-docs');

CREATE POLICY "task_docs_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'task-docs');

-- ── project-files ─────────────────────────────────────────────────────────
CREATE POLICY "project_files_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-files');

CREATE POLICY "project_files_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "project_files_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'project-files');

CREATE POLICY "project_files_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'project-files');

-- ── project-images ────────────────────────────────────────────────────────
CREATE POLICY "project_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-images');

CREATE POLICY "project_images_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-images');

CREATE POLICY "project_images_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'project-images');

CREATE POLICY "project_images_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'project-images');

-- ── project-info-images ───────────────────────────────────────────────────
CREATE POLICY "project_info_images_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-info-images');

CREATE POLICY "project_info_images_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-info-images');

CREATE POLICY "project_info_images_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'project-info-images');

CREATE POLICY "project_info_images_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'project-info-images');

-- ── project-voice-messages ────────────────────────────────────────────────
CREATE POLICY "project_voice_messages_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'project-voice-messages');

CREATE POLICY "project_voice_messages_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-voice-messages');

CREATE POLICY "project_voice_messages_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'project-voice-messages');

CREATE POLICY "project_voice_messages_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'project-voice-messages');

-- ── avatars ───────────────────────────────────────────────────────────────
CREATE POLICY "avatars_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

CREATE POLICY "avatars_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');
