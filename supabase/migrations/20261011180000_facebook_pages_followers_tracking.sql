-- Spec 032: Dedicated Facebook Pages Management Section & Follower Growth Tracking
-- Safely rename followers_count to current_followers on facebook_pages and add starting_followers baseline

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facebook_pages'
      AND column_name = 'followers_count'
  ) THEN
    ALTER TABLE public.facebook_pages RENAME COLUMN followers_count TO current_followers;
  END IF;
END $$;

-- Add starting_followers baseline column
ALTER TABLE public.facebook_pages
  ADD COLUMN IF NOT EXISTS starting_followers INT NOT NULL DEFAULT 0 CHECK (starting_followers >= 0);

-- Backfill starting_followers from current_followers for any pre-existing rows where starting_followers = 0
UPDATE public.facebook_pages
SET starting_followers = current_followers
WHERE starting_followers = 0 AND current_followers > 0;
