-- ============================================================================
-- HELP CENTER SYSTEM
-- Tables for FAQs, Walkthroughs, Videos, Documents, Tags, Support Messages
-- ============================================================================

-- 1. HELP TAGS (separate from system tags — dedicated to help center)
CREATE TABLE IF NOT EXISTS public.help_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_tags_name ON public.help_tags(name);
ALTER TABLE public.help_tags ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read tags
CREATE POLICY "Anyone can view help tags" ON public.help_tags
    FOR SELECT USING (true);

-- Only superusers can manage tags
CREATE POLICY "Superusers can manage help tags" ON public.help_tags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- 2. HELP FAQs
CREATE TABLE IF NOT EXISTS public.help_faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_faqs_is_published ON public.help_faqs(is_published);
CREATE INDEX IF NOT EXISTS idx_help_faqs_tags ON public.help_faqs USING GIN(tags);
ALTER TABLE public.help_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published faqs" ON public.help_faqs
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Superusers can manage faqs" ON public.help_faqs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- 3. HELP WALKTHROUGHS
CREATE TABLE IF NOT EXISTS public.help_walkthroughs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_walkthroughs_is_published ON public.help_walkthroughs(is_published);
CREATE INDEX IF NOT EXISTS idx_help_walkthroughs_tags ON public.help_walkthroughs USING GIN(tags);
ALTER TABLE public.help_walkthroughs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published walkthroughs" ON public.help_walkthroughs
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Superusers can manage walkthroughs" ON public.help_walkthroughs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- 4. HELP WALKTHROUGH STEPS
CREATE TABLE IF NOT EXISTS public.help_walkthrough_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    walkthrough_id UUID REFERENCES public.help_walkthroughs(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    step_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_walkthrough_steps_walkthrough_id ON public.help_walkthrough_steps(walkthrough_id);
ALTER TABLE public.help_walkthrough_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view walkthrough steps" ON public.help_walkthrough_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.help_walkthroughs
            WHERE id = walkthrough_id AND is_published = TRUE
        )
    );

CREATE POLICY "Superusers can manage walkthrough steps" ON public.help_walkthrough_steps
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- 5. HELP VIDEOS
CREATE TABLE IF NOT EXISTS public.help_videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_videos_is_published ON public.help_videos(is_published);
CREATE INDEX IF NOT EXISTS idx_help_videos_tags ON public.help_videos USING GIN(tags);
ALTER TABLE public.help_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published videos" ON public.help_videos
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Superusers can manage videos" ON public.help_videos
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- 6. HELP DOCUMENTS
CREATE TABLE IF NOT EXISTS public.help_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_help_documents_is_published ON public.help_documents(is_published);
CREATE INDEX IF NOT EXISTS idx_help_documents_tags ON public.help_documents USING GIN(tags);
ALTER TABLE public.help_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published documents" ON public.help_documents
    FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Superusers can manage documents" ON public.help_documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- 7. SUPPORT MESSAGES (from contact form)
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'read', 'action_required', 'redirected', 'finished')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_status ON public.support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON public.support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at DESC);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert (send messages)
CREATE POLICY "Authenticated users can send support messages" ON public.support_messages
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view their own messages
CREATE POLICY "Users can view own support messages" ON public.support_messages
    FOR SELECT USING (user_id = auth.uid());

-- Superusers can view and manage all messages
CREATE POLICY "Superusers can manage all support messages" ON public.support_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ============================================================================
-- STORAGE BUCKET for help center assets
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('help-assets', 'help-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view help assets
CREATE POLICY "Public can view help assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'help-assets');

-- Allow superusers to manage help assets
CREATE POLICY "Superusers can upload help assets" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'help-assets'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

CREATE POLICY "Superusers can delete help assets" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'help-assets'
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
    );

-- ============================================================================
-- SEED some initial help tags
-- ============================================================================
INSERT INTO public.help_tags (name, color) VALUES
    ('Erste Schritte', '#3b82f6'),
    ('Projekte', '#8b5cf6'),
    ('Aufgaben', '#10b981'),
    ('Dokumente', '#f59e0b'),
    ('Team', '#ef4444'),
    ('Sicherheit', '#6366f1'),
    ('Abonnement', '#ec4899')
ON CONFLICT (name) DO NOTHING;
