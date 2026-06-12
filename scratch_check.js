import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
try {
  const envPath = path.resolve('.env.local');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.error('Error loading env file:', e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAccount() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'teacher01@drillab.org',
    password: 'Abir?!30011430',
  });

  const userId = authData.user.id;
  console.log('User ID:', userId);

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId);
  console.log('Profiles returned:', data);

  if (data && data.length === 0) {
    console.log('No profile exists. The trigger must have failed or was created after signup.');
    console.log('Attempting to create the missing profile row client-side using user session...');
    const { data: insertData, error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      email: 'teacher01@drillab.org',
      full_name: 'Teacher 01',
      role: 'teacher'
    }).select();
    console.log('Insert Result:', insertData, 'Error:', insertError);
  }
}

fixAccount();
