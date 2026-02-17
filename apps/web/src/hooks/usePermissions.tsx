import { useEffect, useState, useCallback, useRef } from 'react';
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
 * @param projectId - The ID of the project to check permissions for
 * @returns Permission check result with utility functions
 */
export function usePermissions(projectId: string | undefined): PermissionCheckResult {
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectOwner, setIsProjectOwner] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const permissionsLoadedRef = useRef(false);

  const loadPermissions = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    permissionsLoadedRef.current = false;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ usePermissions: No authenticated user');
        setPermissions({});
        setIsLoading(false);
        return;
      }

      console.log('🔐 usePermissions: Loading for user:', user.id, 'project:', projectId);

      // Check if user is project owner
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      const isOwner = project?.owner_id === user.id;
      setIsProjectOwner(isOwner);

      // Check user profile: superuser, team info
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superuser, team_id, team_role')
        .eq('id', user.id)
        .single();

      const userIsSuperuser = profile?.is_superuser === true;
      const userIsTeamAdmin = profile?.team_role === 'team_admin' && !!profile?.team_id;
      
      setIsSuperuser(userIsSuperuser);
      setIsTeamAdmin(userIsTeamAdmin);

      console.log('🔐 usePermissions: User roles:', {
        isOwner,
        isSuperuser: userIsSuperuser,
        isTeamAdmin: userIsTeamAdmin,
        teamId: profile?.team_id,
        teamRole: profile?.team_role
      });

      // Owner or superuser → full permissions (no need for RPC)
      if (isOwner || userIsSuperuser) {
        console.log('✅ usePermissions: Owner or superuser → full permissions');
        const { data: modules } = await supabase
          .from('permission_modules')
          .select('module_key')
          .eq('is_active', true);

        const fullPermissions: UserPermissions = {};
        (modules || []).forEach(module => {
          fullPermissions[module.module_key] = {
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true
          };
        });

        setPermissions(fullPermissions);
        permissionsLoadedRef.current = true;
        setIsLoading(false);
        return;
      }

      // Team admin: check if team has access to this project
      if (userIsTeamAdmin && profile?.team_id) {
        const { data: teamAccess } = await supabase
          .from('team_project_access')
          .select('id')
          .eq('project_id', projectId)
          .eq('team_id', profile.team_id)
          .maybeSingle();

        if (teamAccess) {
          console.log('✅ usePermissions: Team admin with team access → full permissions');
          const { data: modules } = await supabase
            .from('permission_modules')
            .select('module_key')
            .eq('is_active', true);

          const fullPermissions: UserPermissions = {};
          (modules || []).forEach(module => {
            fullPermissions[module.module_key] = {
              can_view: true,
              can_create: true,
              can_edit: true,
              can_delete: true
            };
          });

          setPermissions(fullPermissions);
          permissionsLoadedRef.current = true;
          setIsLoading(false);
          return;
        }
      }

      // Regular user: get permissions via RPC
      console.log('🔍 usePermissions: Regular user → calling RPC get_user_project_permissions');
      
      const { data, error } = await supabase
        .rpc('get_user_project_permissions', {
          p_user_id: user.id,
          p_project_id: projectId
        });

      if (error) {
        console.error('❌ usePermissions: RPC error:', error);
        setPermissions({});
      } else {
        const permsObj: UserPermissions = {};
        let viewableCount = 0;
        let restrictedCount = 0;

        (data || []).forEach((perm: any) => {
          permsObj[perm.module_key] = {
            can_view: !!perm.can_view,
            can_create: !!perm.can_create,
            can_edit: !!perm.can_edit,
            can_delete: !!perm.can_delete
          };
          if (perm.can_view) viewableCount++;
          else restrictedCount++;
        });

        console.log('📊 usePermissions: RPC result:', {
          totalModules: (data || []).length,
          viewable: viewableCount,
          restricted: restrictedCount,
          details: Object.entries(permsObj).map(([key, val]) => 
            `${key}: view=${val.can_view} create=${val.can_create} edit=${val.can_edit} delete=${val.can_delete}`
          )
        });

        setPermissions(permsObj);
      }
      
      permissionsLoadedRef.current = true;
    } catch (error) {
      console.error('❌ usePermissions: Unexpected error:', error);
      setPermissions({});
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const canView = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || isSuperuser) return true;
    const result = permissions[moduleKey]?.can_view === true;
    return result;
  }, [isProjectOwner, isSuperuser, permissions]);

  const canCreate = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || isSuperuser) return true;
    return permissions[moduleKey]?.can_create === true;
  }, [isProjectOwner, isSuperuser, permissions]);

  const canEdit = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || isSuperuser) return true;
    return permissions[moduleKey]?.can_edit === true;
  }, [isProjectOwner, isSuperuser, permissions]);

  const canDelete = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || isSuperuser) return true;
    return permissions[moduleKey]?.can_delete === true;
  }, [isProjectOwner, isSuperuser, permissions]);

  const hasAnyPermission = useCallback((moduleKey: string): boolean => {
    if (isProjectOwner || isSuperuser) return true;
    const perm = permissions[moduleKey];
    return perm ? (perm.can_view === true || perm.can_create === true || perm.can_edit === true || perm.can_delete === true) : false;
  }, [isProjectOwner, isSuperuser, permissions]);

  return {
    permissions,
    isLoading,
    isProjectOwner,
    isSuperuser,
    isTeamAdmin,
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
