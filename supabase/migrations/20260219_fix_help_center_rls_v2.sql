-- ============================================================================
-- FIX v2: Help Center RLS Policies + Set admin superuser flag
--
-- Two problems fixed:
--
-- 1. The admin user (admin@ployify.com) does not have is_superuser = TRUE
--    in the profiles table, so all superuser-gated policies block them.
--
-- 2. Previous RLS policies used inline EXISTS subqueries against profiles,
--    which can hit RLS recursion.  We now use the existing SECURITY DEFINER
--    helper function public.is_current_user_superuser() instead — consistent
--    with the rest of the codebase and recursion-safe.
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================================

-- ─── 1. Set is_superuser = TRUE for the admin account ────────────────────────
-- This uses auth.users to look up the UUID by email, bypassing RLS on profiles.
UPDATE public.profiles
SET is_superuser = TRUE
WHERE id = (
    SELECT id FROM auth.users WHERE email = 'admin@ployify.com' LIMIT 1
);

-- Safety: also handle any profile whose email column matches directly
UPDATE public.profiles
SET is_superuser = TRUE
WHERE LOWER(email) = 'admin@ployify.com'
  AND (is_superuser IS NULL OR is_superuser = FALSE);

-- ─── 2. Drop all existing help-center policies (old + new names) ─────────────
DO $$ BEGIN

  -- help_tags
  DROP POLICY IF EXISTS "Superusers can manage help tags"     ON public.help_tags;
  DROP POLICY IF EXISTS "Superusers can insert help tags"     ON public.help_tags;
  DROP POLICY IF EXISTS "Superusers can update help tags"     ON public.help_tags;
  DROP POLICY IF EXISTS "Superusers can delete help tags"     ON public.help_tags;
  DROP POLICY IF EXISTS "Superusers can select all help tags" ON public.help_tags;

  -- help_faqs
  DROP POLICY IF EXISTS "Superusers can manage faqs"          ON public.help_faqs;
  DROP POLICY IF EXISTS "Superusers can select all faqs"      ON public.help_faqs;
  DROP POLICY IF EXISTS "Superusers can insert faqs"          ON public.help_faqs;
  DROP POLICY IF EXISTS "Superusers can update faqs"          ON public.help_faqs;
  DROP POLICY IF EXISTS "Superusers can delete faqs"          ON public.help_faqs;

  -- help_walkthroughs
  DROP POLICY IF EXISTS "Superusers can manage walkthroughs"       ON public.help_walkthroughs;
  DROP POLICY IF EXISTS "Superusers can select all walkthroughs"   ON public.help_walkthroughs;
  DROP POLICY IF EXISTS "Superusers can insert walkthroughs"       ON public.help_walkthroughs;
  DROP POLICY IF EXISTS "Superusers can update walkthroughs"       ON public.help_walkthroughs;
  DROP POLICY IF EXISTS "Superusers can delete walkthroughs"       ON public.help_walkthroughs;

  -- help_walkthrough_steps
  DROP POLICY IF EXISTS "Superusers can manage walkthrough steps"      ON public.help_walkthrough_steps;
  DROP POLICY IF EXISTS "Superusers can select all walkthrough steps"  ON public.help_walkthrough_steps;
  DROP POLICY IF EXISTS "Superusers can insert walkthrough steps"      ON public.help_walkthrough_steps;
  DROP POLICY IF EXISTS "Superusers can update walkthrough steps"      ON public.help_walkthrough_steps;
  DROP POLICY IF EXISTS "Superusers can delete walkthrough steps"      ON public.help_walkthrough_steps;

  -- help_videos
  DROP POLICY IF EXISTS "Superusers can manage videos"          ON public.help_videos;
  DROP POLICY IF EXISTS "Superusers can select all videos"      ON public.help_videos;
  DROP POLICY IF EXISTS "Superusers can insert videos"          ON public.help_videos;
  DROP POLICY IF EXISTS "Superusers can update videos"          ON public.help_videos;
  DROP POLICY IF EXISTS "Superusers can delete videos"          ON public.help_videos;

  -- help_documents
  DROP POLICY IF EXISTS "Superusers can manage documents"          ON public.help_documents;
  DROP POLICY IF EXISTS "Superusers can select all documents"      ON public.help_documents;
  DROP POLICY IF EXISTS "Superusers can insert documents"          ON public.help_documents;
  DROP POLICY IF EXISTS "Superusers can update documents"          ON public.help_documents;
  DROP POLICY IF EXISTS "Superusers can delete documents"          ON public.help_documents;

  -- support_messages
  DROP POLICY IF EXISTS "Superusers can manage all support messages"   ON public.support_messages;
  DROP POLICY IF EXISTS "Superusers can select all support messages"   ON public.support_messages;
  DROP POLICY IF EXISTS "Superusers can update support messages"       ON public.support_messages;
  DROP POLICY IF EXISTS "Superusers can delete support messages"       ON public.support_messages;

  -- storage
  DROP POLICY IF EXISTS "Superusers can upload help assets"  ON storage.objects;
  DROP POLICY IF EXISTS "Superusers can update help assets"  ON storage.objects;

END $$;

-- ─── 3. Recreate policies using is_current_user_superuser() ──────────────────
-- This SECURITY DEFINER function avoids RLS recursion and is consistent
-- with all other superuser policies in the codebase.

-- ── help_tags ─────────────────────────────────────────────────────────────────
CREATE POLICY "Superusers can insert help tags" ON public.help_tags
    FOR INSERT WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "Superusers can update help tags" ON public.help_tags
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete help tags" ON public.help_tags
    FOR DELETE USING (public.is_current_user_superuser());

-- ── help_faqs ─────────────────────────────────────────────────────────────────
CREATE POLICY "Superusers can select all faqs" ON public.help_faqs
    FOR SELECT USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can insert faqs" ON public.help_faqs
    FOR INSERT WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "Superusers can update faqs" ON public.help_faqs
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete faqs" ON public.help_faqs
    FOR DELETE USING (public.is_current_user_superuser());

-- ── help_walkthroughs ─────────────────────────────────────────────────────────
CREATE POLICY "Superusers can select all walkthroughs" ON public.help_walkthroughs
    FOR SELECT USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can insert walkthroughs" ON public.help_walkthroughs
    FOR INSERT WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "Superusers can update walkthroughs" ON public.help_walkthroughs
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete walkthroughs" ON public.help_walkthroughs
    FOR DELETE USING (public.is_current_user_superuser());

-- ── help_walkthrough_steps ────────────────────────────────────────────────────
CREATE POLICY "Superusers can select all walkthrough steps" ON public.help_walkthrough_steps
    FOR SELECT USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can insert walkthrough steps" ON public.help_walkthrough_steps
    FOR INSERT WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "Superusers can update walkthrough steps" ON public.help_walkthrough_steps
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete walkthrough steps" ON public.help_walkthrough_steps
    FOR DELETE USING (public.is_current_user_superuser());

-- ── help_videos ───────────────────────────────────────────────────────────────
CREATE POLICY "Superusers can select all videos" ON public.help_videos
    FOR SELECT USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can insert videos" ON public.help_videos
    FOR INSERT WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "Superusers can update videos" ON public.help_videos
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete videos" ON public.help_videos
    FOR DELETE USING (public.is_current_user_superuser());

-- ── help_documents ────────────────────────────────────────────────────────────
CREATE POLICY "Superusers can select all documents" ON public.help_documents
    FOR SELECT USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can insert documents" ON public.help_documents
    FOR INSERT WITH CHECK (public.is_current_user_superuser());

CREATE POLICY "Superusers can update documents" ON public.help_documents
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete documents" ON public.help_documents
    FOR DELETE USING (public.is_current_user_superuser());

-- ── support_messages ──────────────────────────────────────────────────────────
-- INSERT: "Authenticated users can send support messages" stays untouched.
-- SELECT: "Users can view own support messages" stays untouched.

CREATE POLICY "Superusers can select all support messages" ON public.support_messages
    FOR SELECT USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can update support messages" ON public.support_messages
    FOR UPDATE USING (public.is_current_user_superuser());

CREATE POLICY "Superusers can delete support messages" ON public.support_messages
    FOR DELETE USING (public.is_current_user_superuser());

-- ── storage: help-assets ──────────────────────────────────────────────────────
CREATE POLICY "Superusers can upload help assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'help-assets'
        AND public.is_current_user_superuser()
    );

CREATE POLICY "Superusers can update help assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'help-assets'
        AND public.is_current_user_superuser()
    );
