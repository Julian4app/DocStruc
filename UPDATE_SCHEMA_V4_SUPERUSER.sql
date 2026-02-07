-- SUPERUSER EXTENSIONS
-- This script adds tables and columns to support "Zugreifer" management and detailed Project setup
-- as requested in the Superuser specification.

-- 1. EXTEND PROFILES
-- Add fields for "Mitarbeiter", "Bauherren" and general extended info
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'standard' CHECK (user_type IN ('standard', 'employee', 'owner', 'subcontractor_contact')),
ADD COLUMN IF NOT EXISTS personal_number TEXT,    -- For Employees
ADD COLUMN IF NOT EXISTS phone TEXT,              -- For all
ADD COLUMN IF NOT EXISTS detailed_address TEXT,   -- For Owners/Subcontractors
ADD COLUMN IF NOT EXISTS notes TEXT,              -- For Owners/Subcontractors
ADD COLUMN IF NOT EXISTS avatar_url TEXT,         -- For all
ADD COLUMN IF NOT EXISTS subcontractor_id UUID;   -- Link to Subcontractors (Gewerke)

-- 2. CREATE COMMERCIAL ENTITIES (Gewerke/Subsections)
CREATE TABLE IF NOT EXISTS public.subcontractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    first_name TEXT, -- Main contact/Owner of the trade company
    last_name TEXT,
    phone TEXT,
    notes TEXT,
    detailed_address TEXT,
    profile_picture_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link profiles to subcontractors (Forward key is in profiles.subcontractor_id)
-- Add FK constraint
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_subcontractor_id_fkey') THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_subcontractor_id_fkey 
        FOREIGN KEY (subcontractor_id) 
        REFERENCES public.subcontractors(id);
    END IF;
END $$;

-- 3. EXTEND PROJECTS
-- Add fields requested: Subtitle, Picture, Extended Status
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS subtitle TEXT,
ADD COLUMN IF NOT EXISTS picture_url TEXT,
ADD COLUMN IF NOT EXISTS detailed_address TEXT; -- 'address' already exists, using that or this?

-- Update Status constraint to include new values
-- Postgres Check constraints are hard to alter directly. We drop and recreate.
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
CHECK (status IN ('Angefragt', 'In Verhandlungen', 'Planung', 'Warten auf Infos', 'In Umsetzung', 'Abgeschlossen', 'planning', 'active', 'completed', 'archived'));

-- 4. ROLES & PERMISSIONS SYSTEM
CREATE TABLE IF NOT EXISTS public.project_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE, -- e.g. 'owner', 'viewer', 'electrician'
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE, -- e.g. 'view_financials', 'edit_structure'
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.role_features (
    role_id UUID REFERENCES public.project_roles(id) ON DELETE CASCADE,
    feature_id UUID REFERENCES public.features(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, feature_id)
);

-- Insert Default Roles
INSERT INTO public.project_roles (name, description) VALUES 
('Project Owner', 'Full access to the project'),
('Project Manager', 'Can edit structure and tasks'),
('Viewer', 'Read only access'),
('Craftsman', 'Restricted access to specific tasks')
ON CONFLICT (name) DO NOTHING;

-- 5. UPDATE MEMBERSHIP
ALTER TABLE public.project_members 
ADD COLUMN IF NOT EXISTS project_role_id UUID REFERENCES public.project_roles(id);

-- Optional: Create a view or function to map text role to role_id for backwards compatibility if needed.

-- 6. POLICIES (Brief update to ensure Superusers can do anything)
-- Note: actual RLS for superuser usually requires a global check in every policy
-- or a "Bypass RLS" role which generic Supabase clients don't use easily.
-- We'll just ensure policies check `is_superuser` column on the auth.uid() profile.

CREATE OR REPLACE FUNCTION public.is_superuser() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_superuser = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Example Policy update (just one as example, users should run FIX_RLS policies)
-- ALTER POLICY "Enable read access for all users" ON public.projects USING (true);

-- 7. PROJECT SUBCONTRACTORS LINK
CREATE TABLE IF NOT EXISTS public.project_subcontractors (
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.project_roles(id), -- Specific role for this company on this project?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, subcontractor_id)
);
