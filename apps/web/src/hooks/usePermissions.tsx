import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UserPermissions {
  [moduleKey: string]: {
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  };
}

export interface PermissionCheckResult {
  permissions: UserPermissions;
  isLoading: boolean;
  isProjectOwner: boolean;
  canView: (moduleKey: string) => boolean;
  canCreate: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canDelete: (moduleKey: string) => boolean;
  hasAnyPermission: (moduleKey: string) => boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to check user permissions for a specific project
 * @param projectId - The ID of the project to check permissions for
 * @returns Permission check result with utility functions
 */
export function usePermissions(projectId: string | undefined): PermissionCheckResult {
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectOwner, setIsProjectOwner] = useState(false);

  const loadPermissions = async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if user is project owner
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', projectId)
        .single();

      const isOwner = project?.created_by === user.id;
      setIsProjectOwner(isOwner);

      if (isOwner) {
        // Project owner has all permissions
        const { data: modules } = await supabase
          .from('permission_modules')
          .select('module_key')
          .eq('is_active', true);

        const ownerPermissions: UserPermissions = {};
        (modules || []).forEach(module => {
          ownerPermissions[module.module_key] = {
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true
          };
        });

        setPermissions(ownerPermissions);
        setIsLoading(false);
        return;
      }

      // Get user's permissions via RPC function
      const { data, error } = await supabase
        .rpc('get_user_project_permissions', {
          p_user_id: user.id,
          p_project_id: projectId
        });

      if (error) {
        console.error('Error loading permissions:', error);
        setPermissions({});
      } else {
        const permsObj: UserPermissions = {};
        (data || []).forEach((perm: any) => {
          permsObj[perm.module_key] = {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete
          };
        });
        setPermissions(permsObj);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [projectId]);

  const canView = (moduleKey: string): boolean => {
    if (isProjectOwner) return true;
    return permissions[moduleKey]?.can_view || false;
  };

  const canCreate = (moduleKey: string): boolean => {
    if (isProjectOwner) return true;
    return permissions[moduleKey]?.can_create || false;
  };

  const canEdit = (moduleKey: string): boolean => {
    if (isProjectOwner) return true;
    return permissions[moduleKey]?.can_edit || false;
  };

  const canDelete = (moduleKey: string): boolean => {
    if (isProjectOwner) return true;
    return permissions[moduleKey]?.can_delete || false;
  };

  const hasAnyPermission = (moduleKey: string): boolean => {
    if (isProjectOwner) return true;
    const perm = permissions[moduleKey];
    return perm ? (perm.can_view || perm.can_create || perm.can_edit || perm.can_delete) : false;
  };

  return {
    permissions,
    isLoading,
    isProjectOwner,
    canView,
    canCreate,
    canEdit,
    canDelete,
    hasAnyPermission,
    refresh: loadPermissions
  };
}

/**
 * Hook to check a specific permission for the current user
 * @param projectId - The ID of the project
 * @param moduleKey - The module to check (e.g., 'tasks', 'defects')
 * @param permissionType - The type of permission to check ('view', 'create', 'edit', 'delete')
 * @returns boolean indicating if user has the permission
 */
export function useHasPermission(
  projectId: string | undefined,
  moduleKey: string,
  permissionType: 'view' | 'create' | 'edit' | 'delete'
): { hasPermission: boolean; isLoading: boolean } {
  const { permissions, isLoading, isProjectOwner } = usePermissions(projectId);

  if (isProjectOwner) {
    return { hasPermission: true, isLoading: false };
  }

  let hasPermission = false;
  const perm = permissions[moduleKey];

  if (perm) {
    switch (permissionType) {
      case 'view':
        hasPermission = perm.can_view;
        break;
      case 'create':
        hasPermission = perm.can_create;
        break;
      case 'edit':
        hasPermission = perm.can_edit;
        break;
      case 'delete':
        hasPermission = perm.can_delete;
        break;
    }
  }

  return { hasPermission, isLoading };
}

/**
 * Component wrapper that only renders children if user has permission
 */
export function PermissionGate({
  projectId,
  moduleKey,
  permission = 'view',
  fallback = null,
  children
}: {
  projectId: string | undefined;
  moduleKey: string;
  permission?: 'view' | 'create' | 'edit' | 'delete';
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission, isLoading } = useHasPermission(projectId, moduleKey, permission);

  if (isLoading) {
    return null; // Or a loading indicator
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
