const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function checkSupabase() {
    try {
        const envPath = path.resolve(__dirname, '../apps/web/.env');
        if (!fs.existsSync(envPath)) {
            console.error('❌ .env file found at:', envPath);
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf8');
        const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
        const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

        if (!urlMatch || !keyMatch) {
            console.error('❌ Could not find valid VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
            return;
        }

        const url = urlMatch[1].trim();
        const key = keyMatch[1].trim();

        console.log(`Checking connection to Supabase...`);
        console.log(`URL: ${url}`);
        // console.log(`Key: ${key.substring(0, 10)}...`);

        const supabase = createClient(url, key);

        // Try to reach the Auth service
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'test@example.com',
            password: 'wrong_password_123'
        });

        if (error && error.message === 'Invalid login credentials') {
            console.log('✅ Supabase Auth Service is reachable! (Received expected "Invalid login credentials" response)');
        } else if (error) {
            console.error('⚠️ Received unexpected error from Supabase:', error.message);
            console.log('However, this likely means we DID reach the server.');
        } else {
             console.log('✅ Supabase Auth Service reachable (Unexpected success login??)');
        }

        // Just to be sure about database access, try a simple query that might fail but proves connectivity
        // We assume public schema access or at least a response.
        // Actually, without knowing tables, this is hard. But Auth check is usually sufficient for "Connectivity".
        
    } catch (e) {
        console.error('❌ Script failed:', e);
    }
}

checkSupabase();
