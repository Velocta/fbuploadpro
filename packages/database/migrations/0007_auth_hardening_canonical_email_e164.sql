-- Migration: 0007_auth_hardening_canonical_email_e164.sql
-- Description: Add normalized_email column, unique index, and check constraints for Gmail canonicalization and E.164 phone formatting

ALTER TABLE users ADD COLUMN IF NOT EXISTS normalized_email VARCHAR(255);

-- Backfill normalized_email for any existing user rows
UPDATE users 
SET normalized_email = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '\+.*', '')) || '@gmail.com'
WHERE normalized_email IS NULL;

-- Unique constraint index on canonicalized email to prevent multi-account deduplication bypass
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);

-- Enforce Gmail-only domain check constraint on normalized_email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_users_gmail_only'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_users_gmail_only
      CHECK (normalized_email ~* '^[a-z0-9._%+-]+@gmail\.com$');
  END IF;
END $$;

-- Enforce international E.164 standard phone format
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_users_phone_e164'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_users_phone_e164
      CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;
