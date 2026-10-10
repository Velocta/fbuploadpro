-- Migration: 20261010073500_facebook_profile_picture_url.sql
-- Description: Add nullable profile_picture_url TEXT column to facebook_accounts and facebook_pages for storing Graph API v26.0 profile and Page avatar URLs

ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
