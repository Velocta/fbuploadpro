-- =============================================================================
-- Migration: 20261024100000_deferred_settle_outcome.sql
-- Spec: 139 Production-Grade — DEFER settle outcome (deferrals must not
-- burn retry budget). Ruling: Shahzeb, 2026-10-24 ("fix it"), closing the
-- spec tension flagged by the Phase 5 verification coordinator.
--
-- Target: public.settle_queue_item_outcome — the UNIFIED 17-arg overload
-- as hardened in 20261023130000_settle_rpc_hardening.sql:
--   (UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT,
--    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT, JSONB)
--    RETURNS TEXT
-- The legacy 16-arg overload (INT error codes) is untouched.
--
-- PROBLEM: the settle vocabulary had no "defer without counting"
-- outcome. Every publisher-side deferral — a platform cap hit (D5:
-- defer, never fail) or X's platform-wide 402 credits-exhausted pause —
-- had to settle as `retry`, and the worker's retry mapping passes
-- retry_count + 1, so an item MERELY WAITING out a cap or an outage
-- burned one retry per deferral cycle. A long outage could exhaust an
-- item's retry budget and land it in a false terminal `failed` without
-- a single real publish attempt failing.
--
-- CHANGE (body is the hardened body verbatim except the two marked
-- changes):
--
--   1. [DEFER] A new outcome branch: p_outcome_status = 'deferred'.
--      The item returns to `queued` with the caller's delay (same
--      rescheduling shape as the retry branch, same [139-1] status
--      guard: only an item still in `publishing` settles, otherwise
--      'already_settled' with no side effects) — but the branch
--      deliberately does NOT write retry_count: the column keeps its
--      current value no matter what p_retry_count the caller passed.
--      The publish_logs row records result = 'deferred' with the
--      deferral's error code/message (the reason) and the [139-3]
--      p_detail carrier merged exactly as in the other branches.
--      Destination/account side effects (cooldown via [139-2]
--      monotonic GREATEST, target statuses) are shared with the other
--      branches — X's 402 deferral carries its 1-hour destination
--      cooldown through this branch.
--
--   2. publish_logs.result CHECK widened to admit 'deferred'
--      (was: 'success', 'retry', 'failure'). No existing row changes;
--      the widened set is a superset.
--
-- The signature is UNCHANGED, so CREATE OR REPLACE suffices (no DROP,
-- no second overload, PostgREST named-argument resolution unaffected);
-- ACLs survive the replace and are re-asserted below per the spec
-- 117/120 pattern. search_path stays pinned. No data changes beyond
-- the CHECK widening.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Widen the publish_logs.result vocabulary with 'deferred'.
-- -----------------------------------------------------------------------------
ALTER TABLE public.publish_logs
  DROP CONSTRAINT publish_logs_result_check,
  ADD CONSTRAINT publish_logs_result_check
    CHECK (result IN ('success', 'retry', 'failure', 'deferred'));

-- -----------------------------------------------------------------------------
-- 2. Recreate the unified settle function: hardened body + [DEFER] branch.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_queue_item_outcome(
  p_queue_item_id UUID,
  p_workspace_id UUID,
  p_destination_id UUID,
  p_outcome_status TEXT,
  p_external_post_id TEXT DEFAULT NULL,
  p_external_comment_id TEXT DEFAULT NULL,
  p_retry_count INT DEFAULT 0,
  p_retry_delay_seconds INT DEFAULT 300,
  p_error_code TEXT DEFAULT NULL,
  p_error_subcode TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_comment_warning TEXT DEFAULT NULL,
  p_target_destination_status TEXT DEFAULT NULL,
  p_target_account_status TEXT DEFAULT NULL,
  p_destination_cooldown_seconds INT DEFAULT NULL,
  p_rate_usage_pct SMALLINT DEFAULT NULL,
  p_detail JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_platform public.platform;
  v_result VARCHAR(20);
  v_log_message TEXT;
  v_destination_status VARCHAR(30);
  v_updated INT;
BEGIN
  SELECT qi.platform INTO v_platform
  FROM public.queue_items qi
  WHERE qi.id = p_queue_item_id;
  IF p_outcome_status = 'published' THEN
    UPDATE public.queue_items
    SET status = 'published',
        external_post_id = p_external_post_id,
        external_comment_id = p_external_comment_id,
        error_code = NULL,
        error_subcode = NULL,
        error_message = NULL,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND workspace_id = p_workspace_id
      AND status = 'publishing';

    -- [139-1] 0 rows: item is not in `publishing` (already settled,
    -- cancelled, or gone) — no-op without a publish_logs row or any
    -- destination/account side effect.
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN 'already_settled';
    END IF;

    v_result := 'success';
    v_log_message := p_comment_warning;

  ELSIF p_outcome_status = 'deferred' THEN
    -- [DEFER] Deferral without counting: the item returns to `queued`
    -- and becomes due after the caller's delay, exactly like the retry
    -- branch — EXCEPT that retry_count is deliberately absent from the
    -- SET list, so the stored count is unchanged whatever value the
    -- caller passed in p_retry_count. No publish attempt failed (or,
    -- for readiness/cap deferrals, was even made), so no retry budget
    -- is consumed.
    UPDATE public.queue_items
    SET status = 'queued',
        scheduled_time = now() + make_interval(secs => GREATEST(1, COALESCE(p_retry_delay_seconds, 300))),
        claimed_at = NULL,
        error_code = p_error_code,
        error_subcode = p_error_subcode,
        error_message = p_error_message,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND workspace_id = p_workspace_id
      AND status = 'publishing';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN 'already_settled';
    END IF;

    v_result := 'deferred';
    v_log_message := p_error_message;

  ELSIF p_outcome_status = 'queued' OR p_outcome_status = 'retry' THEN
    UPDATE public.queue_items
    SET status = 'queued',
        retry_count = p_retry_count,
        scheduled_time = now() + make_interval(secs => GREATEST(1, COALESCE(p_retry_delay_seconds, 300))),
        claimed_at = NULL,
        error_code = p_error_code,
        error_subcode = p_error_subcode,
        error_message = p_error_message,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND workspace_id = p_workspace_id
      AND status = 'publishing';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN 'already_settled';
    END IF;

    v_result := 'retry';
    v_log_message := p_error_message;

  ELSE
    UPDATE public.queue_items
    SET status = 'failed',
        retry_count = p_retry_count,
        error_code = p_error_code,
        error_subcode = p_error_subcode,
        error_message = p_error_message,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND workspace_id = p_workspace_id
      AND status = 'publishing';

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
      RETURN 'already_settled';
    END IF;

    v_result := 'failure';
    v_log_message := p_error_message;
  END IF;

  INSERT INTO public.publish_logs (
    queue_item_id,
    destination_id,
    platform,
    attempt_no,
    result,
    external_post_id,
    response_code,
    response_message,
    duration_ms,
    detail,
    created_at
  ) VALUES (
    p_queue_item_id,
    p_destination_id,
    v_platform,
    COALESCE(p_retry_count, 0) + 1,
    v_result,
    p_external_post_id,
    CASE WHEN p_error_code ~ '^-?[0-9]+$' THEN p_error_code::INT ELSE NULL END,
    v_log_message,
    NULL,
    -- [139-3] p_detail merged under the existing error-code object (the
    -- error object wins key conflicts via `||` right-side precedence).
    -- Both sides are COALESCEd because `jsonb || NULL` is NULL: without
    -- that, a p_detail supplied on an error-free settle (the platform
    -- session-id case) would be lost. When p_detail IS NULL and there are
    -- no error codes the CASE keeps detail NULL, exactly as before.
    CASE
      WHEN p_detail IS NULL AND p_error_code IS NULL AND p_error_subcode IS NULL
        THEN NULL
      ELSE COALESCE(p_detail, '{}'::jsonb)
           || COALESCE(
                jsonb_strip_nulls(jsonb_build_object('errorCode', p_error_code, 'errorSubcode', p_error_subcode)),
                '{}'::jsonb
              )
    END,
    now()
  );

  -- Destination side effects. Target statuses are the new vocabulary;
  -- legacy Facebook names are translated explicitly so a transitional
  -- caller cannot write a value the new CHECK constraint would reject.
  v_destination_status := CASE p_target_destination_status
    WHEN 'fb_rate_limited' THEN 'rate_limited'
    WHEN 'invalid_token' THEN 'error'
    WHEN 'page_checkpoint' THEN 'error'
    WHEN 'paused' THEN 'disconnected'
    ELSE p_target_destination_status
  END;

  UPDATE public.destinations
  SET status = CASE
        WHEN v_destination_status IN ('active', 'rate_limited', 'disconnected', 'error')
          THEN v_destination_status::VARCHAR(30)
        ELSE status
      END,
      next_allowed_publish_at = CASE
        WHEN p_destination_cooldown_seconds IS NOT NULL AND p_destination_cooldown_seconds > 0
          -- [139-2] Monotonic: extend-only, never shorten a live cooldown.
          THEN GREATEST(next_allowed_publish_at, now() + make_interval(secs => p_destination_cooldown_seconds))
        ELSE next_allowed_publish_at
      END,
      rate_usage_pct = COALESCE(p_rate_usage_pct, rate_usage_pct),
      updated_at = now()
  WHERE id = p_destination_id
    AND workspace_id = p_workspace_id
  RETURNING account_id INTO v_account_id;

  IF p_target_account_status = 'expired' AND v_account_id IS NOT NULL THEN
    UPDATE public.social_accounts
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_account_id
      AND workspace_id = p_workspace_id;
  END IF;

  RETURN 'settled';
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. ACLs: re-assert the exact pre-existing posture on the unified
--    17-arg signature — service_role only.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT, JSONB) TO service_role;
