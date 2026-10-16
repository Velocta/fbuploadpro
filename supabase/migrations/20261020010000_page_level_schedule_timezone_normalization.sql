-- =============================================================================
-- Migration: 20261020010000_page_level_schedule_timezone_normalization.sql
-- Purpose:
--   1. Add single invariant 'timezone' column to facebook_pages (default 'UTC')
--   2. Backfill facebook_pages.timezone from existing page_queue_slots records
--   3. Drop redundant per-slot 'timezone' column from page_queue_slots
-- =============================================================================

-- 1. Add timezone column to facebook_pages
ALTER TABLE public.facebook_pages
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'UTC';

-- 2. Backfill facebook_pages.timezone from existing page_queue_slots if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'page_queue_slots' 
      AND column_name = 'timezone'
  ) THEN
    UPDATE public.facebook_pages fp
    SET timezone = sub.timezone
    FROM (
      SELECT DISTINCT ON (fb_page_id) fb_page_id, timezone
      FROM public.page_queue_slots
      WHERE timezone IS NOT NULL AND length(btrim(timezone)) > 0
      ORDER BY fb_page_id, created_at DESC
    ) sub
    WHERE fp.id = sub.fb_page_id;
  END IF;
END $$;

-- 3. Drop per-slot timezone from page_queue_slots
ALTER TABLE public.page_queue_slots
  DROP COLUMN IF EXISTS timezone;
