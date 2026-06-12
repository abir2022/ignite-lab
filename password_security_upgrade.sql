-- 1. Update profiles table to store secret questions
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS secret_question TEXT DEFAULT 'What is your pet dog?',
ADD COLUMN IF NOT EXISTS secret_answer TEXT DEFAULT 'tommy';

-- 2. Update existing profiles with the default dog question
UPDATE public.profiles 
SET secret_question = 'What is your pet dog?', secret_answer = 'tommy'
WHERE secret_question IS NULL;

-- 3. Update password_requests to hold the submitted verification info
ALTER TABLE public.password_requests
ADD COLUMN IF NOT EXISTS submitted_answer TEXT,
ADD COLUMN IF NOT EXISTS requested_password TEXT;
