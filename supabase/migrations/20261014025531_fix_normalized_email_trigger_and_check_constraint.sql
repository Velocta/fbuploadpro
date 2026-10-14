-- Migration: 20261014025531_fix_normalized_email_trigger_and_check_constraint.sql
-- Description: Update canonicalize_user_email() trigger function to strip non-alphanumeric characters, clean up existing non-conforming rows prior to index creation, and ensure trigger fires on both email and normalized_email modifications (Resolves ISSUE-26)

-- 1. Update the PL/pgSQL trigger function to strip all non-alphanumeric characters from username
CREATE OR REPLACE FUNCTION canonicalize_user_email()
RETURNS TRIGGER AS $$
DECLARE
  v_raw_email TEXT;
  v_username TEXT;
  v_domain TEXT;
  v_clean_username TEXT;
BEGIN
  -- If email is provided/modified, compute canonicalized email
  IF NEW.email IS NOT NULL THEN
    v_raw_email := trim(NEW.email);
    v_username := split_part(v_raw_email, '@', 1);
    v_domain := lower(split_part(v_raw_email, '@', 2));

    -- Enforce strict Gmail-only domain restriction
    IF v_domain NOT IN ('gmail.com', 'googlemail.com') THEN
      RAISE EXCEPTION 'Only @gmail.com or @googlemail.com email addresses are permitted';
    END IF;

    -- Canonicalize: strip plus subaddressing (+), lowercase, and strip non-alphanumeric characters
    v_username := split_part(v_username, '+', 1);
    v_username := lower(v_username);
    v_clean_username := regexp_replace(v_username, '[^a-z0-9]', '', 'g');

    IF v_clean_username = '' THEN
      RAISE EXCEPTION 'Email username cannot be empty';
    END IF;

    NEW.normalized_email := v_clean_username || '@gmail.com';
  ELSIF NEW.normalized_email IS NOT NULL THEN
    -- If normalized_email was updated directly without email, ensure it is also canonicalized
    v_raw_email := trim(NEW.normalized_email);
    v_username := split_part(v_raw_email, '@', 1);
    v_domain := lower(split_part(v_raw_email, '@', 2));

    IF v_domain NOT IN ('gmail.com', 'googlemail.com') THEN
      RAISE EXCEPTION 'Only @gmail.com or @googlemail.com email addresses are permitted';
    END IF;

    v_username := split_part(v_username, '+', 1);
    v_username := lower(v_username);
    v_clean_username := regexp_replace(v_username, '[^a-z0-9]', '', 'g');

    IF v_clean_username = '' THEN
      RAISE EXCEPTION 'Email username cannot be empty';
    END IF;

    NEW.normalized_email := v_clean_username || '@gmail.com';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Drop and re-create trigger to listen to BEFORE INSERT OR UPDATE OF email, normalized_email ON users
DROP TRIGGER IF EXISTS trg_canonicalize_user_email ON users;
CREATE TRIGGER trg_canonicalize_user_email
BEFORE INSERT OR UPDATE OF email, normalized_email ON users
FOR EACH ROW
EXECUTE FUNCTION canonicalize_user_email();

-- 3. Clean up existing rows that do not conform to canonical alphanumeric lowercase + @gmail.com pattern
UPDATE users
SET normalized_email = regexp_replace(lower(split_part(split_part(email, '@', 1), '+', 1)), '[^a-z0-9]', '', 'g') || '@gmail.com'
WHERE email IS NOT NULL AND (normalized_email IS NULL OR normalized_email !~ '^[a-z0-9]+@gmail\.com$');

-- Null out any rows where email username resolved to empty string
UPDATE users
SET normalized_email = NULL
WHERE normalized_email IS NOT NULL AND normalized_email !~ '^[a-z0-9]+@gmail\.com$';

-- 4. Re-enforce CHECK constraint on normalized_email
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_users_gmail_only;
ALTER TABLE users ADD CONSTRAINT check_users_gmail_only
  CHECK (normalized_email IS NULL OR normalized_email ~ '^[a-z0-9]+@gmail\.com$');

-- 5. Ensure unique index on normalized_email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);
