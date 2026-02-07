-- UPDATE_SCHEMA_V3_WEB_FEATURES.sql
-- Run this to enable Components, Variants and Timeline features

-- 1. Components (Bauteile/Maßnahmen) in a Room
CREATE TABLE IF NOT EXISTS public.room_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT, -- 'wall', 'electrics', 'plumbing', 'furniture'
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'done'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.room_components ENABLE ROW LEVEL SECURITY;

-- Basic Policies for Components (Inherited from Project Access)
CREATE POLICY "Components visible to project members" ON public.room_components
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.floors f ON f.id = r.floor_id
    JOIN public.buildings b ON b.id = f.building_id
    JOIN public.projects p ON p.id = b.project_id
    WHERE r.id = public.room_components.room_id
    AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Components insertable by members" ON public.room_components
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rooms r
    JOIN public.floors f ON f.id = r.floor_id
    JOIN public.buildings b ON b.id = f.building_id
    JOIN public.projects p ON p.id = b.project_id
    WHERE r.id = room_id
    AND (
      p.owner_id = auth.uid() OR
      EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
    )
  )
);

-- 2. Variants (Planungsvarianten)
CREATE TABLE IF NOT EXISTS public.planning_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_type TEXT NOT NULL CHECK (parent_type IN ('room', 'component')),
    parent_id UUID NOT NULL, -- Logical reference to room_components.id or rooms.id
    
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'proposed', 'approved', 'rejected')),
    
    version INT DEFAULT 1,
    
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    decision_by UUID REFERENCES public.profiles(id),
    decision_at TIMESTAMPTZ
);

ALTER TABLE public.planning_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View variants" ON public.planning_variants
FOR SELECT TO authenticated
USING (true); -- Simplified, assumes parent check happens in app or add strict join

CREATE POLICY "Insert variants" ON public.planning_variants
FOR INSERT TO authenticated
WITH CHECK (true); 

-- 3. Project Timeline (Immutable History)
CREATE TABLE IF NOT EXISTS public.project_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.project_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View timeline" ON public.project_timeline
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_id AND pm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()
  )
);
