-- =====================================================
-- FIX: Permission functions for invited AND active members
-- Run this in Supabase SQL Editor
-- =====================================================

-- Fix check_user_permission to work for active AND invited members
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_project_id UUID,
  p_module_key TEXT,
  p_permission_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_member_id UUID;
  v_role_id UUID;
  v_has_permission BOOLEAN := false;
BEGIN
  -- Check if user is project owner (full access)
  SELECT EXISTS(
    SELECT 1 FROM projects
    WHERE id = p_project_id AND owner_id = p_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN true;
  END IF;

  -- Get member record (active OR invited members have permissions)
  SELECT id, role_id INTO v_member_id, v_role_id
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status IN ('active', 'invited');

  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check custom permissions first
  IF p_permission_type = 'view' THEN
    SELECT can_view INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  ELSIF p_permission_type = 'create' THEN
    SELECT can_create INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  ELSIF p_permission_type = 'edit' THEN
    SELECT can_edit INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  ELSIF p_permission_type = 'delete' THEN
    SELECT can_delete INTO v_has_permission
    FROM project_member_permissions
    WHERE project_member_id = v_member_id AND module_key = p_module_key;
  END IF;

  -- If custom permission found, return it
  IF v_has_permission IS NOT NULL THEN
    RETURN v_has_permission;
  END IF;

  -- Otherwise check role permissions
  IF v_role_id IS NOT NULL THEN
    IF p_permission_type = 'view' THEN
      SELECT can_view INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    ELSIF p_permission_type = 'create' THEN
      SELECT can_create INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    ELSIF p_permission_type = 'edit' THEN
      SELECT can_edit INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    ELSIF p_permission_type = 'delete' THEN
      SELECT can_delete INTO v_has_permission
      FROM role_permissions
      WHERE role_id = v_role_id AND module_key = p_module_key;
    END IF;
  END IF;

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix get_user_project_permissions to work for active AND invited members
CREATE OR REPLACE FUNCTION get_user_project_permissions(
  p_user_id UUID,
  p_project_id UUID
) RETURNS TABLE(
  module_key TEXT,
  module_name TEXT,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  -- Check if user is project owner (full access)
  IF EXISTS(SELECT 1 FROM projects WHERE id = p_project_id AND owner_id = p_user_id) THEN
    RETURN QUERY
    SELECT
      pm.module_key,
      pm.module_name,
      true AS can_view,
      true AS can_create,
      true AS can_edit,
      true AS can_delete
    FROM permission_modules pm
    WHERE pm.is_active = true
    ORDER BY pm.display_order;
    RETURN;
  END IF;

  -- Get permissions for active or invited members
  RETURN QUERY
  WITH member_info AS (
    SELECT m.id, m.role_id
    FROM project_members m
    WHERE m.project_id = p_project_id
      AND m.user_id = p_user_id
      AND m.status IN ('active', 'invited')
    LIMIT 1
  ),
  role_perms AS (
    SELECT
      rp.module_key,
      rp.can_view,
      rp.can_create,
      rp.can_edit,
      rp.can_delete
    FROM role_permissions rp
    JOIN member_info mi ON rp.role_id = mi.role_id
  ),
  custom_perms AS (
    SELECT
      pmp.module_key,
      pmp.can_view,
      pmp.can_create,
      pmp.can_edit,
      pmp.can_delete
    FROM project_member_permissions pmp
    JOIN member_info mi ON pmp.project_member_id = mi.id
  )
  SELECT
    pm.module_key,
    pm.module_name,
    COALESCE(cp.can_view, rp.can_view, false) AS can_view,
    COALESCE(cp.can_create, rp.can_create, false) AS can_create,
    COALESCE(cp.can_edit, rp.can_edit, false) AS can_edit,
    COALESCE(cp.can_delete, rp.can_delete, false) AS can_delete
  FROM permission_modules pm
  LEFT JOIN role_perms rp ON pm.module_key = rp.module_key
  LEFT JOIN custom_perms cp ON pm.module_key = cp.module_key
  WHERE pm.is_active = true
  ORDER BY pm.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_user_permission TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_permissions TO authenticated;

SELECT 'PERMISSION FUNCTIONS UPDATED' as status;
