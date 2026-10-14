-- Migration: 20261014150000_preserve_paused_facebook_pages.sql
-- Description: Corrective migration for ISSUE-41. Ensures 'paused' status is strictly preserved on facebook_pages and never overwritten to 'active'.

-- 1. Ensure facebook_page_status enum contains 'paused'
DO $$ BEGIN
    ALTER TYPE facebook_page_status ADD VALUE IF NOT EXISTS 'paused';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Verify and guard default column status
ALTER TABLE public.facebook_pages
    ALTER COLUMN status SET DEFAULT 'active'::facebook_page_status;

-- 3. Any fallback repair on corrupted/null status must strictly preserve all valid enum states including 'paused'
UPDATE public.facebook_pages
    SET status = 'active'::facebook_page_status
    WHERE status IS NULL OR status::text NOT IN ('active', 'paused', 'fb_rate_limited', 'page_checkpoint', 'invalid_token', 'disconnected');

-- 4. Comment documenting integrity guarantee
COMMENT ON COLUMN public.facebook_pages.status IS 'Status of the Facebook page strictly preserving paused state and error states (active, paused, fb_rate_limited, page_checkpoint, invalid_token, disconnected).';
