-- Add salary defaults to profiles (for auto-filling payroll)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS base_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transport_allowance numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meal_allowance numeric DEFAULT 0;

-- Add rate card and engagement data to content_plans
ALTER TABLE public.content_plans
  ADD COLUMN IF NOT EXISTS rate_card numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_likes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_comments integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_shares integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS engagement_reach integer DEFAULT 0;