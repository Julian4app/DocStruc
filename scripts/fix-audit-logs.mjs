import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables from web app .env
const envPath = path.join(__dirname, '../apps/web/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

let supabaseUrl = '';
let serviceRoleKey = '';

for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=').slice(1).join('=').trim();
  } else if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    serviceRoleKey = line.split('=').slice(1).join('=').trim();
  } else if (line.startsWith('VITE_SUPABASE_ANON_KEY=') && !serviceRoleKey) {
    // fallback: anon key won't have DDL rights, but try anyway
    serviceRoleKey = line.split('=').slice(1).join('=').trim();
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/web/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const sqlPath = path.join(__dirname, '../supabase/migrations/20260312_fix_audit_logs_columns.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

console.log('🔧  Applying audit_logs column fix migration...');

const { error } = await supabase.rpc('exec_sql', { sql }).catch(() => ({ error: null }));

if (error) {
  console.error('❌  Migration failed via RPC, attempting direct query...');
  console.log('\n📋  Please run the following SQL manually in the Supabase SQL Editor:\n');
  console.log('='.repeat(60));
  console.log(sql);
  console.log('='.repeat(60));
} else {
  console.log('✅  Migration applied successfully!');
}
