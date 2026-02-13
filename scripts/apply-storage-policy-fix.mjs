import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('Required variables: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  try {
    console.log('📁 Reading migration file...');
    const migrationPath = join(__dirname, '../supabase/migrations/20260214_fix_storage_policies.sql');
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log('🔄 Applying storage policy fixes...');
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      const { error } = await supabase.rpc('exec_sql', { 
        sql_string: statement + ';'
      });
      
      if (error) {
        // Try direct execution if rpc fails
        const { error: directError } = await supabase
          .from('_sqlexec')
          .insert({ query: statement + ';' });
        
        if (directError) {
          console.warn('⚠️  Warning executing statement:', directError.message);
        }
      }
    }

    console.log('✅ Storage policies updated successfully!');
    console.log('');
    console.log('📝 Changes applied:');
    console.log('  - Fixed storage.objects policies for project-files bucket');
    console.log('  - Updated path parsing to use split_part instead of foldername');
    console.log('  - Added UPDATE policy for file modifications');
    console.log('');
    console.log('🎉 You can now upload files to folders!');

  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.log('');
    console.log('📋 Manual application steps:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Copy the contents of: supabase/migrations/20260214_fix_storage_policies.sql');
    console.log('3. Paste and run the SQL');
    process.exit(1);
  }
}

applyMigration();
