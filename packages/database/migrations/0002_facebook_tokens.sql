-- Migration: 0002_facebook_tokens.sql
-- Description: Add encrypted access tokens, expiration timestamps, and page metadata

ALTER TABLE facebook_accounts
    ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

ALTER TABLE facebook_pages
    ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tasks JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Remove default '' constraint after column creation so future inserts require explicit tokens
ALTER TABLE facebook_accounts ALTER COLUMN encrypted_access_token DROP DEFAULT;
ALTER TABLE facebook_pages ALTER COLUMN encrypted_access_token DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_fb_accounts_status ON facebook_accounts(status);
CREATE INDEX IF NOT EXISTS idx_fb_pages_status ON facebook_pages(status);
