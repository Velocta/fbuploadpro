-- Migration: 20261010073500_facebook_profile_picture_url.sql
-- Description: Add nullable profile_picture_url, gender, and account_link columns to facebook_accounts and profile_picture_url to facebook_pages

ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
    ADD COLUMN IF NOT EXISTS account_link TEXT;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
