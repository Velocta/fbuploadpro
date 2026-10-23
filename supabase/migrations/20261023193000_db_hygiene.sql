-- =============================================================================
-- Migration: 20261023193000_db_hygiene.sql
-- Spec: 139 production-grade — database hygiene (verified DB-audit findings)
-- Purpose:
--   1. LOW / FIX-TODAY — the unified recovery sweep
--      recover_stuck_publishing_items(public.platform, INT) filters
--        status = 'publishing' AND platform = p_platform
--        AND COALESCE(claimed_at, updated_at) <= cutoff
--      but the unified public.queue_items (20261022120000 §4e) has no index
--      that can serve it: its indexes lead with status/scheduled_time,
--      platform/status/scheduled_time, destination_id or workspace_id.
--      The LEGACY table had two partial publishing indexes for exactly
--      this sweep (idx_queue_items_publishing_stale in 20261014100000,
--      idx_queue_items_stuck_publishing in 20261016000000 /
--      20261018000000 — both stayed behind on legacy_queue_items after the
--      rename). Add the missing partial index on the unified table.
--   2. INFO / hygiene — five trigger functions still carry the PostgreSQL
--      default EXECUTE TO PUBLIC:
--        public.guard_users_role_status()        (20261023120000)
--        public.set_updated_at()                 (20261014160000)
--        public.check_media_folders_cycle()      (20261014170000)
--        public.prevent_workspace_owner_transfer() (20261014120000)
--        public.canonicalize_user_email()        (20261009120000,
--                                                 replaced 20261014025531)
--      All five RETURN TRIGGER, so PostgREST cannot expose them as RPCs
--      and this is zero-urgency hygiene — but PUBLIC EXECUTE is needless
--      surface, so revoke it. REVOKE EXECUTE does NOT affect trigger
--      firing: the trigger mechanism invokes the function as the table
--      owner and never consults the function's EXECUTE ACL (proven by
--      the db-hygiene rig: every trigger below still fires after the
--      revokes — see apps/worker/tests/db-hygiene/).
-- No data changes. No functions, triggers or tables are created, altered
-- or dropped. The settle RPC and all other functions are untouched.
-- Idempotent: CREATE INDEX IF NOT EXISTS; REVOKE is a no-op when the
-- privilege is already absent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Recovery-sweep index for the unified queue_items.
--
-- CONCURRENTLY note: CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction, and Supabase migrations execute inside one — so this is a
-- plain CREATE INDEX. That is safe today because queue_items is small
-- (its write lock is brief). If the table ever grows large before this
-- migration is applied somewhere, build the same index CONCURRENTLY
-- out-of-band first; the IF NOT EXISTS below then makes this a no-op.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_queue_items_publishing_claimed
  ON public.queue_items (platform, claimed_at)
  WHERE status = 'publishing';

-- -----------------------------------------------------------------------------
-- 2. Trigger functions: drop the default PUBLIC EXECUTE.
--    (No GRANT is added for anyone: a trigger function needs no caller —
--    the trigger machinery runs it as the table owner regardless of ACLs,
--    and nothing legitimate calls these functions directly.)
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.guard_users_role_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_media_folders_cycle() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_workspace_owner_transfer() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.canonicalize_user_email() FROM PUBLIC;
