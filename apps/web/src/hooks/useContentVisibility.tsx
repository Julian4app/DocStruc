import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export type VisibilityLevel = 'all_participants' | 'team_only' | 'owner_only';

export interface ContentVisibilityInfo {
  effective_visibility: VisibilityLevel;
  has_override: boolean;
  override_id: string | null;
  shared_with_users: string[] | null;
  shared_with_teams: string[] | null;
  shared_with_all: boolean;
}

export interface ContentDefaultInfo {
  module_key: string;
  module_name: string;
  default_visibility: VisibilityLevel;
  has_custom_default: boolean;
}

/**
 * Hook to manage content visibility (Freigaben) for a project module.
 * Provides:
 * - The default visibility for the module
 * - A function to check if a specific content item is visible to the current user
 * - A function to set/override visibility for a specific content item
 */
export function useContentVisibility(projectId: string | undefined, moduleKey: string) {
  const [defaultVisibility, setDefaultVisibility] = useState<VisibilityLevel>('all_participants');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [isTeamAdmin, setIsTeamAdmin] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [isProjectOwner, setIsProjectOwner] = useState(false);
  // Map of user_id → team_id for all project members (for team_only checks)
  const [memberTeamMap, setMemberTeamMap] = useState<Map<string, string | null>>(new Map());

  // Promise that resolves when the hook's initial data is loaded.
  // filterVisibleItems will await this before doing any filtering,
  // so pages that call it before the hook is ready will still get correct results.
  const readyResolverRef = useRef<(() => void) | null>(null);
  const readyPromiseRef = useRef<Promise<void>>(
    new Promise<void>((resolve) => { readyResolverRef.current = resolve; })
  );

  // Snapshot ref so filterVisibleItems always reads the latest loaded values
  // even when called before React re-renders with the new state.
  const dataRef = useRef({
    defaultVisibility: 'all_participants' as VisibilityLevel,
    currentUserId: null as string | null,
    userTeamId: null as string | null,
    isSuperuser: false,
    isProjectOwner: false,
    memberTeamMap: new Map<string, string | null>(),
  });

  // Load the module default visibility and user info
  useEffect(() => {
    if (!projectId) {
      // No project - mark as ready immediately with defaults
      setLoading(false);
      readyResolverRef.current?.();
      return;
    }

    // Create a fresh ready promise each time projectId/moduleKey changes
    readyPromiseRef.current = new Promise<void>((resolve) => { readyResolverRef.current = resolve; });
    
    const loadData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          readyResolverRef.current?.();
          return;
        }
        setCurrentUserId(user.id);

        // Load user profile for team info
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_superuser, team_id, team_role')
          .eq('id', user.id)
          .single();

        const _isSuperuser = profile?.is_superuser === true;
        const _userTeamId = profile?.team_id || null;
        setIsSuperuser(_isSuperuser);
        setUserTeamId(_userTeamId);
        setIsTeamAdmin(profile?.team_role === 'team_admin');

        // Check if project owner
        const { data: project } = await supabase
          .from('projects')
          .select('owner_id')
          .eq('id', projectId)
          .single();

        const _isProjectOwner = project?.owner_id === user.id;
        setIsProjectOwner(_isProjectOwner);

        // Load the content default for this module
        const { data: defaults } = await supabase
          .from('project_content_defaults')
          .select('default_visibility')
          .eq('project_id', projectId)
          .eq('module_key', moduleKey)
          .maybeSingle();

        const _defaultVisibility = (defaults?.default_visibility as VisibilityLevel) || 'all_participants';
        setDefaultVisibility(_defaultVisibility);

        // Load team mapping for all project members (needed for team_only filtering)
        const { data: members } = await supabase
          .from('project_members')
          .select('user_id, member_team_id')
          .eq('project_id', projectId);

        // Also load profiles.team_id for members who don't have member_team_id set
        const memberIds = (members || []).map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, team_id')
          .in('id', memberIds.length > 0 ? memberIds : ['__none__']);

        const profileTeamMap = new Map((profiles || []).map(p => [p.id, p.team_id]));
        const newMap = new Map<string, string | null>();
        for (const m of (members || [])) {
          newMap.set(m.user_id, m.member_team_id || profileTeamMap.get(m.user_id) || null);
        }
        // Also include the project owner
        if (project?.owner_id && !newMap.has(project.owner_id)) {
          newMap.set(project.owner_id, profileTeamMap.get(project.owner_id) || null);
        }
        setMemberTeamMap(newMap);

        // Write all loaded values into the ref so filterVisibleItems can read them immediately
        dataRef.current = {
          defaultVisibility: _defaultVisibility,
          currentUserId: user.id,
          userTeamId: _userTeamId,
          isSuperuser: _isSuperuser,
          isProjectOwner: _isProjectOwner,
          memberTeamMap: newMap,
        };
      } catch (error) {
        console.error('useContentVisibility: Error loading data:', error);
      } finally {
        setLoading(false);
        // Signal that the hook is ready — filterVisibleItems can proceed
        readyResolverRef.current?.();
      }
    };

    loadData();
  }, [projectId, moduleKey]);

  /**
   * Check if the current user can see a specific content item.
   * Uses the SQL RPC can_user_see_content for server-side check.
   * For batch filtering (lists), use filterVisibleItems instead.
   */
  const canSeeContent = useCallback(async (
    contentId: string,
    contentCreatorTeamId?: string | null
  ): Promise<boolean> => {
    if (!projectId || !currentUserId) return true;
    if (isProjectOwner || isSuperuser) return true;

    // If default is all_participants and no override, skip the RPC
    if (defaultVisibility === 'all_participants') {
      // Still check if there's an override for this specific item
      const { data: override } = await supabase
        .from('content_visibility_overrides')
        .select('visibility')
        .eq('module_key', moduleKey)
        .eq('content_id', contentId)
        .maybeSingle();

      if (!override || override.visibility === 'all_participants') return true;
    }

    // Use the SQL function for a definitive check
    const { data, error } = await supabase.rpc('can_user_see_content', {
      p_user_id: currentUserId,
      p_project_id: projectId,
      p_module_key: moduleKey,
      p_content_id: contentId,
      p_content_creator_team_id: contentCreatorTeamId || null
    });

    if (error) {
      console.error('useContentVisibility: RPC error:', error);
      return true; // Fail open
    }

    return data === true;
  }, [projectId, currentUserId, isProjectOwner, isSuperuser, defaultVisibility, moduleKey]);

  /**
   * Get the user ID of whoever created this content item.
   * Different tables use different column names: creator_id, created_by, user_id.
   */
  const getCreatorUserId = (item: Record<string, any>): string | null => {
    return item.creator_id || item.created_by || item.user_id || null;
  };

  const resolveCreatorTeamFromMap = (item: Record<string, any>, teamMap: Map<string, string | null>): string | null => {
    // Prefer explicit team fields on the item
    if (item.creator_team_id) return item.creator_team_id;
    if (item.member_team_id) return item.member_team_id;
    // Fall back to looking up the creator's team from the map
    const creatorId = getCreatorUserId(item);
    if (creatorId && teamMap.has(creatorId)) {
      return teamMap.get(creatorId) || null;
    }
    return null;
  };

  /**
   * Filter a list of items based on visibility rules.
   * This function WAITS for the hook to finish loading before filtering,
   * so it always uses the correct defaultVisibility, userTeamId, etc.
   */
  const filterVisibleItems = useCallback(async <T extends { id: string; [key: string]: any }>(
    items: T[]
  ): Promise<T[]> => {
    if (!projectId || items.length === 0) return items;

    // Wait until the hook has finished loading all visibility data
    // Add a timeout to prevent infinite waiting if something goes wrong
    const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 5000));
    await Promise.race([readyPromiseRef.current, timeoutPromise]);

    // Read from the ref for guaranteed-fresh values (React state may not have re-rendered yet)
    const d = dataRef.current;

    console.log(`[ContentVisibility] filterVisibleItems for "${moduleKey}":`, {
      itemCount: items.length,
      defaultVisibility: d.defaultVisibility,
      currentUserId: d.currentUserId,
      isProjectOwner: d.isProjectOwner,
      isSuperuser: d.isSuperuser,
      userTeamId: d.userTeamId,
      memberTeamMapSize: d.memberTeamMap.size,
    });

    if (!d.currentUserId) return items;
    if (d.isProjectOwner || d.isSuperuser) return items;

    // ---- all_participants default: only need to check per-item overrides ----
    if (d.defaultVisibility === 'all_participants') {
      const { data: overrides } = await supabase
        .from('content_visibility_overrides')
        .select('content_id, visibility')
        .eq('project_id', projectId)
        .eq('module_key', moduleKey)
        .neq('visibility', 'all_participants');

      if (!overrides || overrides.length === 0) return items;

      const restrictedMap = new Map(overrides.map(o => [o.content_id, o.visibility as VisibilityLevel]));

      return items.filter(item => {
        if (!restrictedMap.has(item.id)) return true;
        const vis = restrictedMap.get(item.id)!;
        if (vis === 'all_participants') return true;
        if (vis === 'owner_only') return false;
        if (vis === 'team_only') {
          if (getCreatorUserId(item) === d.currentUserId) return true;
          const creatorTeam = resolveCreatorTeamFromMap(item, d.memberTeamMap);
          if (d.userTeamId && creatorTeam && d.userTeamId === creatorTeam) return true;
          return false;
        }
        return false;
      });
    }

    // ---- owner_only default: nothing visible for non-owners ----
    if (d.defaultVisibility === 'owner_only') {
      return [];
    }

    // ---- team_only default: user sees content from their own team ----
    if (d.defaultVisibility === 'team_only') {
      const itemIds = items.map(i => i.id);
      const { data: overrides } = await supabase
        .from('content_visibility_overrides')
        .select('content_id, visibility')
        .eq('module_key', moduleKey)
        .in('content_id', itemIds);

      const overrideMap = new Map((overrides || []).map(o => [o.content_id, o.visibility as VisibilityLevel]));

      return items.filter(item => {
        const effectiveVis = overrideMap.get(item.id) || d.defaultVisibility;

        if (effectiveVis === 'all_participants') return true;
        if (effectiveVis === 'owner_only') return false;

        // team_only checks:
        const creatorId = getCreatorUserId(item);
        // Creator always sees their own item
        if (creatorId === d.currentUserId) return true;
        // No creator (e.g. milestones) → show
        if (!creatorId) return true;
        // Same team → show
        const creatorTeam = resolveCreatorTeamFromMap(item, d.memberTeamMap);
        if (d.userTeamId && creatorTeam && d.userTeamId === creatorTeam) return true;
        // Different team → hide
        return false;
      });
    }

    return items;
  }, [projectId, moduleKey]);

  /**
   * Set or update the visibility override for a specific content item.
   */
  const setContentVisibility = useCallback(async (
    contentId: string,
    visibility: VisibilityLevel
  ): Promise<boolean> => {
    if (!projectId || !currentUserId) return false;

    try {
      const { error } = await supabase
        .from('content_visibility_overrides')
        .upsert({
          project_id: projectId,
          module_key: moduleKey,
          content_id: contentId,
          visibility,
          created_by: currentUserId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'module_key,content_id'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('useContentVisibility: Error setting visibility:', error);
      return false;
    }
  }, [projectId, currentUserId, moduleKey]);

  /**
   * Get the visibility info for a specific content item
   */
  const getContentVisibility = useCallback(async (
    contentId: string
  ): Promise<ContentVisibilityInfo> => {
    if (!projectId) {
      return {
        effective_visibility: 'all_participants',
        has_override: false,
        override_id: null,
        shared_with_users: null,
        shared_with_teams: null,
        shared_with_all: false,
      };
    }

    try {
      const { data, error } = await supabase.rpc('get_content_visibility_info', {
        p_project_id: projectId,
        p_module_key: moduleKey,
        p_content_id: contentId
      });

      if (error) throw error;

      const row = data?.[0];
      return {
        effective_visibility: (row?.effective_visibility as VisibilityLevel) || 'all_participants',
        has_override: row?.has_override || false,
        override_id: row?.override_id || null,
        shared_with_users: row?.shared_with_users || null,
        shared_with_teams: row?.shared_with_teams || null,
        shared_with_all: row?.shared_with_all || false,
      };
    } catch (error) {
      console.error('useContentVisibility: Error getting visibility info:', error);
      return {
        effective_visibility: 'all_participants',
        has_override: false,
        override_id: null,
        shared_with_users: null,
        shared_with_teams: null,
        shared_with_all: false,
      };
    }
  }, [projectId, moduleKey]);

  return {
    defaultVisibility,
    loading,
    isProjectOwner,
    isSuperuser,
    canSeeContent,
    filterVisibleItems,
    setContentVisibility,
    getContentVisibility,
  };
}
