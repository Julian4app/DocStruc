import { supabase } from '../lib/supabase';

export interface PermissionCheck {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

/**
 * Check if the current user has a specific permission on a project module
 */
export async function checkPermission(
  projectId: string,
  moduleKey: string,
  permissionType: 'view' | 'create' | 'edit' | 'delete'
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .rpc('check_user_permission', {
        p_user_id: user.id,
        p_project_id: projectId,
        p_module_key: moduleKey,
        p_permission_type: permissionType
      });

    if (error) {
      console.error('Permission check error:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Get all permissions for the current user on a project
 */
export async function getUserProjectPermissions(projectId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .rpc('get_user_project_permissions', {
        p_user_id: user.id,
        p_project_id: projectId
      });

    if (error) {
      console.error('Error getting permissions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting permissions:', error);
    return [];
  }
}

/**
 * Get all available permission modules
 */
export async function getPermissionModules() {
  try {
    const { data, error } = await supabase
      .from('permission_modules')
      .select('id, module_key, module_name, description, display_order, is_active')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading permission modules:', error);
    return [];
  }
}

/**
 * Get all roles for the current user
 */
export async function getUserRoles() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('roles')
      .select(`
        id, user_id, role_name, role_description, is_system_role, is_active, created_at, updated_at,
        role_permissions (
          module_key,
          can_view,
          can_create,
          can_edit,
          can_delete
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading roles:', error);
    return [];
  }
}

/**
 * Create a new role with permissions
 */
export async function createRole(
  roleName: string,
  roleDescription: string,
  permissions: Array<{
    module_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create role
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .insert({
        user_id: user.id,
        role_name: roleName,
        role_description: roleDescription,
        is_system_role: false,
        is_active: true
      })
      .select()
      .single();

    if (roleError) throw roleError;

    // Create permissions
    if (permissions.length > 0) {
      const permsToInsert = permissions.map(perm => ({
        role_id: role.id,
        ...perm
      }));

      const { error: permsError } = await supabase
        .from('role_permissions')
        .insert(permsToInsert);

      if (permsError) throw permsError;
    }

    return role;
  } catch (error) {
    console.error('Error creating role:', error);
    throw error;
  }
}

/**
 * Update a role and its permissions
 */
export async function updateRole(
  roleId: string,
  roleName: string,
  roleDescription: string,
  permissions: Array<{
    module_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>
) {
  try {
    // Update role
    const { error: updateError } = await supabase
      .from('roles')
      .update({
        role_name: roleName,
        role_description: roleDescription,
        updated_at: new Date().toISOString()
      })
      .eq('id', roleId);

    if (updateError) throw updateError;

    // Delete existing permissions
    await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);

    // Insert new permissions
    if (permissions.length > 0) {
      const permsToInsert = permissions.map(perm => ({
        role_id: roleId,
        ...perm
      }));

      const { error: permsError } = await supabase
        .from('role_permissions')
        .insert(permsToInsert);

      if (permsError) throw permsError;
    }

    return true;
  } catch (error) {
    console.error('Error updating role:', error);
    throw error;
  }
}

/**
 * Delete a role (soft delete)
 */
export async function deleteRole(roleId: string) {
  try {
    const { error } = await supabase
      .from('roles')
      .update({ is_active: false })
      .eq('id', roleId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
}

/**
 * Get all user accessors (users that can be added to projects)
 */
export async function getUserAccessors() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_accessors')
      .select('id, owner_id, accessor_email, accessor_first_name, accessor_last_name, accessor_phone, accessor_company, accessor_type, notes, registered_user_id, is_active, created_at, updated_at')
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading accessors:', error);
    return [];
  }
}

/**
 * Create a new user accessor
 */
export async function createUserAccessor(accessor: {
  accessor_email: string;
  accessor_first_name?: string;
  accessor_last_name?: string;
  accessor_phone?: string;
  accessor_company?: string;
  accessor_type: 'employee' | 'owner' | 'subcontractor' | 'other';
  notes?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('user_accessors')
      .insert({
        owner_id: user.id,
        ...accessor,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating accessor:', error);
    throw error;
  }
}

/**
 * Update a user accessor
 */
export async function updateUserAccessor(accessorId: string, updates: Partial<{
  accessor_email: string;
  accessor_first_name: string;
  accessor_last_name: string;
  accessor_phone: string;
  accessor_company: string;
  accessor_type: 'employee' | 'owner' | 'subcontractor' | 'other';
  notes: string;
}>) {
  try {
    const { error } = await supabase
      .from('user_accessors')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', accessorId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating accessor:', error);
    throw error;
  }
}

/**
 * Delete a user accessor (soft delete)
 */
export async function deleteUserAccessor(accessorId: string) {
  try {
    const { error } = await supabase
      .from('user_accessors')
      .update({ is_active: false })
      .eq('id', accessorId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting accessor:', error);
    throw error;
  }
}

/**
 * Add a member to a project with role or custom permissions
 */
export async function addProjectMember(
  projectId: string,
  accessorId: string,
  roleId?: string,
  customPermissions?: Array<{
    module_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>
) {
  try {
    // Get accessor details
    const { data: accessor } = await supabase
      .from('user_accessors')
      .select('id, owner_id, accessor_email, accessor_first_name, accessor_last_name, accessor_phone, accessor_company, accessor_type, notes, registered_user_id, is_active, created_at, updated_at')
      .eq('id', accessorId)
      .single();

    if (!accessor) throw new Error('Accessor not found');

    // Create project member
    const { data: member, error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: accessor.registered_user_id || null,
        accessor_id: accessorId,
        member_type: accessor.accessor_type,
        role_id: roleId || null,
        role: 'member'
      })
      .select()
      .single();

    if (memberError) throw memberError;

    // If custom permissions provided, create them
    if (customPermissions && customPermissions.length > 0) {
      const permsToInsert = customPermissions.map(perm => ({
        project_member_id: member.id,
        ...perm
      }));

      const { error: permsError } = await supabase
        .from('project_member_permissions')
        .insert(permsToInsert);

      if (permsError) throw permsError;
    }

    return member;
  } catch (error) {
    console.error('Error adding project member:', error);
    throw error;
  }
}

/**
 * Update project member permissions
 */
export async function updateProjectMemberPermissions(
  memberId: string,
  roleId?: string,
  customPermissions?: Array<{
    module_key: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>
) {
  try {
    // Update member's role_id
    const { error: updateError } = await supabase
      .from('project_members')
      .update({ role_id: roleId || null })
      .eq('id', memberId);

    if (updateError) throw updateError;

    // Delete existing custom permissions
    await supabase
      .from('project_member_permissions')
      .delete()
      .eq('project_member_id', memberId);

    // If custom permissions provided, create them
    if (customPermissions && customPermissions.length > 0) {
      const permsToInsert = customPermissions.map(perm => ({
        project_member_id: memberId,
        ...perm
      }));

      const { error: permsError } = await supabase
        .from('project_member_permissions')
        .insert(permsToInsert);

      if (permsError) throw permsError;
    }

    return true;
  } catch (error) {
    console.error('Error updating member permissions:', error);
    throw error;
  }
}

/**
 * Remove a member from a project
 */
export async function removeProjectMember(memberId: string) {
  try {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error removing project member:', error);
    throw error;
  }
}

/**
 * Get audit log for permissions
 */
export async function getPermissionAuditLog(projectId?: string, limit = 50) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('permission_audit_log')
      .select('id, user_id, project_id, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error loading audit log:', error);
    return [];
  }
}
