-- Migration: 20261010073500_facebook_profile_picture_url.sql
-- Description: Add nullable profile_picture_url, gender, and account_link columns to facebook_accounts, profile_picture_url to facebook_pages, and convert users.status, facebook_accounts.status, and facebook_pages.status to PostgreSQL ENUM types

ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
    ADD COLUMN IF NOT EXISTS account_link TEXT;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- 1. Create PostgreSQL ENUM types for status columns
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE facebook_account_status AS ENUM ('active', 'disconnected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE facebook_page_status AS ENUM (
        'active',
        'paused',
        'fb_rate_limited',
        'page_checkpoint',
        'invalid_token',
        'disconnected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE facebook_page_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE facebook_page_status ADD VALUE IF NOT EXISTS 'page_checkpoint';

-- 2. Convert users.status to user_status ENUM
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_status_check;

UPDATE users
    SET status = 'active'
    WHERE status IS NULL OR status::text NOT IN ('active', 'suspended');

ALTER TABLE users
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE user_status USING status::text::user_status,
    ALTER COLUMN status SET DEFAULT 'active'::user_status;

-- 3. Convert facebook_accounts.status to facebook_account_status ENUM
ALTER TABLE facebook_accounts
    DROP CONSTRAINT IF EXISTS facebook_accounts_status_check;

UPDATE facebook_accounts
    SET status = 'active'
    WHERE status IS NULL OR status::text NOT IN ('active', 'disconnected', 'expired');

ALTER TABLE facebook_accounts
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE facebook_account_status USING status::text::facebook_account_status,
    ALTER COLUMN status SET DEFAULT 'active'::facebook_account_status;

-- 4. Convert facebook_pages.status to facebook_page_status ENUM
ALTER TABLE facebook_pages
    DROP CONSTRAINT IF EXISTS facebook_pages_status_check;

UPDATE facebook_pages
    SET status = 'active'
    WHERE status IS NULL OR status::text NOT IN ('active', 'fb_rate_limited', 'page_checkpoint', 'invalid_token', 'disconnected');

ALTER TABLE facebook_pages
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE facebook_page_status USING status::text::facebook_page_status,
    ALTER COLUMN status SET DEFAULT 'active'::facebook_page_status;
