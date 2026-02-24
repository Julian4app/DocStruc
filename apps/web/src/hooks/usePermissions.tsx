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
  const { userId, isSuperuser: authIsSuperuser, isTeamAdmin: authIsTeamAdmin, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProjectOwner, setIsProjectOwner] = useState(false);

  // ── Deduplication: prevent concurrent loadPermissions calls from racing ──
  const loadInFlightRef = useRef(false);
  // Track whether we loaded at least once — after that, refetches are silent
  // (no setIsLoading(true)) so PermissionGuard never re-shows spinner.
  const hasLoadedOnceRef = useRef(false);
  // Monotonic counter: if a newer call starts, older ones discard their result
  const loadGenRef = useRef(0);

  const loadPermissions = useCallback(async () => {
    if (!projectId || !userId || authLoading) {
      if (!authLoading && !hasLoadedOnceRef.current) {
        setIsLoading(false);
      }
      return;
    }

    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    const gen = ++loadGenRef.current;

    // Only show spinner on the very first load. After that, keep showing
    // the old permissions while we refetch silently — this prevents the
    // PermissionGuard from flashing the spinner on every tab switch.
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    
    try {
      // Step 1: Check project ownership (single query — profile already cached)
      const { data: project } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      // Stale check — a newer call superseded us
      if (gen !== loadGenRef.current) return;

      const isOwner = project?.owner_id === userId;
      setIsProjectOwner(isOwner);

      // Owner or superuser → full permissions — fetch modules only
      if (isOwner || authIsSuperuser) {
        const { data: modules } = await supabase
          .from('permission_modules')
          .select('module_key')
          .eq('is_active', true);

        if (gen !== loadGenRef.current) return;

        const fullPermissions: UserPermissions = {};
        (modules || []).forEach(module => {
          fullPermissions[module.module_key] = {
            can_view: true, can_create: true, can_edit: true, can_delete: true
          };
        });

        setPermissions(fullPermissions);
        hasLoadedOnceRef.current = true;
        setIsLoading(false);
        return;
      }

      // Regular user / team admin: get permissions via RPC
      const { data, error } = await supabase
        .rpc('get_user_project_permissions', {
          p_user_id: userId,
          p_project_id: projectId
        });

      if (gen !== loadGenRef.current) return;

      if (error) {
        console.error('usePermissions: RPC error:', error);
        // On refetch errors, keep old permissions — don't wipe them
        if (!hasLoadedOnceRef.current) setPermissions({});
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
      
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('usePermissions: Unexpected error:', error);
      // On refetch errors, keep old permissions
      if (!hasLoadedOnceRef.current) setPermissions({});
    } finally {
      if (gen === loadGenRef.current) {
        setIsLoading(false);
      }
      loadInFlightRef.current = false;
    }
  }, [projectId, userId, authIsSuperuser, authLoading]);

  // Reset when projectId changes (navigating to a different project)
  useEffect(() => {
    hasLoadedOnceRef.current = false;
    loadGenRef.current++;
    loadInFlightRef.current = false;
    setIsLoading(true);
    setPermissions({});
    setIsProjectOwner(false);
  }, [projectId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // ── Safety timeout: if permissions are still loading after 8 seconds,
  // force isLoading to false so the user is never stuck on a spinner.
  useEffect(() => {
    if (!isLoading) return;
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('usePermissions: safety timeout — forcing isLoading=false');
        setIsLoading(false);
        loadInFlightRef.current = false; // unblock future calls
      }
    }, 8_000);
    return () => clearTimeout(safetyTimer);
  }, [isLoading]);

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
