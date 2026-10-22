-- Minimal Supabase-environment bootstrap for plain PostgreSQL (spec 122 load harness).
-- Real Supabase provides: the `auth` schema (auth.users, auth.uid()), and the
-- anon / authenticated / service_role roles. The repo migrations assume all
-- of them and create none of them, so a plain-Postgres run must stub them
-- before applying supabase/migrations/ in filename order.
-- The harness connects as the cluster superuser and calls the service-role-only
-- RPCs directly (RLS/GRANTs are therefore not on the harness path, exactly as
-- service_role bypasses RLS in production).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;

-- Only the columns the migrations reference (media_download_jobs.user_id FK).
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase's auth.uid() reads the JWT claim; the harness never runs as an
-- authenticated end user, so a NULL-returning stub is semantically exact.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
