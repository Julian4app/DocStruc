-- 0. TABLES SETUP
-- Create crm_contacts for Employees and Owners (that are not necessarily Auth Users yet)
CREATE TABLE IF NOT EXISTS public.crm_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('employee', 'owner')),
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    avatar_url TEXT,
    
    -- Employee specifics
    personal_number TEXT,
    department TEXT,
    
    -- Owner specifics
    company_name TEXT,
    detailed_address TEXT,
    notes TEXT
);

-- Enable RLS on crm_contacts
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth full access crm_contacts" ON public.crm_contacts;
CREATE POLICY "Auth full access crm_contacts" ON public.crm_contacts FOR ALL TO authenticated USING (true);


-- Create Subcontractors (Gewerke)
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT, -- Company Name
    trade TEXT, -- Gewerk
    street TEXT,
    zip TEXT,
    city TEXT,
    logo_url TEXT,
    
    -- Legacy/Fallback fields
    company_name TEXT, 
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    detailed_address TEXT,
    notes TEXT,
    profile_picture_url TEXT
);

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth full access subcontractors" ON public.subcontractors;
CREATE POLICY "Auth full access subcontractors" ON public.subcontractors FOR ALL TO authenticated USING (true);


-- Create Subcontractor Contacts
CREATE TABLE IF NOT EXISTS public.subcontractor_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    department TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subcontractor_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth full access sub_contacts" ON public.subcontractor_contacts;
CREATE POLICY "Auth full access sub_contacts" ON public.subcontractor_contacts FOR ALL TO authenticated USING (true);


-- 1. Fix Projects Policy
-- Allow authenticated users (like Superusers) to insert projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create projects" ON "public"."projects";
CREATE POLICY "Users can create projects" ON "public"."projects"
FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Superusers full access projects" ON "public"."projects";
CREATE POLICY "Superusers full access projects" ON "public"."projects"
FOR ALL TO authenticated
USING (true); -- Simplified for Development


-- 2. Storage Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-images', 'project-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for Storage (Simple public read, auth write)
DROP POLICY IF EXISTS "Public Access Project Images" ON storage.objects;
CREATE POLICY "Public Access Project Images" ON storage.objects FOR SELECT USING (bucket_id = 'project-images');

DROP POLICY IF EXISTS "Auth Upload Project Images" ON storage.objects;
CREATE POLICY "Auth Upload Project Images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-images' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
CREATE POLICY "Public Access Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');


-- 3. CRM Project Links
-- Link crm_contacts to Projects
CREATE TABLE IF NOT EXISTS public.project_crm_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
    role TEXT, -- 'employee', 'owner'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, contact_id)
);

ALTER TABLE public.project_crm_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all access crm links" ON public.project_crm_links;
CREATE POLICY "Auth all access crm links" ON public.project_crm_links FOR ALL TO authenticated USING (true);


-- Link Subcontractors to Projects
CREATE TABLE IF NOT EXISTS public.project_subcontractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, subcontractor_id)
);

ALTER TABLE public.project_subcontractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth all access project subs" ON public.project_subcontractors;
CREATE POLICY "Auth all access project subs" ON public.project_subcontractors FOR ALL TO authenticated USING (true);


-- Ensure Project columns exist
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS images text[];
