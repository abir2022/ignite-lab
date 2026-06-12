-- ============================================
-- Ignite Lab: Database Setup Script
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  bio TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  level TEXT CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  thumbnail_url TEXT,
  teacher_id UUID REFERENCES public.profiles(id),
  modules_count INT DEFAULT 0,
  duration TEXT,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id),
  due_date TIMESTAMPTZ,
  assigned_to TEXT DEFAULT 'all', -- 'all' or specific student UUID
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create scheduled_sessions table
CREATE TABLE IF NOT EXISTS public.scheduled_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.profiles(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 90,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'ended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_sessions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Profiles: Everyone can read, users can update their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Courses: Everyone can read, teachers can insert/update their own
CREATE POLICY "Published courses are viewable by everyone" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Teachers can insert courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own courses" ON public.courses FOR UPDATE USING (auth.uid() = teacher_id);

-- Assignments: Students can read, teachers can CRUD
CREATE POLICY "Assignments are viewable by everyone" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "Teachers can insert assignments" ON public.assignments FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own assignments" ON public.assignments FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own assignments" ON public.assignments FOR DELETE USING (auth.uid() = teacher_id);

-- Sessions: Everyone can read, teachers can CRUD
CREATE POLICY "Sessions are viewable by everyone" ON public.scheduled_sessions FOR SELECT USING (true);
CREATE POLICY "Teachers can insert sessions" ON public.scheduled_sessions FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own sessions" ON public.scheduled_sessions FOR UPDATE USING (auth.uid() = teacher_id);
