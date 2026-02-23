import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  is_superuser: boolean;
  team_id: string | null;
  team_role: string | null;
  phone: string | null;
  created_at?: string;
}

interface AuthState {
  /** The authenticated user id, or null if not logged in */
  userId: string | null;
  /** Cached profile (loaded once, refreshable) */
  profile: UserProfile | null;
  /** True while the initial auth check + profile load is in progress */
  loading: boolean;
  /** Convenience booleans */
  isSuperuser: boolean;
  isTeamAdmin: boolean;
  /** Force a profile re-fetch (e.g. after editing profile) */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  userId: null,
  profile: null,
  loading: true,
  isSuperuser: false,
  isTeamAdmin: false,
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, company_name, avatar_url, is_superuser, team_id, team_role, phone')
      .eq('id', uid)
      .single();

    if (!error && data && mountedRef.current) {
      setProfile({
        ...data,
        is_superuser: data.is_superuser === true,
      });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  useEffect(() => {
    mountedRef.current = true;

    // Fast path: check session from cache first (no network round-trip)
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mountedRef.current) {
          setUserId(session.user.id);
          await loadProfile(session.user.id);
        }
      } catch (e) {
        console.error('AuthContext: init error', e);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    init();

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mountedRef.current) return;
        if (session?.user) {
          setUserId(session.user.id);
          // Always reload profile on SIGNED_IN.
          // Also reload on TOKEN_REFRESHED if we somehow lost the profile
          // (e.g. tab was in background and React GC'd the state).
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await loadProfile(session.user.id);
          }
        } else if (event === 'SIGNED_OUT') {
          setUserId(null);
          setProfile(null);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const isSuperuser = profile?.is_superuser === true;
  const isTeamAdmin = profile?.team_role === 'team_admin' && !!profile?.team_id;

  return (
    <AuthContext.Provider value={{ userId, profile, loading, isSuperuser, isTeamAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
