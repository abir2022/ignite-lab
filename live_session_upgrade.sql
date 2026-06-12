-- ============================================
-- Ignite Lab: Live Session Timing & Control Upgrade
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Add control columns to course_modules table
ALTER TABLE public.course_modules 
ADD COLUMN IF NOT EXISTS is_forced_started BOOLEAN DEFAULT false;

ALTER TABLE public.course_modules 
ADD COLUMN IF NOT EXISTS is_forced_ended BOOLEAN DEFAULT false;

ALTER TABLE public.course_modules 
ADD COLUMN IF NOT EXISTS extended_minutes INTEGER DEFAULT 0;

-- 2. Update existing rows to have default values
UPDATE public.course_modules 
SET 
  is_forced_started = COALESCE(is_forced_started, false),
  is_forced_ended = COALESCE(is_forced_ended, false),
  extended_minutes = COALESCE(extended_minutes, 0);
