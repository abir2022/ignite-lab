-- 1. Create Course Modules Table (for scheduling)
CREATE TABLE public.course_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  module_order INTEGER NOT NULL,
  scheduled_date DATE,
  scheduled_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow everyone to read course modules
ALTER TABLE public.course_modules DISABLE ROW LEVEL SECURITY;

-- 2. Create Password Requests Table
CREATE TABLE public.password_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Allow everyone to insert requests, disable RLS for admin ease
ALTER TABLE public.password_requests DISABLE ROW LEVEL SECURITY;

-- 3. Create Live Session Resources Table
CREATE TABLE public.live_session_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES public.course_modules(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for ease of access in prototyping
ALTER TABLE public.live_session_resources DISABLE ROW LEVEL SECURITY;

-- 4. Create Storage Buckets (Run these commands manually if the UI is preferred)
INSERT INTO storage.buckets (id, name, public) VALUES ('course-thumbnails', 'course-thumbnails', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('resources', 'resources', true) ON CONFLICT DO NOTHING;

-- Disable storage RLS for quick prototyping
CREATE POLICY "Public Access Thumbnail" ON storage.objects FOR ALL USING (bucket_id = 'course-thumbnails');
CREATE POLICY "Public Access Resources" ON storage.objects FOR ALL USING (bucket_id = 'resources');
