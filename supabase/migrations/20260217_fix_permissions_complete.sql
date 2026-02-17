-- ============================================================================
-- COMPLETE FIX: Permissions, RLS, and RPC functions
-- Date: 2026-02-17
-- Fixes:
--   1. Superuser can update ANY profile (needed for team admin assignment)
--   2. Team admin can update profiles in their team (for adding members)
--   3. get_user_project_permissions uses correct column names
--   4. Team admins with team_project_access get full permissions
--   5. Non-recursive RLS policies
-- ============================================================================

-- ============================================================================
-- 1. SECURITY DEFINER FUNCTIONS (avoid infinite recursion)
-- ============================================================================

-- Check if current user is superuser (non-recursive)
CREATE OR REPLACE FUNCTION public.is_current_user_superuser()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_superuser FROM public.profiles WHERE id = auth.uid() LIMIT 1),
        false
    );
$$;

-- Get current user's team info (non-recursive)
CREATE OR REPLACE FUNCTION public.get_current_user_team_info()
RETURNS TABLE(team_id UUID, team_role TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT p.team_id, p.team_role
    FROM public.profiles p
    WHERE p.id = auth.uid()
    LIMIT 1;
$$;

-- ============================================================================
-- 2. FIX PROFILES RLS POLICIES
-- ============================================================================

-- Drop ALL existing update policies on profiles to start clean
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Superusers can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Team admins can update team member profiles" ON public.profiles;

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- Superusers can update ANY profile (for assigning team admins, etc.)
CREATE POLICY "Superusers can update any profile" ON public.profiles
    FOR UPDATE
    USING (public.is_current_user_superuser());

-- Team admins can update profiles in their team
CREATE POLICY "Team admins can update team member profiles" ON public.profiles
    FOR UPDATE
    USING (
        team_id IS NOT NULL
        AND team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    )
    WITH CHECK (
        -- Allow setting team_id to the admin's team (for adding new members)
        team_id IS NULL
        OR team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
    );

-- ============================================================================
-- 3. FIX SELECT POLICIES ON PROFILES
-- ============================================================================

-- Drop and recreate to ensure clean state
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are visible" ON public.profiles;
DROP POLICY IF EXISTS "Superusers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Team admins can view team member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Simple non-recursive: all authenticated users can view profiles
CREATE POLICY "Authenticated users can view profiles" ON public.profiles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- ============================================================================
-- 4. FIX team_project_access POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "View team project access" ON public.team_project_access;
DROP POLICY IF EXISTS "Add teams to projects" ON public.team_project_access;
DROP POLICY IF EXISTS "Remove team access from projects" ON public.team_project_access;

-- All authenticated users can view team_project_access
-- (app-level filtering handles the rest)
CREATE POLICY "View team project access" ON public.team_project_access
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Superusers can add teams to projects
CREATE POLICY "Add teams to projects" ON public.team_project_access
    FOR INSERT
    WITH CHECK (public.is_current_user_superuser());

-- Superusers can remove team access
CREATE POLICY "Remove team access from projects" ON public.team_project_access
    FOR DELETE
    USING (public.is_current_user_superuser());

-- ============================================================================
-- 5. FIX project_members POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view project members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can insert members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can update members" ON public.project_members;
DROP POLICY IF EXISTS "Project owners can delete members" ON public.project_members;
DROP POLICY IF EXISTS "Team admins can insert members" ON public.project_members;
DROP POLICY IF EXISTS "Team admins can update members" ON public.project_members;
DROP POLICY IF EXISTS "Team admins can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Superusers can manage project members" ON public.project_members;

-- Everyone can view project members
CREATE POLICY "Authenticated users can view project members" ON public.project_members
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Superusers can do everything
CREATE POLICY "Superusers can manage project members" ON public.project_members
    FOR ALL
    USING (public.is_current_user_superuser());

-- Team admins can insert members into projects their team has access to
CREATE POLICY "Team admins can insert project members" ON public.project_members
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = project_members.project_id
            AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

-- Team admins can update members they added or in projects their team has access to
CREATE POLICY "Team admins can update project members" ON public.project_members
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = project_members.project_id
            AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

-- Team admins can delete members from projects their team has access to
CREATE POLICY "Team admins can delete project members" ON public.project_members
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = project_members.project_id
            AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

-- ============================================================================
-- 6. FIX project_member_permissions POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "View project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Superusers manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Team admins manage project member permissions" ON public.project_member_permissions;

-- Everyone can view permissions
CREATE POLICY "View project member permissions" ON public.project_member_permissions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Superusers can manage all permissions
CREATE POLICY "Superusers manage project member permissions" ON public.project_member_permissions
    FOR ALL
    USING (public.is_current_user_superuser());

-- Team admins can manage permissions for their project members
CREATE POLICY "Team admins manage project member permissions" ON public.project_member_permissions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.team_project_access tpa ON tpa.project_id = pm.project_id
            WHERE pm.id = project_member_permissions.project_member_id
            AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

-- ============================================================================
-- 7. FIX user_accessors POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own accessors" ON public.user_accessors;
DROP POLICY IF EXISTS "Users can manage own accessors" ON public.user_accessors;
DROP POLICY IF EXISTS "Team admins can manage accessors" ON public.user_accessors;
DROP POLICY IF EXISTS "Authenticated can view accessors" ON public.user_accessors;

-- All authenticated users can view accessors
CREATE POLICY "Authenticated can view accessors" ON public.user_accessors
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can manage their own accessors
CREATE POLICY "Users can manage own accessors" ON public.user_accessors
    FOR ALL
    USING (owner_id = auth.uid());

-- Team admins can create accessors (needed when adding team members to projects)
CREATE POLICY "Team admins can insert accessors" ON public.user_accessors
    FOR INSERT
    WITH CHECK (
        (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

-- ============================================================================
-- 8. FIX roles AND role_permissions POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "View roles" ON public.roles;
DROP POLICY IF EXISTS "Manage roles" ON public.roles;

-- All authenticated users can view roles (needed for team admins to see role options)
CREATE POLICY "Authenticated can view roles" ON public.roles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can manage their own roles
CREATE POLICY "Users can manage own roles" ON public.roles
    FOR ALL
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "View role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Manage role permissions" ON public.role_permissions;

-- All authenticated users can view role permissions
CREATE POLICY "Authenticated can view role permissions" ON public.role_permissions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Manage role permissions via role ownership
CREATE POLICY "Role owners can manage permissions" ON public.role_permissions
    FOR ALL
    USING (
        role_id IN (SELECT id FROM public.roles WHERE user_id = auth.uid())
    );

-- ============================================================================
-- 9. FIX project_available_roles POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "View project available roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Manage project available roles" ON public.project_available_roles;

-- All authenticated users can view project available roles
CREATE POLICY "Authenticated can view project available roles" ON public.project_available_roles
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Superusers can manage
CREATE POLICY "Superusers can manage project available roles" ON public.project_available_roles
    FOR ALL
    USING (public.is_current_user_superuser());

-- ============================================================================
-- 10. FIX get_user_project_permissions RPC
-- Uses CORRECT column names: project_member_id, module_key (not member_id, module_id)
-- Also handles team admins with team_project_access
-- ============================================================================

DROP FUNCTION IF EXISTS get_user_project_permissions(UUID, UUID);

CREATE OR REPLACE FUNCTION get_user_project_permissions(
    p_user_id UUID,
    p_project_id UUID
)
RETURNS TABLE (
    module_key TEXT,
    can_view BOOLEAN,
    can_create BOOLEAN,
    can_edit BOOLEAN,
    can_delete BOOLEAN
) AS $$
DECLARE
    user_is_owner BOOLEAN;
    user_is_superuser BOOLEAN;
    user_team_id UUID;
    user_team_role TEXT;
    has_team_access BOOLEAN;
    member_record RECORD;
BEGIN
    -- Check if user is project owner
    SELECT EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;
    
    -- Get user profile info
    SELECT p.is_superuser, p.team_id, p.team_role 
    INTO user_is_superuser, user_team_id, user_team_role
    FROM public.profiles p
    WHERE p.id = p_user_id;
    
    -- Owner and superuser have ALL permissions
    IF user_is_owner OR user_is_superuser THEN
        RETURN QUERY
        SELECT 
            pm.module_key,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN
        FROM public.permission_modules pm
        WHERE pm.is_active = true;
        RETURN;
    END IF;
    
    -- Check if user is team admin with team access to this project
    IF user_team_id IS NOT NULL AND user_team_role = 'team_admin' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = p_project_id
            AND tpa.team_id = user_team_id
        ) INTO has_team_access;
        
        -- Team admin with access gets ALL permissions
        IF has_team_access THEN
            RETURN QUERY
            SELECT 
                pm.module_key,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN,
                TRUE::BOOLEAN
            FROM public.permission_modules pm
            WHERE pm.is_active = true;
            RETURN;
        END IF;
    END IF;
    
    -- Regular user: check project_members
    SELECT * INTO member_record
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.status IN ('active', 'invited');
    
    IF NOT FOUND THEN
        -- No access at all
        RETURN;
    END IF;
    
    -- Check for custom permissions first (project_member_permissions)
    -- Then fall back to role permissions
    RETURN QUERY
    SELECT 
        pm.module_key,
        COALESCE(pmp.can_view, rp.can_view, FALSE) as can_view,
        COALESCE(pmp.can_create, rp.can_create, FALSE) as can_create,
        COALESCE(pmp.can_edit, rp.can_edit, FALSE) as can_edit,
        COALESCE(pmp.can_delete, rp.can_delete, FALSE) as can_delete
    FROM public.permission_modules pm
    LEFT JOIN public.role_permissions rp ON (
        rp.role_id = member_record.role_id 
        AND rp.module_key = pm.module_key
    )
    LEFT JOIN public.project_member_permissions pmp ON (
        pmp.project_member_id = member_record.id 
        AND pmp.module_key = pm.module_key
    )
    WHERE pm.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. FIX teams POLICIES (non-recursive)
-- ============================================================================

DROP POLICY IF EXISTS "Superusers can view all teams" ON public.teams;
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
DROP POLICY IF EXISTS "Superusers can create teams" ON public.teams;
DROP POLICY IF EXISTS "Superusers and team admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Superusers can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated can view teams" ON public.teams;

-- Simplify: all authenticated can view teams
CREATE POLICY "Authenticated can view teams" ON public.teams
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Superusers can create teams
CREATE POLICY "Superusers can create teams" ON public.teams
    FOR INSERT
    WITH CHECK (public.is_current_user_superuser());

-- Superusers and team admins can update their team
CREATE POLICY "Superusers and team admins can update teams" ON public.teams
    FOR UPDATE
    USING (
        public.is_current_user_superuser()
        OR (
            id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
            AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
        )
    );

-- Only superusers can delete teams
CREATE POLICY "Superusers can delete teams" ON public.teams
    FOR DELETE
    USING (public.is_current_user_superuser());

-- ============================================================================
-- Done! All policies are now non-recursive and use security definer functions.
-- ============================================================================
