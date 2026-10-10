-- Migration: 20261010073500_facebook_profile_picture_url.sql
-- Description: Add nullable profile_picture_url, gender, and account_link columns to facebook_accounts, profile_picture_url to facebook_pages, and 'page_checkpoint' to facebook_pages.status constraint

ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
    ADD COLUMN IF NOT EXISTS account_link TEXT;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

ALTER TABLE facebook_pages
    DROP CONSTRAINT IF EXISTS facebook_pages_status_check;

ALTER TABLE facebook_pages
    ADD CONSTRAINT facebook_pages_status_check
    CHECK (status IN ('active', 'fb_rate_limited', 'page_checkpoint', 'invalid_token', 'disconnected'));
