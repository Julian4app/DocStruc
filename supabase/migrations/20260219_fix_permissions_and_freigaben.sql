-- ============================================================================
-- FIX: Role-based permissions + Freigaben (Content Visibility) system
-- Date: 2026-02-19
--
-- PART 1: Clean up ALL stale RLS policies on permission tables
--         Ensure role-based permissions work correctly end-to-end
--
-- PART 2: Drop ALL RLS policies that depend on check_user_permission,
--         then safely CREATE OR REPLACE check_user_permission and
--         get_user_project_permissions, then recreate all dropped policies
--
-- PART 3: Create Freigaben (Content Visibility) system
--         - project_content_defaults: per-project per-module default visibility
--         - content_visibility_overrides: per-item visibility overrides
--         - content_shared_with: junction for specific member/team sharing
-- ============================================================================

-- ============================================================================
-- PART 1: COMPREHENSIVE CLEANUP OF ALL STALE POLICIES
-- ============================================================================

-- ============================================================================
-- 1A. DROP ALL old policies on "roles" table (from 20260211 + any others)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own roles" ON public.roles;
DROP POLICY IF EXISTS "Users can create their own roles" ON public.roles;
DROP POLICY IF EXISTS "Users can update their own roles" ON public.roles;
DROP POLICY IF EXISTS "Users can delete their own roles" ON public.roles;
DROP POLICY IF EXISTS "View roles" ON public.roles;
DROP POLICY IF EXISTS "Manage roles" ON public.roles;
DROP POLICY IF EXISTS "Authenticated can view roles" ON public.roles;
DROP POLICY IF EXISTS "Users can manage own roles" ON public.roles;

-- Recreate clean policies
CREATE POLICY "Authenticated can view roles" ON public.roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own roles" ON public.roles
    FOR ALL USING (user_id = auth.uid());

-- ============================================================================
-- 1B. DROP ALL old policies on "role_permissions" table
-- ============================================================================
DROP POLICY IF EXISTS "Users can view permissions for their roles" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can create permissions for their roles" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can update permissions for their roles" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can delete permissions for their roles" ON public.role_permissions;
DROP POLICY IF EXISTS "View role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Manage role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Authenticated can view role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Role owners can manage permissions" ON public.role_permissions;

-- Recreate clean policies
CREATE POLICY "Authenticated can view role permissions" ON public.role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Role owners can manage permissions" ON public.role_permissions
    FOR ALL USING (
        role_id IN (SELECT id FROM public.roles WHERE user_id = auth.uid())
    );

-- ============================================================================
-- 1C. DROP ALL old policies on "project_member_permissions" table
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can view project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Project owners can manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Superusers can manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "View project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Superusers manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Team admins manage project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Authenticated can view project member permissions" ON public.project_member_permissions;
DROP POLICY IF EXISTS "Project owners manage member permissions" ON public.project_member_permissions;

-- Recreate clean policies
CREATE POLICY "Authenticated can view project member permissions" ON public.project_member_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Superusers manage project member permissions" ON public.project_member_permissions
    FOR ALL USING (public.is_current_user_superuser());

CREATE POLICY "Team admins manage project member permissions" ON public.project_member_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.team_project_access tpa ON tpa.project_id = pm.project_id
            WHERE pm.id = project_member_permissions.project_member_id
            AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

-- Project owners can also manage member permissions
CREATE POLICY "Project owners manage member permissions" ON public.project_member_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.project_members pm
            JOIN public.projects p ON p.id = pm.project_id
            WHERE pm.id = project_member_permissions.project_member_id
            AND p.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- 1D. DROP ALL old policies on "project_available_roles" table
-- ============================================================================
DROP POLICY IF EXISTS "View project available roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Manage project available roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Authenticated can view project available roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Superusers can manage project available roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Team admins can manage project available roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Users can view project_available_roles for their projects" ON public.project_available_roles;
DROP POLICY IF EXISTS "Project owners can manage project_available_roles" ON public.project_available_roles;
DROP POLICY IF EXISTS "Project owners can manage project available roles" ON public.project_available_roles;

-- Recreate clean policies
CREATE POLICY "Authenticated can view project available roles" ON public.project_available_roles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Superusers can manage project available roles" ON public.project_available_roles
    FOR ALL USING (public.is_current_user_superuser());

CREATE POLICY "Team admins can manage project available roles" ON public.project_available_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = project_available_roles.project_id
            AND tpa.team_id = (SELECT ti.team_id FROM public.get_current_user_team_info() ti)
        )
        AND (SELECT ti.team_role FROM public.get_current_user_team_info() ti) = 'team_admin'
    );

CREATE POLICY "Project owners can manage project available roles" ON public.project_available_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_available_roles.project_id
            AND p.owner_id = auth.uid()
        )
    );


-- ============================================================================
-- PART 2: FUNCTIONS — DROP DEPENDENT POLICIES, REPLACE FUNCTIONS, RECREATE
-- ============================================================================

-- ============================================================================
-- 2A. DROP ALL RLS POLICIES that reference check_user_permission
--     These must be removed BEFORE we can safely replace the function body
-- ============================================================================

-- time_entries policies
DROP POLICY IF EXISTS "Project members can view time entries with permission" ON public.time_entries;
DROP POLICY IF EXISTS "Users can create their own time entries" ON public.time_entries;

-- documentation_items policies
DROP POLICY IF EXISTS "Project members can view documentation" ON public.documentation_items;
DROP POLICY IF EXISTS "Members with permission can create documentation" ON public.documentation_items;
DROP POLICY IF EXISTS "Members with permission can edit documentation" ON public.documentation_items;
DROP POLICY IF EXISTS "Members with permission can delete documentation" ON public.documentation_items;

-- diary_entries policies
DROP POLICY IF EXISTS "Project members can view diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Members with permission can create diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Members with permission can edit diary entries" ON public.diary_entries;
DROP POLICY IF EXISTS "Members with permission can delete diary entries" ON public.diary_entries;

-- project_messages policies
DROP POLICY IF EXISTS "Project members can view messages" ON public.project_messages;
DROP POLICY IF EXISTS "Project members can create messages" ON public.project_messages;

-- project_info policies
DROP POLICY IF EXISTS "Members with permission can edit project info" ON public.project_info;

-- timeline_events policies
DROP POLICY IF EXISTS "Members with schedule permission can create events" ON public.timeline_events;
DROP POLICY IF EXISTS "Members with schedule permission can edit events" ON public.timeline_events;
DROP POLICY IF EXISTS "Members with schedule permission can delete events" ON public.timeline_events;

-- storage.objects policies that reference check_user_permission
DROP POLICY IF EXISTS "Users can upload project info images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update project info images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete project info images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can update voice messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete voice messages" ON storage.objects;


-- ============================================================================
-- 2B. REPLACE check_user_permission with improved version
--     (adds superuser check, team_admin check, status IN ('active','invited'))
-- ============================================================================

CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_project_id UUID,
    p_module_key TEXT,
    p_permission_type TEXT DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
    user_is_owner BOOLEAN;
    user_is_superuser BOOLEAN;
    user_team_id UUID;
    user_team_role TEXT;
    has_team_access BOOLEAN;
    member_record RECORD;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- 1. Check if user is project owner → full access
    SELECT EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;
    
    IF user_is_owner THEN RETURN TRUE; END IF;
    
    -- 2. Check superuser → full access
    SELECT COALESCE(p.is_superuser, FALSE), p.team_id, p.team_role 
    INTO user_is_superuser, user_team_id, user_team_role
    FROM public.profiles p
    WHERE p.id = p_user_id;
    
    IF user_is_superuser THEN RETURN TRUE; END IF;
    
    -- 3. Check team admin with team access → full access
    IF user_team_id IS NOT NULL AND user_team_role = 'team_admin' THEN
        SELECT EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = p_project_id AND tpa.team_id = user_team_id
        ) INTO has_team_access;
        
        IF COALESCE(has_team_access, FALSE) THEN RETURN TRUE; END IF;
    END IF;
    
    -- 4. Look up project_members record (active or invited)
    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
    AND pmr.user_id = p_user_id
    AND pmr.status IN ('active', 'invited');
    
    IF NOT FOUND THEN RETURN FALSE; END IF;
    
    -- 5. Check custom per-member permissions first
    IF p_permission_type = 'view' THEN
        SELECT COALESCE(pmp.can_view, FALSE) INTO has_permission
        FROM public.project_member_permissions pmp
        WHERE pmp.project_member_id = member_record.id
        AND pmp.module_key = p_module_key;
    ELSIF p_permission_type = 'create' THEN
        SELECT COALESCE(pmp.can_create, FALSE) INTO has_permission
        FROM public.project_member_permissions pmp
        WHERE pmp.project_member_id = member_record.id
        AND pmp.module_key = p_module_key;
    ELSIF p_permission_type = 'edit' THEN
        SELECT COALESCE(pmp.can_edit, FALSE) INTO has_permission
        FROM public.project_member_permissions pmp
        WHERE pmp.project_member_id = member_record.id
        AND pmp.module_key = p_module_key;
    ELSIF p_permission_type = 'delete' THEN
        SELECT COALESCE(pmp.can_delete, FALSE) INTO has_permission
        FROM public.project_member_permissions pmp
        WHERE pmp.project_member_id = member_record.id
        AND pmp.module_key = p_module_key;
    END IF;
    
    -- If custom permission found and TRUE, return it
    IF has_permission IS NOT NULL AND has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- 6. Fall back to role permissions
    IF member_record.role_id IS NOT NULL THEN
        has_permission := FALSE;
        IF p_permission_type = 'view' THEN
            SELECT COALESCE(rp.can_view, FALSE) INTO has_permission
            FROM public.role_permissions rp
            WHERE rp.role_id = member_record.role_id
            AND rp.module_key = p_module_key;
        ELSIF p_permission_type = 'create' THEN
            SELECT COALESCE(rp.can_create, FALSE) INTO has_permission
            FROM public.role_permissions rp
            WHERE rp.role_id = member_record.role_id
            AND rp.module_key = p_module_key;
        ELSIF p_permission_type = 'edit' THEN
            SELECT COALESCE(rp.can_edit, FALSE) INTO has_permission
            FROM public.role_permissions rp
            WHERE rp.role_id = member_record.role_id
            AND rp.module_key = p_module_key;
        ELSIF p_permission_type = 'delete' THEN
            SELECT COALESCE(rp.can_delete, FALSE) INTO has_permission
            FROM public.role_permissions rp
            WHERE rp.role_id = member_record.role_id
            AND rp.module_key = p_module_key;
        END IF;
        
        RETURN COALESCE(has_permission, FALSE);
    END IF;
    
    -- No role and no custom permissions → no access
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2C. REPLACE get_user_project_permissions
--     (This function is NOT referenced by any RLS policies, so DROP is safe)
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
    SELECT * INTO member_record
    FROM public.project_members pmr
    WHERE pmr.project_id = p_project_id
    AND pmr.user_id = p_user_id
    AND pmr.status IN ('active', 'invited');
    
    IF NOT FOUND THEN
        -- No project_members record → return FALSE for all modules
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
    
    -- Member found: COALESCE custom permissions over role permissions
    RETURN QUERY
    SELECT 
        pm.module_key,
        COALESCE(pmp.can_view, rp.can_view, FALSE)::BOOLEAN as can_view,
        COALESCE(pmp.can_create, rp.can_create, FALSE)::BOOLEAN as can_create,
        COALESCE(pmp.can_edit, rp.can_edit, FALSE)::BOOLEAN as can_edit,
        COALESCE(pmp.can_delete, rp.can_delete, FALSE)::BOOLEAN as can_delete
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
-- 2D. RECREATE ALL DEPENDENT RLS POLICIES
--     Now they reference the updated check_user_permission function
-- ============================================================================

-- --- time_entries ---
CREATE POLICY "Project members can view time entries with permission"
  ON public.time_entries FOR SELECT
  USING (
    check_user_permission(auth.uid(), time_entries.project_id, 'time_tracking', 'view')
  );

CREATE POLICY "Users can create their own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects WHERE id = time_entries.project_id AND owner_id = auth.uid()
      )
      OR
      check_user_permission(auth.uid(), time_entries.project_id, 'time_tracking', 'create')
    )
  );

-- --- documentation_items ---
CREATE POLICY "Project members can view documentation"
  ON public.documentation_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_members WHERE project_id = documentation_items.project_id AND user_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'view')
  );

CREATE POLICY "Members with permission can create documentation"
  ON public.documentation_items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
      )
      OR
      check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'create')
    )
  );

CREATE POLICY "Members with permission can edit documentation"
  ON public.documentation_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'edit')
    OR
    created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'edit')
    OR
    created_by = auth.uid()
  );

CREATE POLICY "Members with permission can delete documentation"
  ON public.documentation_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = documentation_items.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), documentation_items.project_id, 'documentation', 'delete')
    OR
    created_by = auth.uid()
  );

-- --- diary_entries ---
CREATE POLICY "Project members can view diary entries"
  ON public.diary_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM project_members WHERE project_id = diary_entries.project_id AND user_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'view')
  );

CREATE POLICY "Members with permission can create diary entries"
  ON public.diary_entries FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
      )
      OR
      check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'create')
    )
  );

CREATE POLICY "Members with permission can edit diary entries"
  ON public.diary_entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'edit')
    OR
    created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'edit')
    OR
    created_by = auth.uid()
  );

CREATE POLICY "Members with permission can delete diary entries"
  ON public.diary_entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = diary_entries.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), diary_entries.project_id, 'diary', 'delete')
    OR
    created_by = auth.uid()
  );

-- --- project_messages ---
CREATE POLICY "Project members can view messages"
  ON public.project_messages FOR SELECT
  USING (
    is_deleted = false
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
      OR
      check_user_permission(auth.uid(), project_messages.project_id, 'communication', 'view')
    )
  );

CREATE POLICY "Project members can create messages"
  ON public.project_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM projects WHERE id = project_messages.project_id AND owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM project_members WHERE project_id = project_messages.project_id AND user_id = auth.uid())
      OR check_user_permission(auth.uid(), project_messages.project_id, 'communication', 'create')
    )
  );

-- --- project_info ---
CREATE POLICY "Members with permission can edit project info"
  ON public.project_info FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), project_info.project_id, 'general_info', 'edit')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = project_info.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), project_info.project_id, 'general_info', 'edit')
  );

-- --- timeline_events ---
CREATE POLICY "Members with schedule permission can create events"
  ON public.timeline_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'create')
  );

CREATE POLICY "Members with schedule permission can edit events"
  ON public.timeline_events FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'edit')
    OR
    created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'edit')
    OR
    created_by = auth.uid()
  );

CREATE POLICY "Members with schedule permission can delete events"
  ON public.timeline_events FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects WHERE id = timeline_events.project_id AND owner_id = auth.uid()
    )
    OR
    check_user_permission(auth.uid(), timeline_events.project_id, 'schedule', 'delete')
  );

-- --- storage.objects: project-info-images ---
CREATE POLICY "Users can upload project info images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

CREATE POLICY "Users can update project info images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

CREATE POLICY "Users can delete project info images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-info-images'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

-- --- storage.objects: project-voice-messages ---
CREATE POLICY "Users can upload voice messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

CREATE POLICY "Users can update voice messages"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);

CREATE POLICY "Users can delete voice messages"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-voice-messages'
  AND (storage.foldername(name))[1] IN (
    SELECT p.id::text 
    FROM projects p 
    WHERE p.owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM project_members pm 
      WHERE pm.project_id = p.id 
      AND pm.user_id = auth.uid()
      AND check_user_permission(auth.uid(), p.id, 'general_info', 'edit')
    )
  )
);


-- ============================================================================
-- PART 3: FREIGABEN (CONTENT VISIBILITY) SYSTEM
-- ============================================================================

-- ============================================================================
-- 3A. Create visibility enum type
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE public.visibility_level AS ENUM (
        'all_participants',  -- All project members can see this module/content
        'team_only',         -- Only the team that created/owns this content can see it
        'owner_only'         -- Only the project owner / superuser can see it
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 3B. project_content_defaults - per-project, per-module default visibility
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.project_content_defaults (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL REFERENCES public.permission_modules(module_key) ON DELETE CASCADE,
    default_visibility public.visibility_level NOT NULL DEFAULT 'all_participants',
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, module_key)
);

ALTER TABLE public.project_content_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view content defaults" ON public.project_content_defaults;
DROP POLICY IF EXISTS "Superusers can manage content defaults" ON public.project_content_defaults;
DROP POLICY IF EXISTS "Project owners can manage content defaults" ON public.project_content_defaults;

CREATE POLICY "Authenticated can view content defaults" ON public.project_content_defaults
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Superusers can manage content defaults" ON public.project_content_defaults
    FOR ALL USING (public.is_current_user_superuser());

CREATE POLICY "Project owners can manage content defaults" ON public.project_content_defaults
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_content_defaults.project_id
            AND p.owner_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_content_defaults_project ON public.project_content_defaults(project_id);

-- ============================================================================
-- 3C. content_visibility_overrides - per-item visibility override
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_visibility_overrides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    content_id UUID NOT NULL,
    visibility public.visibility_level NOT NULL DEFAULT 'all_participants',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(module_key, content_id)
);

ALTER TABLE public.content_visibility_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view visibility overrides" ON public.content_visibility_overrides;
DROP POLICY IF EXISTS "Users can manage own content overrides" ON public.content_visibility_overrides;
DROP POLICY IF EXISTS "Superusers can manage all overrides" ON public.content_visibility_overrides;
DROP POLICY IF EXISTS "Project owners can manage overrides" ON public.content_visibility_overrides;

CREATE POLICY "Authenticated can view visibility overrides" ON public.content_visibility_overrides
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own content overrides" ON public.content_visibility_overrides
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Superusers can manage all overrides" ON public.content_visibility_overrides
    FOR ALL USING (public.is_current_user_superuser());

CREATE POLICY "Project owners can manage overrides" ON public.content_visibility_overrides
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = content_visibility_overrides.project_id
            AND p.owner_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_visibility_overrides_project ON public.content_visibility_overrides(project_id);
CREATE INDEX IF NOT EXISTS idx_visibility_overrides_content ON public.content_visibility_overrides(module_key, content_id);

-- ============================================================================
-- 3D. content_shared_with - junction table for per-item sharing
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.content_shared_with (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    override_id UUID NOT NULL REFERENCES public.content_visibility_overrides(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES auth.users(id),
    shared_with_team_id UUID REFERENCES public.teams(id),
    share_all BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.content_shared_with ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view shared with" ON public.content_shared_with;
DROP POLICY IF EXISTS "Users can manage own shares" ON public.content_shared_with;
DROP POLICY IF EXISTS "Superusers can manage all shares" ON public.content_shared_with;

CREATE POLICY "Authenticated can view shared with" ON public.content_shared_with
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own shares" ON public.content_shared_with
    FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Superusers can manage all shares" ON public.content_shared_with
    FOR ALL USING (public.is_current_user_superuser());

CREATE INDEX IF NOT EXISTS idx_shared_with_override ON public.content_shared_with(override_id);

-- ============================================================================
-- 3E. Helper function: can_user_see_content
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_user_see_content(
    p_user_id UUID,
    p_project_id UUID,
    p_module_key TEXT,
    p_content_id UUID,
    p_content_creator_team_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_is_owner BOOLEAN;
    user_is_superuser BOOLEAN;
    user_team_id UUID;
    user_team_role TEXT;
    effective_visibility public.visibility_level;
    override_record RECORD;
BEGIN
    -- Project owner can always see everything
    SELECT EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = p_project_id AND p.owner_id = p_user_id
    ) INTO user_is_owner;
    IF user_is_owner THEN RETURN TRUE; END IF;
    
    -- Superuser and team admin with access can always see everything
    SELECT COALESCE(p.is_superuser, FALSE), p.team_id, p.team_role 
    INTO user_is_superuser, user_team_id, user_team_role
    FROM public.profiles p
    WHERE p.id = p_user_id;
    IF user_is_superuser THEN RETURN TRUE; END IF;
    
    IF user_team_id IS NOT NULL AND user_team_role = 'team_admin' THEN
        IF EXISTS (
            SELECT 1 FROM public.team_project_access tpa
            WHERE tpa.project_id = p_project_id AND tpa.team_id = user_team_id
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;
    
    -- Determine effective visibility
    SELECT * INTO override_record
    FROM public.content_visibility_overrides cvo
    WHERE cvo.module_key = p_module_key
    AND cvo.content_id = p_content_id;
    
    IF FOUND THEN
        effective_visibility := override_record.visibility;
    ELSE
        SELECT pcd.default_visibility INTO effective_visibility
        FROM public.project_content_defaults pcd
        WHERE pcd.project_id = p_project_id
        AND pcd.module_key = p_module_key;
        
        IF effective_visibility IS NULL THEN
            effective_visibility := 'all_participants';
        END IF;
    END IF;
    
    -- Apply visibility rules
    IF effective_visibility = 'all_participants' THEN
        RETURN TRUE;
    END IF;
    
    IF effective_visibility = 'owner_only' THEN
        RETURN FALSE;
    END IF;
    
    -- team_only: check team membership + explicit sharing
    IF effective_visibility = 'team_only' THEN
        -- Same team as creator
        IF user_team_id IS NOT NULL AND p_content_creator_team_id IS NOT NULL
           AND user_team_id = p_content_creator_team_id THEN
            RETURN TRUE;
        END IF;
        
        -- Check project_members team
        IF EXISTS (
            SELECT 1 FROM public.project_members pm
            WHERE pm.project_id = p_project_id
            AND pm.user_id = p_user_id
            AND pm.status IN ('active', 'invited')
            AND pm.member_team_id IS NOT NULL
            AND pm.member_team_id = p_content_creator_team_id
        ) THEN
            RETURN TRUE;
        END IF;
        
        -- Check explicit sharing
        IF override_record.id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM public.content_shared_with csw
                WHERE csw.override_id = override_record.id
                AND (
                    csw.shared_with_user_id = p_user_id
                    OR csw.share_all = TRUE
                    OR (csw.shared_with_team_id IS NOT NULL AND csw.shared_with_team_id = user_team_id)
                )
            ) THEN
                RETURN TRUE;
            END IF;
        END IF;
        
        RETURN FALSE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3F. Helper function: get_project_content_defaults
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_project_content_defaults(
    p_project_id UUID
)
RETURNS TABLE (
    module_key TEXT,
    module_name TEXT,
    default_visibility TEXT,
    has_custom_default BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pm.module_key,
        pm.module_name,
        COALESCE(pcd.default_visibility::TEXT, 'all_participants') as default_visibility,
        (pcd.id IS NOT NULL) as has_custom_default
    FROM public.permission_modules pm
    LEFT JOIN public.project_content_defaults pcd ON (
        pcd.project_id = p_project_id
        AND pcd.module_key = pm.module_key
    )
    WHERE pm.is_active = true
    ORDER BY pm.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3G. Helper function: get_content_visibility_info
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_content_visibility_info(
    p_project_id UUID,
    p_module_key TEXT,
    p_content_id UUID
)
RETURNS TABLE (
    effective_visibility TEXT,
    has_override BOOLEAN,
    override_id UUID,
    shared_with_users UUID[],
    shared_with_teams UUID[],
    shared_with_all BOOLEAN
) AS $$
DECLARE
    override_rec RECORD;
    vis TEXT;
    users UUID[];
    team_ids UUID[];
    share_all BOOLEAN := FALSE;
BEGIN
    SELECT cvo.* INTO override_rec
    FROM public.content_visibility_overrides cvo
    WHERE cvo.module_key = p_module_key
    AND cvo.content_id = p_content_id;
    
    IF FOUND THEN
        vis := override_rec.visibility::TEXT;
        
        SELECT 
            ARRAY_AGG(DISTINCT csw.shared_with_user_id) FILTER (WHERE csw.shared_with_user_id IS NOT NULL),
            ARRAY_AGG(DISTINCT csw.shared_with_team_id) FILTER (WHERE csw.shared_with_team_id IS NOT NULL),
            BOOL_OR(COALESCE(csw.share_all, FALSE))
        INTO users, team_ids, share_all
        FROM public.content_shared_with csw
        WHERE csw.override_id = override_rec.id;
        
        RETURN QUERY SELECT vis, TRUE, override_rec.id, users, team_ids, COALESCE(share_all, FALSE);
    ELSE
        SELECT COALESCE(pcd.default_visibility::TEXT, 'all_participants') INTO vis
        FROM public.project_content_defaults pcd
        WHERE pcd.project_id = p_project_id
        AND pcd.module_key = p_module_key;
        
        IF vis IS NULL THEN vis := 'all_participants'; END IF;
        
        RETURN QUERY SELECT vis, FALSE, NULL::UUID, NULL::UUID[], NULL::UUID[], FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- PART 4: GRANT EXECUTE PERMISSIONS
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.can_user_see_content(UUID, UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_content_defaults(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_content_visibility_info(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_project_permissions(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_permission(UUID, UUID, TEXT, TEXT) TO authenticated;
