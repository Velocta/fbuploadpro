-- =============================================================================
-- Migration: 20261022000000_worker_heartbeats.sql
-- Spec: 116 Health-Check Depth
-- Purpose:
--   1. Create worker_heartbeats — one row per worker, upserted on every
--      scheduled tick (including early-return / skip paths) so a dead or
--      silently-skipping publishing pipeline is detectable from the web
--      internal health tier (stale if last_success_at > 3 minutes old).
--   2. RLS enabled with NO public policies: only the service role (which
--      bypasses RLS) may read or write. Anon/authenticated get nothing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  worker_name TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_success_at TIMESTAMPTZ NULL,
  last_claimed_count INT NOT NULL DEFAULT 0 CHECK (last_claimed_count >= 0),
  last_settled_count INT NOT NULL DEFAULT 0 CHECK (last_settled_count >= 0),
  last_skip_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

-- No policies are created on purpose: with RLS enabled and zero policies,
-- anon and authenticated roles are denied all access. The worker and the
-- web internal health check both use the service-role client.
REVOKE ALL ON TABLE public.worker_heartbeats FROM anon, authenticated;
GRANT ALL ON TABLE public.worker_heartbeats TO service_role;

DROP TRIGGER IF EXISTS trg_worker_heartbeats_updated_at ON public.worker_heartbeats;
CREATE TRIGGER trg_worker_heartbeats_updated_at
  BEFORE UPDATE ON public.worker_heartbeats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
