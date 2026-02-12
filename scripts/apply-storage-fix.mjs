import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const envPath = path.join(__dirname, '../apps/web/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

for (const line of envLines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  } else if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
    supabaseKey = line.split('=')[1].trim();
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Read the SQL file
const sqlPath = path.join(__dirname, '../supabase/migrations/20260212_fix_voice_storage_access.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

console.log('Executing migration...');
console.log('SQL:', sql);

// Execute the SQL
// Note: We need to use the service role key for DDL operations
// For now, let's just print the SQL and the user can run it manually
console.log('\n=== MIGRATION SQL ===');
console.log(sql);
console.log('\n=== Please run this SQL in your Supabase SQL Editor ===');
console.log('Go to: https://vnwovhrwaxbewelgfwsy.supabase.co/project/_/sql');
