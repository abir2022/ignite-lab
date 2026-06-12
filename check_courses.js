import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCourses() {
  const { data, error } = await supabase.from('courses').select('*');
  console.log("Courses error:", error);
  console.log("Courses data:", data);
}

checkCourses();
