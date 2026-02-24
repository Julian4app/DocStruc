import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const createDocStrucClient = (url: string, key: string): SupabaseClient => {
  if (!url || !key) {
    console.warn('Supabase URL or Key is missing!');
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: 'docstruc-auth-v1',
    },
    // No custom global.fetch — use browser's native fetch.
    // Supabase's auth client already has its own retry/backoff logic
    // for token refreshes. A custom fetchWithTimeout was causing
    // requests to be aborted when the browser tab was backgrounded,
    // leading to cascading failures.
  });
};

export * from './tasks';
export * from './members';
export * from './storage';
export * from './structure';
export * from './activity';
export { COLS } from './columns';

