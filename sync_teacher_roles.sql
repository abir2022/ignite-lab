-- 1. Ensure whitelist uses lowercase for safety
ALTER TABLE public.teacher_whitelist DROP CONSTRAINT IF EXISTS teacher_whitelist_pkey;
ALTER TABLE public.teacher_whitelist ADD PRIMARY KEY (email);

-- 2. Fixed Case-Insensitive Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    LOWER(new.email),
    CASE 
      WHEN EXISTS (SELECT 1 FROM public.teacher_whitelist WHERE LOWER(email) = LOWER(new.email)) THEN 'teacher'
      ELSE 'student'
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update existing users who are in the whitelist but still students
UPDATE public.profiles
SET role = 'teacher'
WHERE role = 'student' 
AND LOWER(email) IN (SELECT LOWER(email) FROM public.teacher_whitelist);
