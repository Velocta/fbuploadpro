-- =============================================================================
-- Migration: 20261023120000_rls_rpc_hardening.sql
-- Spec: 117 RLS / SECURITY DEFINER RPC Hardening (scope per
-- addendum-2026-10-23-scope-reconciliation.md — the authoritative scope)
-- Purpose:
--   1. Lock down the five LEGACY SECURITY DEFINER RPC overloads that still
--      carry the PostgreSQL default EXECUTE TO PUBLIC (reachable by any
--      authenticated/anon caller via PostgREST): REVOKE EXECUTE from
--      PUBLIC, anon, authenticated; GRANT EXECUTE to service_role. The
--      UNIFIED overloads were already locked down at birth in
--      20261022120000 §6 and are NOT touched here. No code on main calls
--      any legacy overload with a non-service-role client (verified in
--      the addendum's legitimate-caller audit).
--   2. Clamp the legacy claim's p_limit: the body is recreated VERBATIM
--      from 20261022120000 §2a with only the final LIMIT expression
--      changed to LEAST(GREATEST(1, p_limit), 100).
--   3. Prevent authenticated self-escalation on public.users: an
--      authenticated user must not change their own `role` or `status`
--      (users_self_access would otherwise allow role -> 'admin').
--      Column-level REVOKE UPDATE (role, status) is applied, AND —
--      because the spec 117 test rig proved on real PostgreSQL that a
--      column-level REVOKE does NOT deny the update while the role
--      holds Supabase's table-level UPDATE grant (PostgreSQL privileges
--      are additive; the rig's authenticated UPDATE of role succeeded
--      after the column REVOKE) — a BEFORE INSERT OR UPDATE guard
--      trigger is the enforcement mechanism, per plan.md's documented
--      fallback. On UPDATE it rejects role/status changes by
--      authenticated/anon (42501). On INSERT it neutralises the
--      symmetric planting path (fold-in approved by Shahzeb
--      2026-10-23, surfaced by the PR #663 verification gate): there
--      is no signup trigger creating public.users rows — they are
--      created app-side by service-role upserts — so an
--      authenticated caller holding a self-obtained Auth JWT could
--      otherwise INSERT their own row pre-planted with
--      role = 'admin'; the guard forces the column defaults
--      ('user' / 'active', per 20261008120001_initial_schema.sql)
--      for authenticated/anon inserts instead.
--      Profile updates (name, phone, ...) and service-role flows are
--      unaffected; the existing trg_canonicalize_user_email and
--      trg_users_updated_at triggers are untouched.
--   4. workspace_byoc_credentials: recreate workspace_byoc_user_access
--      with the compound workspace-ownership check in USING and
--      WITH CHECK (the pattern the unified tables were born with).
--   5. media_download_jobs: recreate its four policies TO authenticated
--      (bodies otherwise unchanged; they previously applied to PUBLIC).
-- No data changes. No tables or functions are dropped (Phase 7 owns drops).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Legacy RPC EXECUTE lockdown (five signatures)
-- -----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.claim_due_queue_items(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_queue_items(INT, INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, INT, INT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.recover_stuck_publishing_items(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stuck_publishing_items(INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_page_queue_status_counts(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_page_queue_status_counts(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.fail_stuck_download_jobs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_stuck_download_jobs(INT) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. Legacy claim p_limit cap — body VERBATIM from 20261022120000 §2a;
--    the ONLY change is the candidate_ids LIMIT expression:
--      LIMIT GREATEST(1, p_limit)  ->  LIMIT LEAST(GREATEST(1, p_limit), 100)
--    (diff-verified when this migration was authored; see spec 117 PR).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_due_queue_items(
  p_limit INT DEFAULT 10,
  p_max_per_page INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  fb_page_id UUID,
  facebook_account_id UUID,
  media_id UUID,
  post_format TEXT,
  link_url TEXT,
  caption TEXT,
  first_comment TEXT,
  scheduled_time TIMESTAMPTZ,
  status VARCHAR,
  retry_count INT,
  max_retries INT,
  fb_post_id VARCHAR,
  fb_comment_id VARCHAR,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  external_page_id VARCHAR,
  page_external_id VARCHAR,
  encrypted_access_token TEXT,
  encrypted_page_token TEXT,
  page_name VARCHAR,
  media_type VARCHAR,
  media_url TEXT,
  storage_key VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.facebook_pages fp
  SET status = 'active',
      rate_limited_at = NULL,
      updated_at = now()
  WHERE fp.status = 'fb_rate_limited'
    AND COALESCE(fp.rate_limited_at, fp.updated_at) <= now() - INTERVAL '3 days';

  RETURN QUERY
  WITH ranked_due AS (
    SELECT
      qi.id AS queue_id,
      ROW_NUMBER() OVER (
        PARTITION BY qi.fb_page_id
        ORDER BY qi.scheduled_time ASC, qi.id ASC
      ) AS page_rank,
      qi.scheduled_time AS item_scheduled_time
    FROM public.legacy_queue_items qi
    INNER JOIN public.facebook_pages fp
      ON fp.id = qi.fb_page_id
     AND fp.user_id = qi.user_id
    INNER JOIN public.facebook_accounts fa
      ON fa.id = fp.facebook_account_id
     AND fa.user_id = qi.user_id
    LEFT JOIN public.media_items mi
      ON mi.id = qi.media_id
     AND mi.user_id = qi.user_id
    WHERE qi.status = 'queued'
      AND qi.scheduled_time <= now()
      AND fp.status = 'active'
      AND fa.status = 'active'
      AND (fp.next_allowed_publish_at IS NULL OR fp.next_allowed_publish_at <= now())
      AND (
        qi.post_format = 'text'
        OR (qi.media_id IS NOT NULL AND mi.id IS NOT NULL)
      )
  ),
  candidate_ids AS (
    SELECT q.id
    FROM public.legacy_queue_items q
    INNER JOIN ranked_due rd ON rd.queue_id = q.id
    WHERE rd.page_rank <= GREATEST(1, p_max_per_page)
      AND q.status = 'queued'
    ORDER BY rd.item_scheduled_time ASC, q.id ASC
    LIMIT LEAST(GREATEST(1, p_limit), 100)
    FOR UPDATE OF q SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.legacy_queue_items qi
    SET status = 'publishing',
        updated_at = now()
    FROM candidate_ids c
    WHERE qi.id = c.id
    RETURNING qi.*
  )
  SELECT
    c.id,
    c.user_id,
    c.fb_page_id,
    fp.facebook_account_id,
    c.media_id,
    c.post_format::TEXT,
    c.link_url,
    c.caption,
    c.first_comment,
    c.scheduled_time,
    c.status::VARCHAR,
    c.retry_count::INT,
    c.max_retries::INT,
    c.fb_post_id::VARCHAR,
    c.fb_comment_id::VARCHAR,
    c.published_at,
    c.created_at,
    c.updated_at,
    fp.fb_page_id::VARCHAR AS external_page_id,
    fp.fb_page_id::VARCHAR AS page_external_id,
    fp.encrypted_access_token AS encrypted_access_token,
    fp.encrypted_access_token AS encrypted_page_token,
    fp.page_name::VARCHAR,
    mi.media_type::VARCHAR,
    mi.url AS media_url,
    mi.storage_key::VARCHAR
  FROM claimed c
  INNER JOIN public.facebook_pages fp
    ON fp.id = c.fb_page_id
   AND fp.user_id = c.user_id
  LEFT JOIN public.media_items mi
    ON mi.id = c.media_id
   AND mi.user_id = c.user_id
  ORDER BY c.scheduled_time ASC, c.id ASC;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. users: prevent authenticated self-assignment of role / status,
--    on UPDATE (reject) and on INSERT (neutralise to the defaults)
-- -----------------------------------------------------------------------------

-- Defense in depth (removes any column-level grants); NOT sufficient on
-- its own while table-level UPDATE is held — the guard trigger below is
-- the enforcement (see header note 3 for the rig evidence).
REVOKE UPDATE (role, status) ON public.users FROM authenticated;
REVOKE UPDATE (role, status) ON public.users FROM anon;

CREATE OR REPLACE FUNCTION public.guard_users_role_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      -- Self-created rows always start with the column defaults
      -- (20261008120001_initial_schema.sql); a planted role/status is
      -- silently neutralised, never honoured. Service-role upserts
      -- (the app-side row-creation path) are not affected.
      NEW.role := 'user';
      NEW.status := 'active';
    ELSIF TG_OP = 'UPDATE'
          AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status) THEN
      RAISE EXCEPTION 'role and status can only be changed by the service role'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_guard_role_status ON public.users;
CREATE TRIGGER trg_users_guard_role_status
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_role_status();

-- -----------------------------------------------------------------------------
-- 4. workspace_byoc_credentials: compound workspace-ownership policy
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "workspace_byoc_user_access" ON public.workspace_byoc_credentials;
CREATE POLICY "workspace_byoc_user_access" ON public.workspace_byoc_credentials
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

-- -----------------------------------------------------------------------------
-- 5. media_download_jobs: four policies TO authenticated (bodies unchanged
--    from 20261017000000 apart from the TO clause)
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can view their own download jobs"
  ON public.media_download_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can insert their own download jobs"
  ON public.media_download_jobs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can update their own download jobs"
  ON public.media_download_jobs
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own download jobs" ON public.media_download_jobs;
CREATE POLICY "Users can delete their own download jobs"
  ON public.media_download_jobs
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
