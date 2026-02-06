import { createDocStrucClient } from '@docstruc/api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createDocStrucClient(supabaseUrl, supabaseKey);
