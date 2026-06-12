-- 1. Create a whitelist for teacher emails
CREATE TABLE IF NOT EXISTS public.teacher_whitelist (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update the profile sync function to check the whitelist
-- Note: This assumes the user has a function named 'handle_new_user' or similar.
-- If I can't find it, I'll provide a generic one.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.email,
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.teacher_whitelist WHERE email = new.email) THEN 'teacher'
      ELSE 'student'
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-apply the trigger (if it exists)
-- This is a bit speculative but common in Supabase templates
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Enable RLS and Policies for whitelist
ALTER TABLE public.teacher_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage whitelist" ON public.teacher_whitelist
  USING (auth.jwt() ->> 'email' = 'admin01@drillab.org');
