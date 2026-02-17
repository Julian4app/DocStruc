-- ============================================================================
-- TEAM MANAGEMENT SYSTEM
-- Implements hierarchical team structure for subcontractors
-- Date: 2026-02-16
-- ============================================================================

-- 1. CREATE TEAMS TABLE
-- Teams represent subcontractor companies/organizations
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    company_info TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES public.profiles(id),
    is_active BOOLEAN DEFAULT TRUE
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON public.teams(created_by);
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON public.teams(is_active);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 2. EXTEND PROFILES WITH TEAM MEMBERSHIP
-- Add team_id and team_role to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS team_role TEXT DEFAULT 'member' CHECK (team_role IN ('member', 'team_admin')),
ADD COLUMN IF NOT EXISTS joined_team_at TIMESTAMPTZ;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_team_role ON public.profiles(team_role);

-- 3. CREATE TEAM_INVITATIONS TABLE
-- For inviting users to teams
CREATE TABLE IF NOT EXISTS public.team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    team_role TEXT DEFAULT 'member' CHECK (team_role IN ('member', 'team_admin')),
    invited_by UUID REFERENCES public.profiles(id) NOT NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    token TEXT UNIQUE,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE(team_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON public.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON public.team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(token);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- 4. EXTEND PROJECT_MEMBERS WITH TEAM INFO
-- Track which team a project member belongs to (snapshot at time of adding)
ALTER TABLE public.project_members
ADD COLUMN IF NOT EXISTS member_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_project_members_member_team_id ON public.project_members(member_team_id);
CREATE INDEX IF NOT EXISTS idx_project_members_added_by ON public.project_members(added_by);

-- 5. CREATE TEAM_PROJECT_ACCESS TABLE
-- Tracks which teams have been added to which projects
CREATE TABLE IF NOT EXISTS public.team_project_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
    added_by UUID REFERENCES public.profiles(id) NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_project_access_project_id ON public.team_project_access(project_id);
CREATE INDEX IF NOT EXISTS idx_team_project_access_team_id ON public.team_project_access(team_id);

ALTER TABLE public.team_project_access ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- PROFILES POLICIES
-- Drop and recreate policies to avoid conflicts
DROP POLICY IF EXISTS "Superusers can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Team admins can update team member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Team admins can view team member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superusers can view all profiles" ON public.profiles;

-- CRITICAL: Users must be able to view their own profile (this comes FIRST)
-- This policy is already in the base schema, but we ensure it exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile" ON public.profiles
      FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

-- Allow superusers to view all profiles
CREATE POLICY "Superusers can view all profiles" ON public.profiles
    FOR SELECT
    USING (
        (SELECT is_superuser FROM public.profiles WHERE id = auth.uid()) = TRUE
    );

-- Allow superusers to update any profile (needed for team admin assignment)
CREATE POLICY "Superusers can update any profile" ON public.profiles
    FOR UPDATE
    USING (
        (SELECT is_superuser FROM public.profiles WHERE id = auth.uid()) = TRUE
    );

-- Allow team admins to update profiles in their team
CREATE POLICY "Team admins can update team member profiles" ON public.profiles
    FOR UPDATE
    USING (
        team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid() AND team_role = 'team_admin')
        AND (SELECT team_id FROM public.profiles WHERE id = auth.uid() AND team_role = 'team_admin') IS NOT NULL
    );

-- Allow team admins to view profiles in their team
CREATE POLICY "Team admins can view team member profiles" ON public.profiles
    FOR SELECT
    USING (
        team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid() AND team_role = 'team_admin')
        AND (SELECT team_id FROM public.profiles WHERE id = auth.uid() AND team_role = 'team_admin') IS NOT NULL
    );

-- TEAMS POLICIES
-- Drop existing policies first
DROP POLICY IF EXISTS "Superusers can view all teams" ON public.teams;
DROP POLICY IF EXISTS "Team members can view their team" ON public.teams;
DROP POLICY IF EXISTS "Superusers can create teams" ON public.teams;
DROP POLICY IF EXISTS "Superusers and team admins can update teams" ON public.teams;
DROP POLICY IF EXISTS "Superusers can delete teams" ON public.teams;

-- Superusers can see all teams
CREATE POLICY "Superusers can view all teams" ON public.teams
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_superuser = TRUE
        )
    );

-- Team members can see their own team
CREATE POLICY "Team members can view their team" ON public.teams
    FOR SELECT
    USING (
        id IN (
            SELECT team_id FROM public.profiles 
            WHERE id = auth.uid() AND team_id IS NOT NULL
        )
    );

-- Superusers can create teams
CREATE POLICY "Superusers can create teams" ON public.teams
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_superuser = TRUE
        )
    );

-- Superusers and team admins can update their team
CREATE POLICY "Superusers and team admins can update teams" ON public.teams
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (
                is_superuser = TRUE 
                OR (team_id = teams.id AND team_role = 'team_admin')
            )
        )
    );

-- Only superusers can delete teams
CREATE POLICY "Superusers can delete teams" ON public.teams
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND is_superuser = TRUE
        )
    );

-- TEAM_INVITATIONS POLICIES
-- Drop existing policies first
DROP POLICY IF EXISTS "View team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Create team invitations" ON public.team_invitations;
DROP POLICY IF EXISTS "Update team invitations" ON public.team_invitations;

-- Superusers and team admins can view invitations for their team
CREATE POLICY "View team invitations" ON public.team_invitations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (
                is_superuser = TRUE 
                OR (team_id = team_invitations.team_id AND team_role = 'team_admin')
            )
        )
        OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

-- Superusers and team admins can create invitations
CREATE POLICY "Create team invitations" ON public.team_invitations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (
                is_superuser = TRUE 
                OR (team_id = team_invitations.team_id AND team_role = 'team_admin')
            )
        )
    );

-- Invitations can be updated by admins or by the invited user
CREATE POLICY "Update team invitations" ON public.team_invitations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (
                is_superuser = TRUE 
                OR (team_id = team_invitations.team_id AND team_role = 'team_admin')
                OR email = (SELECT email FROM public.profiles WHERE id = auth.uid())
            )
        )
    );

-- TEAM_PROJECT_ACCESS POLICIES
-- Drop existing policies first
DROP POLICY IF EXISTS "View team project access" ON public.team_project_access;
DROP POLICY IF EXISTS "Add teams to projects" ON public.team_project_access;
DROP POLICY IF EXISTS "Remove team access from projects" ON public.team_project_access;

-- Users can see team access if they're in the project or the team
CREATE POLICY "View team project access" ON public.team_project_access
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND (
                p.is_superuser = TRUE
                OR p.team_id = team_project_access.team_id
                OR EXISTS (
                    SELECT 1 FROM public.project_members pm
                    WHERE pm.project_id = team_project_access.project_id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );

-- Project owners and superusers can add teams to projects
CREATE POLICY "Add teams to projects" ON public.team_project_access
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND (
                p.is_superuser = TRUE
                OR EXISTS (
                    SELECT 1 FROM public.projects proj
                    WHERE proj.id = team_project_access.project_id
                    AND proj.owner_id = auth.uid()
                )
            )
        )
    );

-- Project owners and superusers can remove team access
CREATE POLICY "Remove team access from projects" ON public.team_project_access
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND (
                p.is_superuser = TRUE
                OR EXISTS (
                    SELECT 1 FROM public.projects proj
                    WHERE proj.id = team_project_access.project_id
                    AND proj.owner_id = auth.uid()
                )
            )
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user is team admin of a specific team
CREATE OR REPLACE FUNCTION is_team_admin(user_id UUID, check_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id
        AND team_id = check_team_id
        AND team_role = 'team_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can manage another user in same team
CREATE OR REPLACE FUNCTION can_manage_team_member(manager_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    manager_profile RECORD;
    target_profile RECORD;
BEGIN
    -- Get manager profile
    SELECT * INTO manager_profile FROM public.profiles WHERE id = manager_id;
    
    -- Superuser can manage anyone
    IF manager_profile.is_superuser THEN
        RETURN TRUE;
    END IF;
    
    -- Get target profile
    SELECT * INTO target_profile FROM public.profiles WHERE id = target_user_id;
    
    -- Must be in same team
    IF manager_profile.team_id IS NULL OR manager_profile.team_id != target_profile.team_id THEN
        RETURN FALSE;
    END IF;
    
    -- Must be team admin
    IF manager_profile.team_role != 'team_admin' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team members for a team
CREATE OR REPLACE FUNCTION get_team_members(check_team_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    team_role TEXT,
    joined_team_at TIMESTAMPTZ,
    is_superuser BOOLEAN
) AS $$
BEGIN
    -- Check if caller has permission
    IF NOT (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
        OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND team_id = check_team_id)
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.first_name,
        p.last_name,
        p.team_role,
        p.joined_team_at,
        p.is_superuser
    FROM public.profiles p
    WHERE p.team_id = check_team_id
    ORDER BY 
        CASE p.team_role 
            WHEN 'team_admin' THEN 1 
            ELSE 2 
        END,
        p.first_name,
        p.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available team members for adding to project
CREATE OR REPLACE FUNCTION get_available_team_members_for_project(
    check_team_id UUID,
    check_project_id UUID
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    team_role TEXT,
    already_in_project BOOLEAN
) AS $$
BEGIN
    -- Check if caller can access this
    IF NOT (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_superuser = TRUE)
        OR
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = check_project_id
            AND pm.user_id = auth.uid()
        )
        OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND team_id = check_team_id AND team_role = 'team_admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.first_name,
        p.last_name,
        p.team_role,
        EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = check_project_id
            AND pm.user_id = p.id
        ) as already_in_project
    FROM public.profiles p
    WHERE p.team_id = check_team_id
    ORDER BY p.first_name, p.last_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add team member to project (called by team admin or project owner)
CREATE OR REPLACE FUNCTION add_team_member_to_project(
    target_user_id UUID,
    target_project_id UUID,
    member_role_id UUID DEFAULT NULL,
    custom_perms JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    caller_profile RECORD;
    target_profile RECORD;
    new_member_id UUID;
BEGIN
    -- Get caller profile
    SELECT * INTO caller_profile FROM public.profiles WHERE id = auth.uid();
    
    -- Get target user profile
    SELECT * INTO target_profile FROM public.profiles WHERE id = target_user_id;
    
    -- Check permissions
    IF NOT (
        caller_profile.is_superuser = TRUE
        OR
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE id = target_project_id
            AND owner_id = auth.uid()
        )
        OR
        (
            caller_profile.team_id = target_profile.team_id
            AND caller_profile.team_role = 'team_admin'
            AND EXISTS (
                SELECT 1 FROM public.team_project_access
                WHERE project_id = target_project_id
                AND team_id = caller_profile.team_id
            )
        )
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;
    
    -- Insert or update project member
    INSERT INTO public.project_members (
        project_id,
        user_id,
        role_id,
        member_team_id,
        added_by,
        status
    ) VALUES (
        target_project_id,
        target_user_id,
        member_role_id,
        target_profile.team_id,
        auth.uid(),
        'active'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE
    SET 
        role_id = EXCLUDED.role_id,
        member_team_id = EXCLUDED.member_team_id,
        updated_at = NOW()
    RETURNING id INTO new_member_id;
    
    -- Add custom permissions if provided
    IF custom_perms IS NOT NULL THEN
        -- Delete existing custom permissions
        DELETE FROM public.project_member_permissions
        WHERE member_id = new_member_id;
        
        -- Insert new custom permissions
        INSERT INTO public.project_member_permissions (member_id, module_id, can_view, can_create, can_edit, can_delete)
        SELECT 
            new_member_id,
            (perm->>'module_id')::UUID,
            (perm->>'can_view')::BOOLEAN,
            (perm->>'can_create')::BOOLEAN,
            (perm->>'can_edit')::BOOLEAN,
            (perm->>'can_delete')::BOOLEAN
        FROM jsonb_array_elements(custom_perms) AS perm;
    END IF;
    
    RETURN new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE EXISTING FUNCTIONS TO SUPPORT TEAM FILTERING
-- ============================================================================

-- Update get_user_project_permissions to consider team membership
-- Drop existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_project_permissions(UUID, UUID);

CREATE OR REPLACE FUNCTION get_user_project_permissions(
    user_id UUID,
    project_id UUID
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
    member_record RECORD;
BEGIN
    -- Check if user is project owner
    SELECT EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = project_id AND p.owner_id = user_id
    ) INTO user_is_owner;
    
    -- Check if user is superuser
    SELECT is_superuser, team_id INTO user_is_superuser, user_team_id
    FROM public.profiles 
    WHERE id = user_id;
    
    -- Owner and superuser have all permissions
    IF user_is_owner OR user_is_superuser THEN
        RETURN QUERY
        SELECT 
            pm.module_key,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN,
            TRUE::BOOLEAN
        FROM public.permission_modules pm;
        RETURN;
    END IF;
    
    -- Get member record
    SELECT * INTO member_record
    FROM public.project_members pm
    WHERE pm.project_id = project_id
    AND pm.user_id = user_id
    AND pm.status IN ('active', 'invited');
    
    IF NOT FOUND THEN
        -- No access
        RETURN;
    END IF;
    
    -- Get permissions from role and custom permissions
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
        AND rp.module_id = pm.id
    )
    LEFT JOIN public.project_member_permissions pmp ON (
        pmp.member_id = member_record.id 
        AND pmp.module_id = pm.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION DATA
-- ============================================================================

-- Create a default "Independent Users" team for existing users without team
DO $$
DECLARE
    default_team_id UUID;
BEGIN
    -- Check if there are users without teams
    IF EXISTS (SELECT 1 FROM public.profiles WHERE team_id IS NULL AND is_superuser = FALSE) THEN
        -- Create default team
        INSERT INTO public.teams (name, description, is_active)
        VALUES ('Unabhängige Benutzer', 'Standard-Team für Benutzer ohne spezifische Teamzugehörigkeit', TRUE)
        RETURNING id INTO default_team_id;
        
        -- Optional: You can leave users without team or assign them to default team
        -- Uncomment the following line to auto-assign existing users to default team
        -- UPDATE public.profiles SET team_id = default_team_id WHERE team_id IS NULL AND is_superuser = FALSE;
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.teams IS 'Teams represent subcontractor companies or organizational units';
COMMENT ON TABLE public.team_invitations IS 'Pending invitations for users to join teams';
COMMENT ON TABLE public.team_project_access IS 'Tracks which teams have access to which projects';
COMMENT ON COLUMN public.profiles.team_id IS 'Team membership for this user';
COMMENT ON COLUMN public.profiles.team_role IS 'Role within the team: member or team_admin';
COMMENT ON COLUMN public.project_members.member_team_id IS 'Snapshot of user team at time of adding to project';
