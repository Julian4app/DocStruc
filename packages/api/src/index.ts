import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const createDocStrucClient = (url: string, key: string): SupabaseClient => {
  if (!url || !key) {
    console.warn('Supabase URL or Key is missing!');
  }
  return createClient(url, key);
};

export * from './tasks';
export * from './members';
export * from './storage';
export * from './structure';
export * from './activity';

