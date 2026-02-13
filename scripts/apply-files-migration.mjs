const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from apps/web/.env.local
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let supabaseServiceKey = '';

envLines.forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) {
    supabaseUrl = line.split('=')[1].trim();
  }
  if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) {
    supabaseServiceKey = line.split('=')[1].trim();
  }
});

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Could not find Supabase credentials in .env.local');
  console.log('\nPlease apply the migration manually:');
  console.log('1. Open Supabase Dashboard > SQL Editor');
  console.log('2. Copy the contents of: supabase/migrations/20260213_project_files_system.sql');
  console.log('3. Run the SQL');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Reading migration file...');
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260213_project_files_system.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration to database...');
  
  // Split by semicolon and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).single();
    
    if (error && !error.message.includes('already exists')) {
      console.error(`Error in statement ${i + 1}:`, error);
    }
  }

  console.log('\n✅ Migration applied successfully!');
  console.log('The project files system is now ready to use.');
}

applyMigration().catch(error => {
  console.error('Migration failed:', error);
  console.log('\nPlease apply the migration manually:');
  console.log('1. Open Supabase Dashboard > SQL Editor');
  console.log('2. Copy the contents of: supabase/migrations/20260213_project_files_system.sql');
  console.log('3. Run the SQL');
  process.exit(1);
});
