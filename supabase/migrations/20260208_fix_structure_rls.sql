-- Fix RLS policies for buildings, floors, and rooms tables
-- Allow project members to create and view structure elements

-- Drop existing policies if any
DROP POLICY IF EXISTS "Project members can view buildings" ON public.buildings;
DROP POLICY IF EXISTS "Project members can create buildings" ON public.buildings;
DROP POLICY IF EXISTS "Project members can update buildings" ON public.buildings;
DROP POLICY IF EXISTS "Project members can delete buildings" ON public.buildings;

DROP POLICY IF EXISTS "Project members can view floors" ON public.floors;
DROP POLICY IF EXISTS "Project members can create floors" ON public.floors;
DROP POLICY IF EXISTS "Project members can update floors" ON public.floors;
DROP POLICY IF EXISTS "Project members can delete floors" ON public.floors;

DROP POLICY IF EXISTS "Project members can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Project members can create rooms" ON public.rooms;
DROP POLICY IF EXISTS "Project members can update rooms" ON public.rooms;
DROP POLICY IF EXISTS "Project members can delete rooms" ON public.rooms;

-- Buildings policies
CREATE POLICY "Project members can view buildings" ON public.buildings
  FOR SELECT USING (public.has_project_access(project_id));

CREATE POLICY "Project members can create buildings" ON public.buildings
  FOR INSERT WITH CHECK (public.has_project_access(project_id));

CREATE POLICY "Project members can update buildings" ON public.buildings
  FOR UPDATE USING (public.has_project_access(project_id));

CREATE POLICY "Project members can delete buildings" ON public.buildings
  FOR DELETE USING (public.has_project_access(project_id));

-- Floors policies
CREATE POLICY "Project members can view floors" ON public.floors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.buildings 
      WHERE buildings.id = floors.building_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

CREATE POLICY "Project members can create floors" ON public.floors
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buildings 
      WHERE buildings.id = floors.building_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

CREATE POLICY "Project members can update floors" ON public.floors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.buildings 
      WHERE buildings.id = floors.building_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

CREATE POLICY "Project members can delete floors" ON public.floors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.buildings 
      WHERE buildings.id = floors.building_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

-- Rooms policies
CREATE POLICY "Project members can view rooms" ON public.rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.floors 
      JOIN public.buildings ON buildings.id = floors.building_id
      WHERE floors.id = rooms.floor_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

CREATE POLICY "Project members can create rooms" ON public.rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.floors 
      JOIN public.buildings ON buildings.id = floors.building_id
      WHERE floors.id = rooms.floor_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

CREATE POLICY "Project members can update rooms" ON public.rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.floors 
      JOIN public.buildings ON buildings.id = floors.building_id
      WHERE floors.id = rooms.floor_id 
      AND public.has_project_access(buildings.project_id)
    )
  );

CREATE POLICY "Project members can delete rooms" ON public.rooms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.floors 
      JOIN public.buildings ON buildings.id = floors.building_id
      WHERE floors.id = rooms.floor_id 
      AND public.has_project_access(buildings.project_id)
    )
  );
