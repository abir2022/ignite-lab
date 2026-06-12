-- 1. Create Enrollments table
CREATE TABLE IF NOT EXISTS public.enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);

-- 2. Create Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    session_type TEXT DEFAULT 'Live Session', -- 'Live Session', 'Coding Lab', '3D Lab'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Students can view their own enrollments" ON public.enrollments
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage all enrollments" ON public.enrollments
    FOR ALL USING (auth.jwt() ->> 'email' = 'admin01@drillab.org');

CREATE POLICY "Students can log their attendance" ON public.attendance
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins can view all attendance" ON public.attendance
    FOR SELECT USING (auth.jwt() ->> 'email' = 'admin01@drillab.org');

-- 5. Mock Data (Optional, but helps see the dashboard)
-- We will rely on real activity, but I'll add a function to easily enroll students.
