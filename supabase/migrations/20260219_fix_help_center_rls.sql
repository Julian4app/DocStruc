-- ============================================================================
-- FIX: Help Center RLS Policies
-- The original "manage" policies only cover INSERT/UPDATE/DELETE when combined
-- with FOR ALL, but Postgres RLS evaluates USING for both SELECT and the
-- write-side.  We need explicit INSERT/UPDATE/DELETE policies so that the
-- USING clause is correctly applied.
-- We also add a fallback "allow any authenticated user to INSERT" policy for
-- support_messages so guests who are not superusers can still send messages.
-- ============================================================================

-- ─── 1. HELP TAGS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Superusers can manage help tags" ON public.help_tags;

CREATE POLICY "Superusers can insert help tags" ON public.help_tags
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update help tags" ON public.help_tags
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete help tags" ON public.help_tags
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 2. HELP FAQs ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Superusers can manage faqs" ON public.help_faqs;

-- Allow admin to SELECT all (not just published) for the admin panel
CREATE POLICY "Superusers can select all faqs" ON public.help_faqs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can insert faqs" ON public.help_faqs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update faqs" ON public.help_faqs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete faqs" ON public.help_faqs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 3. HELP WALKTHROUGHS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Superusers can manage walkthroughs" ON public.help_walkthroughs;

CREATE POLICY "Superusers can select all walkthroughs" ON public.help_walkthroughs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can insert walkthroughs" ON public.help_walkthroughs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update walkthroughs" ON public.help_walkthroughs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete walkthroughs" ON public.help_walkthroughs
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 4. HELP WALKTHROUGH STEPS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Superusers can manage walkthrough steps" ON public.help_walkthrough_steps;

CREATE POLICY "Superusers can select all walkthrough steps" ON public.help_walkthrough_steps
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can insert walkthrough steps" ON public.help_walkthrough_steps
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update walkthrough steps" ON public.help_walkthrough_steps
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete walkthrough steps" ON public.help_walkthrough_steps
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 5. HELP VIDEOS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Superusers can manage videos" ON public.help_videos;

CREATE POLICY "Superusers can select all videos" ON public.help_videos
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can insert videos" ON public.help_videos
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update videos" ON public.help_videos
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete videos" ON public.help_videos
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 6. HELP DOCUMENTS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Superusers can manage documents" ON public.help_documents;

CREATE POLICY "Superusers can select all documents" ON public.help_documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can insert documents" ON public.help_documents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update documents" ON public.help_documents
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete documents" ON public.help_documents
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 7. SUPPORT MESSAGES ─────────────────────────────────────────────────────
-- The INSERT policy already allows any authenticated user — keep it.
-- The SELECT policy "Users can view own messages" is fine too.
-- The FOR ALL superuser policy needs to be split so UPDATE/DELETE work correctly.
DROP POLICY IF EXISTS "Superusers can manage all support messages" ON public.support_messages;

CREATE POLICY "Superusers can select all support messages" ON public.support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update support messages" ON public.support_messages
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete support messages" ON public.support_messages
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ─── 8. STORAGE: help-assets ─────────────────────────────────────────────────
-- Fix UPDATE policy for storage objects (needed when using upsert: true)
DROP POLICY IF EXISTS "Superusers can upload help assets" ON storage.objects;

CREATE POLICY "Superusers can upload help assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'help-assets'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can update help assets" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'help-assets'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );
