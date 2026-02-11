-- Create tables for linking employees, owners, and subcontractors to projects
-- This enables the project assignment functionality in ManageProjects

-- Table for linking CRM contacts (employees, owners) to projects
CREATE TABLE IF NOT EXISTS public.project_crm_links (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  contact_id uuid references public.crm_contacts(id) on delete cascade not null,
  role text not null check (role in ('employee', 'owner')),
  created_at timestamptz default now(),
  unique(project_id, contact_id)
);

ALTER TABLE public.project_crm_links ENABLE ROW LEVEL SECURITY;

-- Table for linking subcontractors to projects
CREATE TABLE IF NOT EXISTS public.project_subcontractors (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  subcontractor_id uuid references public.subcontractors(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(project_id, subcontractor_id)
);

ALTER TABLE public.project_subcontractors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_crm_links
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'project_crm_links' 
    AND policyname = 'Project members can view contact links'
  ) THEN
    CREATE POLICY "Project members can view contact links" 
    ON public.project_crm_links
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_crm_links.project_id
        AND pm.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_crm_links.project_id
        AND p.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'project_crm_links' 
    AND policyname = 'Project owners can manage contact links'
  ) THEN
    CREATE POLICY "Project owners can manage contact links" 
    ON public.project_crm_links
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_crm_links.project_id
        AND p.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_crm_links.project_id
        AND p.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- RLS Policies for project_subcontractors
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'project_subcontractors' 
    AND policyname = 'Project members can view subcontractor links'
  ) THEN
    CREATE POLICY "Project members can view subcontractor links" 
    ON public.project_subcontractors
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = project_subcontractors.project_id
        AND pm.user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_subcontractors.project_id
        AND p.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'project_subcontractors' 
    AND policyname = 'Project owners can manage subcontractor links'
  ) THEN
    CREATE POLICY "Project owners can manage subcontractor links" 
    ON public.project_subcontractors
    FOR ALL 
    USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_subcontractors.project_id
        AND p.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_subcontractors.project_id
        AND p.owner_id = auth.uid()
      )
    );
  END IF;
END $$;
