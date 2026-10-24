-- =============================================================================
-- Migration: 20261024120000_a15_atomic_queue_slot_insert.sql
-- Spec: 139 production-grade — A15 follow-up (queue-slot collision)
-- Purpose:
--   The queue-mode enqueue path (POST /publishing/queue with no explicit
--   scheduledTime — the composer's "Queue" intent) computes the next
--   vacant slot in the web handler from a snapshot of the page's queued
--   items, then inserts. legacy_queue_items has NO unique constraint over
--   (user_id, fb_page_id, scheduled_time) — only (user_id, id) — so two
--   concurrent chains that snapshot the same queue state pick the SAME
--   slot instance and both inserts commit: two 'queued' posts share one
--   destination slot/time (proven by the queue-slot-collision rig in
--   apps/worker/tests/queue-slot-collision/, which also proves the
--   collision is silent — no error surfaces anywhere).
--
--   A unique index is NOT the fix here: the queue reorder flow
--   (spec 134) permutes scheduled_time values among existing queued
--   items via parallel single-row PATCHes, and any immediate uniqueness
--   over the time dimension rejects the first PATCH of every rotation.
--   Instead, the computed enqueue path claims its slot through this RPC:
--
--     1. pg_advisory_xact_lock keyed on (user_id, fb_page_id) serializes
--        claimants for the same page. A racing claimant blocks until the
--        winner's transaction commits, then re-checks against the fresh
--        committed state (each statement in the function sees the latest
--        committed rows under READ COMMITTED).
--     2. If a 'queued' row already holds the candidate scheduled_time,
--        the function returns NO row — the caller recomputes the next
--        vacant slot from a fresh snapshot and retries (bounded).
--     3. Otherwise the row is inserted inside the same transaction and
--        returned, identical in shape and values to the direct insert
--        the handler performed before.
--
--   Explicit-time enqueues (scheduledTime provided) do NOT use this RPC
--   and are unchanged, as are reorder PATCHes and every other writer.
--   This is also the seed of the recorded batch-RPC follow-up: a future
--   batch enqueue can claim N slots inside one call on the same lock.
--
-- Access mirrors the spec 117 RPC hardening posture: SECURITY DEFINER,
-- EXECUTE revoked from PUBLIC/anon/authenticated, granted to
-- service_role only (the web route calls it through the admin client
-- and scopes every parameter to the session user).
-- Idempotent: CREATE OR REPLACE FUNCTION; REVOKE/GRANT are repeatable.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_queue_slot_insert(
  p_user_id UUID,
  p_fb_page_id UUID,
  p_slot_id UUID,
  p_media_id UUID,
  p_post_format TEXT,
  p_link_url TEXT,
  p_scheduled_time TIMESTAMPTZ,
  p_caption TEXT,
  p_first_comment TEXT
)
RETURNS SETOF public.legacy_queue_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialize slot claimants per (user, page) for the duration of this
  -- transaction. Released automatically at commit/rollback.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_fb_page_id::text, 0)
  );

  -- Occupied check against the freshest committed state: a 'queued' row
  -- already holding this exact slot instance means a racing chain won.
  -- Return no row so the caller recomputes and retries.
  IF EXISTS (
    SELECT 1
    FROM public.legacy_queue_items
    WHERE user_id = p_user_id
      AND fb_page_id = p_fb_page_id
      AND status = 'queued'
      AND scheduled_time = p_scheduled_time
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  INSERT INTO public.legacy_queue_items (
    user_id,
    fb_page_id,
    slot_id,
    media_id,
    post_format,
    link_url,
    scheduled_time,
    caption,
    first_comment,
    status,
    retry_count,
    max_retries
  ) VALUES (
    p_user_id,
    p_fb_page_id,
    p_slot_id,
    p_media_id,
    p_post_format::public.facebook_post_format,
    p_link_url,
    p_scheduled_time,
    p_caption,
    p_first_comment,
    'queued',
    0,
    3
  )
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_queue_slot_insert(UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queue_slot_insert(UUID, UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO service_role;
