-- =============================================================================
-- Migration: 20261022140000_claim_rpc_grouped_usage.sql
-- Spec: 138 Claim RPC Performance — grouped-usage rewrite of the D5
-- deferral/headroom computation inside claim_due_queue_items.
-- Purpose:
--   Replace the spec 121 claim RPC body with an identical-semantics body
--   whose per-destination usage values are computed ONCE per claim call
--   with grouped aggregation, instead of correlated subqueries evaluated
--   per (due destination x cap rule) in both the deferral pass (b) and
--   the headroom pass (c).
--
-- Defect evidence (spec 122 full-scale certification blocker report,
-- 2026-10-22): at certification scale, instagram claim calls measured
-- 54.5 s (pass (b) alone 32.4 s). Inside pass (b), each of the four usage
-- values (log_count, inflight_count, oldest_log_at, oldest_inflight_at)
-- was a correlated subquery per (due destination x cap rule); the killer
-- was oldest_inflight_at — an index scan on
-- idx_queue_items_status_scheduled_time at 5.34 ms x 6,000 loops
-- (3,000 due destinations x 2 rules) = ~32 s for instagram alone, and the
-- cost grows with in-flight rows and dead index entries. A composite
-- (destination_id, status, claimed_at) index was tested and did NOT fix
-- the old shape; the query shape is the problem, not the index set, so
-- this migration adds no index — the grouped passes below are served by
-- the existing destination-leading indexes
-- idx_queue_items_destination_id_status (spec 120) and
-- idx_publish_logs_destination_result_created (spec 121).
--
-- Grouped design (spec 138 Design): after pass (a) — carried over
-- byte-for-byte — the function materialises one per-call usage snapshot
-- into the transaction-local temp table pg_temp.claim138_rule_usage
-- (drop-guarded, ON COMMIT DROP): one row per (due destination x
-- applicable rule), built from the verbatim due_destinations CTE, the
-- rules CTE with the spec 121 LEFT JOIN LATERAL metadata-override
-- subquery verbatim, ONE grouped pass over publish_logs (join on the
-- per-rule window + metric predicates, GROUP BY destination x rule), and
-- ONE grouped pass over in-flight queue_items (GROUP BY destination, no
-- window filter — in-flight rows count into every rule however old).
-- Passes (b) and (c) then read the snapshot with every formula verbatim.
-- Materialising once is exact, not an approximation: pass (b) only
-- reschedules 'queued' rows — it never inserts into publish_logs and
-- never changes the 'publishing' set — so the values pass (c) needs are
-- the values pass (b) computed, over a subset of the same due set.
--
-- Parity statement: semantics are unchanged — see the spec 138 parity
-- contract (spec.md §1–§8). Same signature, defaults, return shape,
-- ACLs, deferral/release_at/headroom formulas, lane filtering, and
-- rate_limited auto-recovery. No other function, table schema, config
-- row, or cap value is modified. Nothing else is changed.
--
-- This migration also sets the queue_items autovacuum storage parameters
-- (separate statement, section 3 below) per the churn evidence in the
-- blocker report.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. claim_due_queue_items(platform, TEXT[], INT, INT) — grouped-usage
--    body. Same signature and return shape as the spec 120/121
--    definitions; CREATE OR REPLACE keeps the existing ACLs, which are
--    re-asserted below to match the spec 121 pattern exactly.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_due_queue_items(
  p_platform public.platform,
  p_lane_kind_set TEXT[],
  p_limit INT DEFAULT 500,
  p_max_per_destination INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  workspace_id UUID,
  destination_id UUID,
  account_id UUID,
  media_item_id UUID,
  kind TEXT,
  platform_format TEXT,
  link_url TEXT,
  caption TEXT,
  title TEXT,
  first_comment TEXT,
  platform_options JSONB,
  scheduled_time TIMESTAMPTZ,
  status VARCHAR,
  claimed_at TIMESTAMPTZ,
  retry_count INT,
  max_retries INT,
  external_post_id VARCHAR,
  external_comment_id VARCHAR,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  external_destination_id VARCHAR,
  encrypted_access_token TEXT,
  encrypted_destination_token TEXT,
  destination_name VARCHAR,
  media_type VARCHAR,
  media_url TEXT,
  media_storage_key VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(1, COALESCE(p_limit, 500)), 1000);
BEGIN
  -- (a) rate_limited auto-recovery: destinations evaluated by this call
  -- (due queued item for this platform) whose cooldown has expired return
  -- to 'active' with the cooldown cleared, in this same transaction.
  -- (Carried over byte-for-byte from the spec 121 definition.)
  UPDATE public.destinations d
  SET status = 'active',
      next_allowed_publish_at = NULL,
      updated_at = now()
  WHERE d.status = 'rate_limited'
    AND d.platform = p_platform
    AND d.next_allowed_publish_at IS NOT NULL
    AND d.next_allowed_publish_at <= now()
    AND EXISTS (
      SELECT 1
      FROM public.queue_items qi
      WHERE qi.destination_id = d.id
        AND qi.status = 'queued'
        AND qi.scheduled_time <= now()
        AND qi.platform = p_platform
    );

  -- (snapshot) Per-call D5 usage snapshot: one row per (due destination
  -- x applicable rule), computed ONCE here and read by both pass (b) and
  -- pass (c) below. The drop-guard makes repeated calls inside one
  -- transaction safe; ON COMMIT DROP leaves nothing behind. Referenced
  -- as pg_temp.… because the function sets search_path = public.
  DROP TABLE IF EXISTS pg_temp.claim138_rule_usage;
  CREATE TEMP TABLE pg_temp.claim138_rule_usage ON COMMIT DROP AS
  WITH due_destinations AS (
    SELECT DISTINCT qi.destination_id
    FROM public.queue_items qi
    INNER JOIN public.destinations d
      ON d.id = qi.destination_id
    INNER JOIN public.social_accounts sa
      ON sa.id = d.account_id
    LEFT JOIN public.media_items mi
      ON mi.id = qi.media_item_id
    WHERE qi.status = 'queued'
      AND qi.scheduled_time <= now()
      AND qi.platform = p_platform
      AND (p_lane_kind_set IS NULL OR cardinality(p_lane_kind_set) = 0 OR qi.kind = ANY (p_lane_kind_set))
      AND sa.status = 'active'
      AND (
        d.status = 'active'
        OR (d.status = 'rate_limited' AND d.next_allowed_publish_at IS NOT NULL AND d.next_allowed_publish_at <= now())
      )
      AND (d.next_allowed_publish_at IS NULL OR d.next_allowed_publish_at <= now())
      AND (
        qi.kind = 'text'
        OR qi.media_url IS NOT NULL
        OR (qi.media_item_id IS NOT NULL AND mi.id IS NOT NULL)
      )
  ),
  rules AS (
    SELECT
      dd.destination_id,
      lr.metric,
      lr.window_seconds,
      COALESCE(ov.override_cap, lr.cap) AS cap
    FROM due_destinations dd
    INNER JOIN public.destinations d
      ON d.id = dd.destination_id
    INNER JOIN public.destination_claim_limits lr
      ON lr.platform = p_platform
    LEFT JOIN LATERAL (
      SELECT (elem ->> 'cap')::INT AS override_cap
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(d.metadata -> 'claim_limits') = 'array'
             THEN d.metadata -> 'claim_limits'
             ELSE '[]'::jsonb
        END
      ) AS elem
      WHERE elem ->> 'metric' = lr.metric
        AND (elem ->> 'window_seconds') ~ '^[0-9]+$'
        AND (elem ->> 'window_seconds')::INT = lr.window_seconds
        AND (elem ->> 'cap') ~ '^[0-9]+$'
        AND (elem ->> 'cap')::INT > 0
      LIMIT 1
    ) ov ON TRUE
  ),
  log_usage AS (
    -- ONE grouped pass over publish_logs. The counted set is defined per
    -- rule — the window length and the metric filter are properties of
    -- the rule row — so both are per-row join predicates and the grouped
    -- result is the counted set by definition: 'calls' counts ALL
    -- publish_logs rows in the window, 'published' only result =
    -- 'success' rows.
    SELECT
      r.destination_id,
      r.metric,
      r.window_seconds,
      COUNT(*) AS log_count,
      MIN(pl.created_at) AS oldest_log_at
    FROM rules r
    INNER JOIN public.publish_logs pl
      ON pl.destination_id = r.destination_id
     AND pl.created_at > now() - make_interval(secs => r.window_seconds)
     AND (r.metric = 'calls' OR pl.result = 'success')
    GROUP BY r.destination_id, r.metric, r.window_seconds
  ),
  inflight_usage AS (
    -- ONE grouped pass over in-flight queue_items, grouped by
    -- destination only (the values are rule-independent: in-flight rows
    -- count into EVERY rule's total, with NO window filter — an
    -- in-flight item counts however old its claim is).
    SELECT
      q.destination_id,
      COUNT(*) AS inflight_count,
      MIN(COALESCE(q.claimed_at, q.updated_at)) AS oldest_inflight_at
    FROM public.queue_items q
    INNER JOIN due_destinations dd ON dd.destination_id = q.destination_id
    WHERE q.status = 'publishing'
    GROUP BY q.destination_id
  )
  SELECT
    r.destination_id,
    r.metric,
    r.window_seconds,
    r.cap,
    COALESCE(lu.log_count, 0) AS log_count,
    COALESCE(iu.inflight_count, 0) AS inflight_count,
    lu.oldest_log_at,
    iu.oldest_inflight_at
  FROM rules r
  LEFT JOIN log_usage lu
    ON lu.destination_id = r.destination_id
   AND lu.metric = r.metric
   AND lu.window_seconds = r.window_seconds
  LEFT JOIN inflight_usage iu
    ON iu.destination_id = r.destination_id;

  -- (b) D5 deferral: destinations at cap for any configured rule have
  -- their due queued items rescheduled to the window end — once per
  -- destination per call, before claim selection, inside this
  -- transaction. Usage values are read from the snapshot; every formula
  -- below is the spec 121 formula verbatim.
  WITH binding AS (
    SELECT
      ru.destination_id,
      GREATEST(
        COALESCE(
          LEAST(ru.oldest_log_at, ru.oldest_inflight_at),
          ru.oldest_log_at,
          ru.oldest_inflight_at,
          now()
        ) + make_interval(secs => ru.window_seconds),
        now() + INTERVAL '1 minute'
      ) AS release_at
    FROM pg_temp.claim138_rule_usage ru
    WHERE ru.log_count + ru.inflight_count >= ru.cap
  ),
  release AS (
    SELECT b.destination_id, MAX(b.release_at) AS release_at
    FROM binding b
    GROUP BY b.destination_id
  ),
  targets AS (
    SELECT qi.id, qi.destination_id
    FROM public.queue_items qi
    INNER JOIN release r
      ON r.destination_id = qi.destination_id
    WHERE qi.status = 'queued'
      AND qi.scheduled_time <= now()
      AND qi.platform = p_platform
      AND (p_lane_kind_set IS NULL OR cardinality(p_lane_kind_set) = 0 OR qi.kind = ANY (p_lane_kind_set))
    FOR UPDATE OF qi SKIP LOCKED
  )
  UPDATE public.queue_items qi
  SET scheduled_time = r.release_at,
      updated_at = now()
  FROM targets t
  INNER JOIN release r
    ON r.destination_id = t.destination_id
  WHERE qi.id = t.id;

  -- (c) Claim selection: the spec 120 ranked selection, unchanged except
  -- that the per-destination rank cap is additionally bounded by the
  -- destination's smallest remaining D5 headroom (no headroom row = no
  -- configured cap = unbounded), with counted_total read from the
  -- snapshot. At-cap destinations were deferred in step (b), so their
  -- items are no longer due here.
  RETURN QUERY
  WITH ranked_due AS (
    SELECT
      qi.id AS queue_id,
      qi.destination_id AS destination_id,
      ROW_NUMBER() OVER (
        PARTITION BY qi.destination_id
        ORDER BY qi.scheduled_time ASC, qi.id ASC
      ) AS destination_rank,
      qi.scheduled_time AS item_scheduled_time
    FROM public.queue_items qi
    INNER JOIN public.destinations d
      ON d.id = qi.destination_id
    INNER JOIN public.social_accounts sa
      ON sa.id = d.account_id
    LEFT JOIN public.media_items mi
      ON mi.id = qi.media_item_id
    WHERE qi.status = 'queued'
      AND qi.scheduled_time <= now()
      AND qi.platform = p_platform
      AND (p_lane_kind_set IS NULL OR cardinality(p_lane_kind_set) = 0 OR qi.kind = ANY (p_lane_kind_set))
      AND sa.status = 'active'
      AND (
        d.status = 'active'
        OR (d.status = 'rate_limited' AND d.next_allowed_publish_at IS NOT NULL AND d.next_allowed_publish_at <= now())
      )
      AND (d.next_allowed_publish_at IS NULL OR d.next_allowed_publish_at <= now())
      AND (
        qi.kind = 'text'
        OR qi.media_url IS NOT NULL
        OR (qi.media_item_id IS NOT NULL AND mi.id IS NOT NULL)
      )
  ),
  rule_usage AS (
    SELECT
      snap.destination_id,
      snap.cap,
      (snap.log_count + snap.inflight_count) AS counted_total
    FROM pg_temp.claim138_rule_usage snap
    WHERE snap.destination_id IN (SELECT DISTINCT rd0.destination_id FROM ranked_due rd0)
  ),
  headroom AS (
    SELECT
      ru.destination_id,
      MIN(ru.cap - ru.counted_total)::INT AS headroom
    FROM rule_usage ru
    GROUP BY ru.destination_id
  ),
  candidate_ids AS (
    SELECT q.id
    FROM public.queue_items q
    INNER JOIN ranked_due rd ON rd.queue_id = q.id
    LEFT JOIN headroom h ON h.destination_id = rd.destination_id
    WHERE rd.destination_rank <= LEAST(
            GREATEST(1, p_max_per_destination),
            COALESCE(h.headroom, GREATEST(1, p_max_per_destination))
          )
      AND q.status = 'queued'
    ORDER BY rd.item_scheduled_time ASC, q.id ASC
    LIMIT v_limit
    FOR UPDATE OF q SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.queue_items qi
    SET status = 'publishing',
        claimed_at = now(),
        updated_at = now()
    FROM candidate_ids c
    WHERE qi.id = c.id
    RETURNING qi.*
  )
  SELECT
    c.id,
    c.workspace_id,
    c.destination_id,
    d.account_id,
    c.media_item_id,
    c.kind::TEXT,
    c.platform_format::TEXT,
    c.link_url,
    c.caption,
    c.title,
    c.first_comment,
    c.platform_options,
    c.scheduled_time,
    c.status::VARCHAR,
    c.claimed_at,
    c.retry_count::INT,
    c.max_retries::INT,
    c.external_post_id::VARCHAR,
    c.external_comment_id::VARCHAR,
    c.created_at,
    c.updated_at,
    d.external_destination_id::VARCHAR,
    sa.encrypted_access_token,
    d.encrypted_destination_token,
    d.name::VARCHAR,
    mi.media_type::VARCHAR,
    COALESCE(c.media_url, mi.url) AS media_url,
    COALESCE(c.media_storage_key, mi.storage_key::VARCHAR) AS media_storage_key
  FROM claimed c
  INNER JOIN public.destinations d
    ON d.id = c.destination_id
  INNER JOIN public.social_accounts sa
    ON sa.id = d.account_id
  LEFT JOIN public.media_items mi
    ON mi.id = c.media_item_id
  ORDER BY c.scheduled_time ASC, c.id ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_due_queue_items(public.platform, TEXT[], INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_queue_items(public.platform, TEXT[], INT, INT) TO service_role;

-- -----------------------------------------------------------------------------
-- 2. queue_items autovacuum thresholds (churn evidence, spec 138)
-- -----------------------------------------------------------------------------
-- queue_items is the highest-churn table in the system (every claim /
-- settle / recovery writes it). At the default autovacuum_vacuum_scale_
-- factor of 0.2, a 1M-row queue_items accumulates ~200k dead tuples
-- before autovacuum fires; the spec 122 certification runs reached
-- n_dead_tup 38,399 with autovacuum_count = 0, and dead entries
-- measurably inflate every index scan on this table. At 0.02 the
-- trigger is ~20k dead tuples — the observed 38,399 would have fired
-- it. Storage-parameter change only: no data rewrite, no behaviour
-- change, reversible by RESET. It is not a substitute for the grouped
-- rewrite above.
ALTER TABLE public.queue_items SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);
