import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
  isSuperuser: boolean;
  isTeamAdmin: boolean;
  canView: (moduleKey: string) => boolean;
  canCreate: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canDelete: (moduleKey: string) => boolean;
  hasAnyPermission: (moduleKey: string) => boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to check user permissions for a specific project
 * Hierarchy: owner → superuser → team admin (with team access) → RPC (role/custom permissions)
 * Uses AuthContext for cached user/profile data — no redundant auth.getUser() or profile queries.
 */
export function usePermissions(projectId: string | undefined): PermissionCheckResult {
  const { userId, profile, isSuperuser: authIsSuperuser, isTeamAdmin: authIsTeamAdmin, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectOwner, setIsProjectOwner] = useState(false);
  const permissionsLoadedRef = useRef(false);

  const loadPermissions = useCallback(async () => {
    if (!projectId || !userId || authLoading) {
      if (!authLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    permissionsLoadedRef.current = false;
    
    try {
      // Step 1: Check project ownership (single query — profile already cached)
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      const isOwner = project?.owner_id === userId;
      setIsProjectOwner(isOwner);

      // Owner or superuser → full permissions — fetch modules only
      if (isOwner || authIsSuperuser) {
        const { data: modules } = await supabase
          .from('permission_modules')
          .select('module_key')
          .eq('is_active', true);

        const fullPermissions: UserPermissions = {};
        (modules || []).forEach(module => {
          fullPermissions[module.module_key] = {
            can_view: true, can_create: true, can_edit: true, can_delete: true
          };
        });

        setPermissions(fullPermissions);
        permissionsLoadedRef.current = true;
        setIsLoading(false);
        return;
      }

      // Team admin: check if team has access to this project
      if (authIsTeamAdmin && profile?.team_id) {
        // Parallelize: team_access + modules in one go
        const [teamAccessResult, modulesResult] = await Promise.all([
          supabase
            .from('team_project_access')
            .select('id')
            .eq('project_id', projectId)
            .eq('team_id', profile.team_id)
            .maybeSingle(),
          supabase
            .from('permission_modules')
            .select('module_key')
            .eq('is_active', true),
        ]);

        if (teamAccessResult.data) {
          const fullPermissions: UserPermissions = {};
          (modulesResult.data || []).forEach(module => {
            fullPermissions[module.module_key] = {
              can_view: true, can_create: true, can_edit: true, can_delete: true
            };
          });

          setPermissions(fullPermissions);
          permissionsLoadedRef.current = true;
          setIsLoading(false);
          return;
        }
      }

      // Regular user: get permissions via RPC
      const { data, error } = await supabase
        .rpc('get_user_project_permissions', {
          p_user_id: userId,
          p_project_id: projectId
        });

      if (error) {
        console.error('usePermissions: RPC error:', error);
        setPermissions({});
      } else {
        const permsObj: UserPermissions = {};
        (data || []).forEach((perm: any) => {
          permsObj[perm.module_key] = {
            can_view: !!perm.can_view,
            can_create: !!perm.can_create,
            can_edit: !!perm.can_edit,
            can_delete: !!perm.can_delete
          };
        });
        setPermissions(permsObj);
      }
      
      permissionsLoadedRef.current = true;
    } catch (error) {
      console.error('usePermissions: Unexpected error:', error);
      setPermissions({});
    } finally {
      setIsLoading(false);
    }
  }, [projectId, userId, authIsSuperuser, authIsTeamAdmin, profile?.team_id, authLoading]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const canView = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || authIsSuperuser) return true;
    const result = permissions[moduleKey]?.can_view === true;
    return result;
  }, [isProjectOwner, authIsSuperuser, permissions]);

  const canCreate = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || authIsSuperuser) return true;
    return permissions[moduleKey]?.can_create === true;
  }, [isProjectOwner, authIsSuperuser, permissions]);

  const canEdit = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || authIsSuperuser) return true;
    return permissions[moduleKey]?.can_edit === true;
  }, [isProjectOwner, authIsSuperuser, permissions]);

  const canDelete = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || authIsSuperuser) return true;
    return permissions[moduleKey]?.can_delete === true;
  }, [isProjectOwner, authIsSuperuser, permissions]);

  const hasAnyPermission = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || authIsSuperuser) return true;
    const perm = permissions[moduleKey];
    return perm ? (perm.can_view === true || perm.can_create === true || perm.can_edit === true || perm.can_delete === true) : false;
  }, [isProjectOwner, authIsSuperuser, permissions]);

  return {
    permissions,
    isLoading,
    isProjectOwner,
    isSuperuser: authIsSuperuser,
    isTeamAdmin: authIsTeamAdmin,
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
  const { permissions, isLoading, isProjectOwner, isSuperuser } = usePermissions(projectId);

  if (isProjectOwner || isSuperuser) {
    return { hasPermission: true, isLoading: false };
  }

  let hasPermission = false;
  const perm = permissions[moduleKey];

  if (perm) {
    switch (permissionType) {
      case 'view':
        hasPermission = perm.can_view === true;
        break;
      case 'create':
        hasPermission = perm.can_create === true;
        break;
      case 'edit':
        hasPermission = perm.can_edit === true;
        break;
      case 'delete':
        hasPermission = perm.can_delete === true;
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
    return null;
  }

  if (!hasPermission) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
