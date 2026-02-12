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
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testVoiceUpload() {
  console.log('Testing voice message upload...');
  
  // Create a test audio blob (1 second of silence in WebM format)
  const testBlob = new Blob([new Uint8Array(1000).fill(0)], { type: 'audio/webm' });
  console.log('Test blob size:', testBlob.size, 'bytes');
  
  const testFileName = `test/voice_test_${Date.now()}.webm`;
  console.log('Uploading to:', testFileName);
  
  const { data, error } = await supabase.storage
    .from('project-voice-messages')
    .upload(testFileName, testBlob, {
      contentType: 'audio/webm',
      upsert: false
    });
  
  if (error) {
    console.error('❌ Upload failed!');
    console.error('Error:', error);
    console.error('This means the storage policies are not correctly set.');
    console.error('\nPlease run the SQL migration in Supabase SQL Editor:');
    console.error('https://vnwovhrwaxbewelgfwsy.supabase.co/project/_/sql\n');
    return false;
  }
  
  console.log('✅ Upload successful!');
  console.log('Data:', data);
  
  // Try to get public URL
  const { data: urlData } = supabase.storage
    .from('project-voice-messages')
    .getPublicUrl(testFileName);
  
  console.log('Public URL:', urlData.publicUrl);
  
  // Clean up
  await supabase.storage.from('project-voice-messages').remove([testFileName]);
  console.log('✅ Test file cleaned up');
  
  return true;
}

testVoiceUpload()
  .then(success => {
    if (success) {
      console.log('\n✅ All tests passed! Voice message upload is working correctly.');
    } else {
      console.log('\n❌ Tests failed. Please apply the SQL migration.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
