import { createDocStrucClient } from '@docstruc/api';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createDocStrucClient(supabaseUrl, supabaseKey);
