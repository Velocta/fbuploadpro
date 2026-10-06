-- Migration: Add status and follower columns to facebook_inapp_schedule_pages

-- 1. Add status and rate limiting columns
ALTER TABLE public.facebook_inapp_schedule_pages
  ADD COLUMN IF NOT EXISTS status profile_status_enum DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS rate_limited_until timestamptz;

-- 2. Add followers tracking columns (bigint & boolean)
ALTER TABLE public.facebook_inapp_schedule_pages
  ADD COLUMN IF NOT EXISTS followers_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers_gained bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_followers_updated boolean NOT NULL DEFAULT false;

-- 3. Add generated column for net change tracking
ALTER TABLE public.facebook_inapp_schedule_pages
  ADD COLUMN IF NOT EXISTS changed_followers bigint GENERATED ALWAYS AS (
    coalesce(followers_gained, 0) - coalesce(followers_count, 0)
  ) STORED;

-- 4. Create indexes to speed up page-level status checks and ordering
CREATE INDEX IF NOT EXISTS idx_fb_inapp_schedule_pages_status 
  ON public.facebook_inapp_schedule_pages(status);
