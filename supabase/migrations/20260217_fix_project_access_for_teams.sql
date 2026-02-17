-- ============================================================================
-- FIX: Team admins and superusers can see projects
-- Date: 2026-02-17
-- 
-- Root Cause: has_project_access() only checked owner_id and project_members.
-- It did NOT check superuser status or team_project_access.
-- This meant team admins whose team was added to a project via 
-- team_project_access could not SELECT the project row itself.
-- ============================================================================

-- ============================================================================
-- 1. Fix has_project_access() to include superusers and team access
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_project_access(p_id uuid)
RETURNS boolean AS $$
BEGIN
  -- 1. Superuser can access all projects
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Project owner
  IF EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_id AND owner_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Direct project member
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_id
      AND user_id = auth.uid()
      AND status IN ('open', 'invited', 'active')
  ) THEN
    RETURN TRUE;
  END IF;

  -- 4. User's team has access to this project (via team_project_access)
  IF EXISTS (
    SELECT 1 FROM public.team_project_access tpa
    INNER JOIN public.profiles p ON p.team_id = tpa.team_id
    WHERE tpa.project_id = p_id
      AND p.id = auth.uid()
      AND p.team_id IS NOT NULL
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Ensure the projects_select policy uses has_project_access
--    (It should already be using it from 20260215_complete_rls_overhaul.sql,
--     but recreate to be safe)
-- ============================================================================
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "Project members can view project" ON public.projects;

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (public.has_project_access(id));

-- ============================================================================
-- 3. Allow superusers to update/delete any project
-- ============================================================================
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "Owners can update project" ON public.projects;

CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    auth.uid() = owner_id 
    OR public.is_current_user_superuser()
  );

DROP POLICY IF EXISTS "projects_delete" ON public.projects;
DROP POLICY IF EXISTS "Owners can delete project" ON public.projects;

CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    auth.uid() = owner_id 
    OR public.is_current_user_superuser()
  );

-- ============================================================================
-- 4. Also fix project_members_select to use has_project_access
--    so team admins can see all members in projects they have team access to
--    Also remove overly broad "Authenticated users can view project members"
-- ============================================================================
DROP POLICY IF EXISTS "project_members_select" ON public.project_members;
DROP POLICY IF EXISTS "Authenticated users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project members can view other members" ON public.project_members;

CREATE POLICY "project_members_select" ON public.project_members
  FOR SELECT USING (
    -- User is a direct member (can always see themselves)
    user_id = auth.uid()
    -- Or user has access to this project (owner, superuser, team member, direct member)
    OR public.has_project_access(project_id)
  );

-- ============================================================================
-- 5. Fix project_members insert policy for project owners
--    (The overhaul only allowed owner, not superuser)
--    Also drop duplicates from previous migration
-- ============================================================================
DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can insert members" ON public.project_members;
DROP POLICY IF EXISTS "Superusers can manage project members" ON public.project_members;
DROP POLICY IF EXISTS "Team admins can insert project members" ON public.project_members;
DROP POLICY IF EXISTS "Team admins can update project members" ON public.project_members;
DROP POLICY IF EXISTS "Team admins can delete project members" ON public.project_members;

-- Superusers can do everything with project members
CREATE POLICY "Superusers can manage project members" ON public.project_members
    FOR ALL
    USING (public.is_current_user_superuser());

CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
    OR public.is_current_user_superuser()
    OR (
      -- Team admin can add members to projects their team has access to
      EXISTS (
        SELECT 1 FROM public.team_project_access tpa
        WHERE tpa.project_id = project_members.project_id
        AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
      )
      AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    )
  );

-- ============================================================================
-- 6. Fix project_members update/delete for project owners
-- ============================================================================
DROP POLICY IF EXISTS "project_members_update" ON public.project_members;

CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
    OR public.is_current_user_superuser()
    OR (
      -- Team admin can update members in projects their team has access to
      EXISTS (
        SELECT 1 FROM public.team_project_access tpa
        WHERE tpa.project_id = project_members.project_id
        AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
      )
      AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    )
  );

DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_members.project_id AND owner_id = auth.uid())
    OR public.is_current_user_superuser()
    OR (
      -- Team admin can delete members from projects their team has access to
      EXISTS (
        SELECT 1 FROM public.team_project_access tpa
        WHERE tpa.project_id = project_members.project_id
        AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
      )
      AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    )
  );

-- Done! The has_project_access function now correctly grants access to:
-- 1. Superusers (all projects)
-- 2. Project owners
-- 3. Direct project members
-- 4. Users whose team has team_project_access to the project
