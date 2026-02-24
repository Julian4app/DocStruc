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
  userId: string | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperuser: boolean;
  isTeamAdmin: boolean;
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

// ── Module-level flags — survive StrictMode double-mount / HMR ──
// explicitSignOut: true only when user clicked the logout button.
// Supabase fires spurious SIGNED_OUT on background token-refresh failures;
// we must NOT react to those.
let _explicitSignOut = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Stable ref: latest userId without stale closure issues
  const userIdRef = useRef<string | null>(null);
  // mountedRef: prevent state updates after unmount (avoids memory leak warnings)
  const mountedRef = useRef(true);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, company_name, avatar_url, is_superuser, team_id, team_role, phone')
        .eq('id', uid)
        .single();
      if (error) {
        console.error('AuthContext: loadProfile error', error.message);
        return;
      }
      if (data && mountedRef.current) {
        setProfile({ ...data, is_superuser: data.is_superuser === true });
      }
    } catch (e) {
      console.error('AuthContext: loadProfile unexpected error', e);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (userIdRef.current) await loadProfile(userIdRef.current);
  }, [loadProfile]);

  useEffect(() => {
    mountedRef.current = true;

    // ── Intercept signOut to flag explicit logouts ──
    const origSignOut = supabase.auth.signOut.bind(supabase.auth);
    (supabase.auth as any).signOut = async (...args: any[]) => {
      _explicitSignOut = true;
      return (origSignOut as any)(...args);
    };

    // ── CRITICAL: setLoading(false) must NEVER be delayed by async work ──
    //
    // Supabase's onAuthStateChange callback is awaited by the library itself
    // (_notifyAllSubscribers awaits every registered callback). If we do any
    // async work (like loadProfile) inside this callback, we hold the Supabase
    // internal lock — which blocks _INITIAL_SESSION from firing for new
    // subscriptions, creating a deadlock where loading never resolves.
    //
    // Fix: the callback is SYNCHRONOUS for all state/loading decisions.
    // Profile loading is fired-and-forgotten (not awaited here).
    //
    // This also means INITIAL_SESSION resolves loading instantly from
    // localStorage — no network round-trip needed.
    let initialEventReceived = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          userIdRef.current = session.user.id;
          if (mountedRef.current) setUserId(session.user.id);
          _explicitSignOut = false;

          // Fire-and-forget profile load — do NOT await here.
          // Awaiting would hold the Supabase lock and delay INITIAL_SESSION.
          if (
            event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'INITIAL_SESSION'
          ) {
            loadProfile(session.user.id); // intentionally not awaited
          }
        } else if (event === 'SIGNED_OUT') {
          if (_explicitSignOut) {
            // Real logout: user clicked the button
            userIdRef.current = null;
            if (mountedRef.current) { setUserId(null); setProfile(null); }
            _explicitSignOut = false;
          } else {
            // FALSE POSITIVE: Supabase fires SIGNED_OUT when a background
            // token-refresh request fails (e.g. network blip after tab switch).
            // The user did NOT log out — ignore this event completely.
          }
        } else if (event === 'INITIAL_SESSION' && !session) {
          // No session at startup = genuinely logged out
          userIdRef.current = null;
          if (mountedRef.current) { setUserId(null); setProfile(null); }
        }

        // Resolve loading after the very first auth event (INITIAL_SESSION).
        if (!initialEventReceived) {
          initialEventReceived = true;
          if (mountedRef.current) setLoading(false);
        }
      }
    );

    // Safety net: if INITIAL_SESSION never fires (e.g. Supabase init failure),
    // unblock the UI after 4 seconds so the user isn't stuck on a spinner.
    const safetyTimer = setTimeout(() => {
      if (!initialEventReceived && mountedRef.current) {
        initialEventReceived = true;
        setLoading(false);
      }
    }, 4000);

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      (supabase.auth as any).signOut = origSignOut;
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
