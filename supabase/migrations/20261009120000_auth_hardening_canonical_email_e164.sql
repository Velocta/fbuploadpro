-- Migration: 20261009120000_auth_hardening_canonical_email_e164.sql
-- Description: Add normalized_email column, DB canonicalization trigger, unique index, and check constraints for Gmail canonicalization and E.164 phone formatting

ALTER TABLE users ADD COLUMN IF NOT EXISTS normalized_email VARCHAR(255);

-- Backfill normalized_email for any existing user rows (stripping plus tags and all dots)
UPDATE users 
SET normalized_email = REPLACE(LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '\+.*', '')), '.', '') || '@gmail.com'
WHERE normalized_email IS NULL AND email IS NOT NULL;

-- Function and trigger to enforce Gmail canonicalization at the PostgreSQL database level
CREATE OR REPLACE FUNCTION canonicalize_user_email()
RETURNS TRIGGER AS $$
DECLARE
  v_raw_email TEXT;
  v_username TEXT;
  v_domain TEXT;
BEGIN
  IF NEW.email IS NOT NULL THEN
    v_raw_email := trim(NEW.email);
    v_username := split_part(v_raw_email, '@', 1);
    v_domain := lower(split_part(v_raw_email, '@', 2));

    -- Enforce strict Gmail-only domain restriction
    IF v_domain NOT IN ('gmail.com', 'googlemail.com') THEN
      RAISE EXCEPTION 'Only @gmail.com or @googlemail.com email addresses are permitted';
    END IF;

    -- Canonicalize: strip plus tags (+), strip all dots (.), lowercase
    v_username := split_part(v_username, '+', 1);
    v_username := replace(v_username, '.', '');
    v_username := lower(v_username);

    NEW.normalized_email := v_username || '@gmail.com';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_canonicalize_user_email ON users;
CREATE TRIGGER trg_canonicalize_user_email
BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW
EXECUTE FUNCTION canonicalize_user_email();

-- Unique constraint index on canonicalized email to prevent multi-account deduplication bypass
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);

-- Enforce canonical format constraint on normalized_email (only alphanumeric lowercase + @gmail.com)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_users_gmail_only'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_users_gmail_only
      CHECK (normalized_email IS NULL OR normalized_email ~ '^[a-z0-9]+@gmail\.com$');
  END IF;
END $$;

-- Enforce international E.164 standard phone format (+ followed by 7-15 digits)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_users_phone_e164'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT check_users_phone_e164
      CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$');
  END IF;
END $$;
