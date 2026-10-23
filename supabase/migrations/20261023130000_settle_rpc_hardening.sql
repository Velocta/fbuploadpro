-- =============================================================================
-- Migration: 20261023130000_settle_rpc_hardening.sql
-- Spec: 139 Production-Grade — settle RPC hardening (unified overload only;
-- the legacy 16-arg overload with INT error codes is untouched).
--
-- Target: public.settle_queue_item_outcome — the UNIFIED overload created in
-- 20261022120000_unified_schema_migration.sql §6b, exact current signature
-- (catalog-verified by the spec 139 DB audit):
--   (UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT,
--    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT) RETURNS VOID
--
-- Fixes (body is the §6b body verbatim except for the three changes marked
-- [139-1] / [139-2] / [139-3] inline):
--
--   1. [HIGH] Settle was unconditional: the queue_items UPDATEs matched on
--      id + workspace_id only, so a late or duplicate settle (queue retry,
--      redelivered message, DLQ race) regressed an already-terminal item
--      (e.g. published -> failed) and inserted a SECOND publish_logs row for
--      the same attempt. Every outcome branch now also requires
--      status = 'publishing' [139-1]; when the UPDATE matches 0 rows the
--      function returns immediately — no publish_logs row, no destination
--      side effects, no account cascade.
--
--      Return contract: the function previously returned VOID and every
--      caller ignores the value (worker consumers.ts callSettleRpc and the
--      load-harness pg-adapter both discard `data` and act only on
--      `error`). It now returns TEXT — 'settled' when the settle applied,
--      'already_settled' for the no-op — a distinct result a caller may
--      inspect or safely ignore; no existing caller breaks.
--
--   2. [MEDIUM] Destination cooldown overwrite: next_allowed_publish_at was
--      overwritten unconditionally, so a short success cooldown (e.g. 300s)
--      could erase a live long rate-limit cooldown (e.g. 259200s). The new
--      value is now GREATEST(existing, now() + cooldown) [139-2] — a settle
--      can extend a cooldown, never shorten one. (PostgreSQL GREATEST
--      ignores NULL arguments, so a NULL existing value still takes the new
--      cooldown.)
--
--   3. [FEATURE-PREREQ, owed to specs 124–126] p_detail carrier: platform
--      session ids produced by a publish attempt need a carrier into
--      publish_logs.detail. A trailing p_detail JSONB DEFAULT NULL
--      parameter is added [139-3] and merged into the log row's detail:
--      the error-code object keeps precedence on key conflicts, and the
--      pre-existing behaviour is preserved exactly when p_detail is NULL
--      (detail = the error-code object, or NULL when there are no error
--      codes).
--
--      Because CREATE OR REPLACE with an extra parameter would create a
--      SECOND overload (making PostgREST named-argument calls from the
--      worker ambiguous), the old 16-arg function is DROPPED first and
--      recreated as the single 17-arg function. Existing callers that pass
--      the original 16 named arguments still resolve, thanks to the
--      trailing DEFAULT NULL.
--
-- ACLs are preserved exactly (spec 117/120 pattern, re-asserted below):
-- REVOKE EXECUTE from PUBLIC / anon / authenticated, GRANT EXECUTE to
-- service_role only. search_path stays pinned (SET search_path = public).
-- No data changes. No other object is modified.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop the exact current unified 16-arg signature (see header: a
--    CREATE OR REPLACE here would leave two overloads and break PostgREST
--    named-argument resolution).
-- -----------------------------------------------------------------------------
DROP FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT);

-- -----------------------------------------------------------------------------
-- 2. Recreate: §6b body verbatim + [139-1] status guard + distinct return,
--    [139-2] monotonic cooldown, [139-3] trailing p_detail JSONB DEFAULT NULL.
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.settle_queue_item_outcome(
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
-- 3. ACLs: re-assert the exact pre-existing posture on the new 17-arg
--    signature — service_role only.
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT, JSONB) TO service_role;
