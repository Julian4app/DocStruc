#!/usr/bin/env node
/**
 * Applies the Help Center RLS fix migration to Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<your-key> node scripts/apply-help-rls-fix.mjs
 *
 * Or add VITE_SUPABASE_SERVICE_ROLE_KEY to apps/web/.env.local and run:
 *   node scripts/apply-help-rls-fix.mjs
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load credentials ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://vnwovhrwaxbewelgfwsy.supabase.co';

let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!serviceKey) {
  // Try reading from apps/web/.env.local
  try {
    const envLocal = readFileSync(join(__dirname, '../apps/web/.env.local'), 'utf8');
    for (const line of envLocal.split('\n')) {
      if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) {
        serviceKey = line.split('=').slice(1).join('=').trim();
      }
    }
  } catch (_) {}
}

if (!serviceKey) {
  console.error('\n❌  Service role key not found.\n');
  console.error('Option 1 — Run with env var:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/apply-help-rls-fix.mjs\n');
  console.error('Option 2 — Add to apps/web/.env.local:');
  console.error('  VITE_SUPABASE_SERVICE_ROLE_KEY=<key>\n');
  console.error('Option 3 — Run the SQL manually:');
  console.error('  1. Open https://supabase.com/dashboard/project/vnwovhrwaxbewelgfwsy/sql');
  console.error('  2. Paste the contents of: supabase/migrations/20260219_fix_help_center_rls.sql');
  console.error('  3. Click Run\n');
  process.exit(1);
}

// ── Read SQL ──────────────────────────────────────────────────────────────────
const sql = readFileSync(
  join(__dirname, '../supabase/migrations/20260219_fix_help_center_rls.sql'),
  'utf8'
);

// ── Execute via Supabase REST ─────────────────────────────────────────────────
console.log('🔧  Applying Help Center RLS fix...\n');

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

// Supabase doesn't expose a generic SQL endpoint via REST — use pg endpoint
const pgRes = await fetch(`${SUPABASE_URL}/pg`, {
  method: 'POST',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (pgRes.ok) {
  console.log('✅  RLS policies updated successfully!\n');
  console.log('The admin panel can now save FAQs, tags, walkthroughs, videos and documents.');
} else {
  const body = await pgRes.text();
  // If the pg endpoint isn't available, fall back to instructions
  console.error('⚠️  Could not apply automatically (pg endpoint not exposed).\n');
  console.error('Please run the SQL manually:');
  console.error('  1. Open https://supabase.com/dashboard/project/vnwovhrwaxbewelgfwsy/sql/new');
  console.error('  2. Paste the contents of: supabase/migrations/20260219_fix_help_center_rls.sql');
  console.error('  3. Click Run\n');
  console.error('Raw response:', body);
}
