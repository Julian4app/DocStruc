-- =====================================================
-- FIX TEAM ADMIN ABILITY TO ADD & MANAGE PROJECT MEMBERS
-- =====================================================

-- The issue: Team admins can't add or update members because the RLS policies
-- are too restrictive. Team admins should be able to:
-- 1. Add members to projects they have access to
-- 2. Update/manage ONLY their own team members' roles and permissions

-- ============================================================================
-- INSERT POLICY - Allow team admins to add members
-- ============================================================================

DROP POLICY IF EXISTS "project_members_insert" ON public.project_members;

CREATE POLICY "project_members_insert" ON public.project_members
  FOR INSERT WITH CHECK (
    -- Project owner can add anyone
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_members.project_id 
      AND owner_id = auth.uid()
    )
    OR 
    -- Superuser can add anyone
    public.is_current_user_superuser()
    OR
    -- Team admin can add members if:
    -- 1. They are a team admin
    -- 2. Either:
    --    a) Their team has explicit access via team_project_access, OR
    --    b) They are already a member of the project (can add other members)
    (
      (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
      AND
      (
        -- Team has explicit access to the project
        EXISTS (
          SELECT 1 FROM public.team_project_access tpa
          WHERE tpa.project_id = project_members.project_id
          AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        OR
        -- Team admin is already a project member (can manage other members)
        EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_members.project_id
          AND pm.user_id = auth.uid()
          AND pm.status = 'active'
        )
      )
    )
  );

-- ============================================================================
-- UPDATE POLICY - Allow team admins to update ONLY their own team members
-- ============================================================================

DROP POLICY IF EXISTS "project_members_update" ON public.project_members;

CREATE POLICY "project_members_update" ON public.project_members
  FOR UPDATE USING (
    -- Project owner can update anyone
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_members.project_id 
      AND owner_id = auth.uid()
    )
    OR
    -- Superuser can update anyone
    public.is_current_user_superuser()
    OR
    -- Team admin can update ONLY if:
    -- 1. They are a team admin
    -- 2. The member being updated is from their own team
    -- 3. They have access to the project
    (
      (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
      AND
      -- Member being updated is from the same team as the team admin
      (
        project_members.member_team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        OR
        -- Fallback: check if the user being updated is in the same team via their profile
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = project_members.user_id
          AND p.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
      )
      AND
      -- Team admin has access to the project
      (
        EXISTS (
          SELECT 1 FROM public.team_project_access tpa
          WHERE tpa.project_id = project_members.project_id
          AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        OR
        EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_members.project_id
          AND pm.user_id = auth.uid()
          AND pm.status = 'active'
        )
      )
    )
  );

-- ============================================================================
-- DELETE POLICY - Allow team admins to remove ONLY their own team members
-- ============================================================================

DROP POLICY IF EXISTS "project_members_delete" ON public.project_members;

CREATE POLICY "project_members_delete" ON public.project_members
  FOR DELETE USING (
    -- Project owner can delete anyone
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_members.project_id 
      AND owner_id = auth.uid()
    )
    OR
    -- Superuser can delete anyone
    public.is_current_user_superuser()
    OR
    -- Team admin can delete ONLY their own team members
    (
      (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
      AND
      -- Member being deleted is from the same team
      (
        project_members.member_team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        OR
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = project_members.user_id
          AND p.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
      )
      AND
      -- Team admin has access to the project
      (
        EXISTS (
          SELECT 1 FROM public.team_project_access tpa
          WHERE tpa.project_id = project_members.project_id
          AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        OR
        EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = project_members.project_id
          AND pm.user_id = auth.uid()
          AND pm.status = 'active'
        )
      )
    )
  );

COMMENT ON POLICY "project_members_insert" ON public.project_members IS
'Allows project owners, superusers, and team admins (who have access) to add project members';

COMMENT ON POLICY "project_members_update" ON public.project_members IS
'Allows project owners, superusers to update any member; team admins can only update their own team members';

COMMENT ON POLICY "project_members_delete" ON public.project_members IS
'Allows project owners, superusers to delete any member; team admins can only delete their own team members';

