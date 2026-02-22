-- ============================================================================
-- FIX: Default view permissions for project members
-- ============================================================================
-- ROOT CAUSE:
-- get_user_project_permissions uses COALESCE(pmp.can_view, rp.can_view, FALSE).
-- If a member has:
--   - role_id = NULL (no role assigned), OR
--   - a role with no rows in role_permissions for a given module_key
-- AND no project_member_permissions override exists
-- → COALESCE returns FALSE → PermissionGuard shows "Kein Zugriff"
--
-- This causes /tasks to be blocked while /defects works, purely because
-- some roles happen to have role_permissions entries for defects but not tasks.
--
-- FIX STRATEGY:
-- Change the COALESCE fallback from FALSE to TRUE for can_view.
-- Any authenticated project member (status=open/active/invited) can VIEW all
-- modules by default. Write permissions (create/edit/delete) still default to
-- FALSE. The project owner retains full control and can restrict via roles.
--
-- This matches real-world construction software expectations:
-- "All team members can see everything, only write access is restricted."
-- ============================================================================

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
    IF user_is_owner OR COALESCE(user_is_superuser, FALSE) THEN
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
        
        -- Team admin with access → ALL permissions
        IF COALESCE(has_team_access, FALSE) THEN
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
    
    -- Regular user: find their project_members record
    -- Accept status IN ('open', 'active', 'invited') — aligned with has_project_access
    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
    AND pmr.user_id = p_user_id
    AND pmr.status IN ('open', 'active', 'invited');
    
    IF NOT FOUND THEN
        -- No valid project_members record → return FALSE for all modules
        RETURN QUERY
        SELECT 
            pm.module_key,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN,
            FALSE::BOOLEAN
        FROM public.permission_modules pm
        WHERE pm.is_active = true;
        RETURN;
    END IF;
    
    -- Member found: COALESCE custom permissions over role permissions.
    --
    -- KEY CHANGE: can_view defaults to TRUE (not FALSE).
    -- Any valid project member can VIEW all modules by default.
    -- Write permissions (create/edit/delete) still default to FALSE.
    --
    -- Role permissions or per-member overrides can RESTRICT or GRANT:
    --   COALESCE(per-member-override, role-permission, DEFAULT)
    --
    -- This means:
    --   - If no role and no override: can_view=TRUE, create/edit/delete=FALSE
    --   - If role has can_view=FALSE: can_view=FALSE (role explicitly restricts)
    --   - If role has can_view=TRUE: can_view=TRUE
    --   - If per-member override exists: it takes precedence over role
    RETURN QUERY
    SELECT 
        pm.module_key,
        COALESCE(pmp.can_view,    rp.can_view,    TRUE)::BOOLEAN  as can_view,
        COALESCE(pmp.can_create,  rp.can_create,  FALSE)::BOOLEAN as can_create,
        COALESCE(pmp.can_edit,    rp.can_edit,    FALSE)::BOOLEAN as can_edit,
        COALESCE(pmp.can_delete,  rp.can_delete,  FALSE)::BOOLEAN as can_delete
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
-- Diagnostic: Run this in Supabase SQL Editor to verify after applying.
-- Replace 'USER_ID' and 'PROJECT_ID' with real values.
--
-- SELECT * FROM get_user_project_permissions('USER_ID'::uuid, 'PROJECT_ID'::uuid)
-- ORDER BY module_key;
--
-- Expected: all rows have can_view=TRUE
-- ============================================================================
