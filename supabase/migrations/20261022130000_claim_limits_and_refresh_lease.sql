-- =============================================================================
-- Migration: 20261022130000_claim_limits_and_refresh_lease.sql
-- Spec: 121 Worker Pipeline Core — PR-B (claim RPC limits + refresh lease)
-- Purpose:
--   1. Amend the unified claim RPC claim_due_queue_items(public.platform,
--      TEXT[], INT, INT) — same signature, worker call shape unchanged — to
--      enforce the D5 per-account (per-destination) posting limits at claim
--      time and to auto-recover expired `rate_limited` destinations.
--   2. Add the refresh-lease columns used by the D6 token-refresh job's
--      per-connection single-flight lease to public.social_accounts and
--      public.destinations.
--   3. Extend public.worker_heartbeats with the per-lane enqueued / DLQ
--      counters spec 121 Scope 7 requires (the spec 116 table only has
--      aggregate claimed/settled counters).
-- Nothing else is modified. No existing migration is edited.
--
-- -----------------------------------------------------------------------------
-- D5 limits mechanism (ONE clean mechanism — a small config table)
-- -----------------------------------------------------------------------------
-- Default caps live in public.destination_claim_limits, one row per
-- (platform, metric, window):
--   metric 'published' — successful publishes (publish_logs.result =
--     'success') counted over the rolling window.
--   metric 'calls'     — publish attempts (every publish_logs row, any
--     result) counted over the rolling window. Instagram's hourly cap is a
--     publish-call cap, not a success cap.
-- Seeded defaults (spec 121 Scope 8 / D5):
--   instagram: 100 published / rolling 24 h, 25 calls / rolling 1 h
--   threads:   250 published / rolling 24 h
--   x:         100 published / rolling 15 min
--   facebook / youtube / tiktok: no rows — no cap enforced by this RPC
--     (facebook keeps next_allowed_publish_at throttling; YouTube/TikTok
--     provider limits arrive with specs 125/126). Later specs add caps by
--     INSERTing rows in a new migration — the function signature and body
--     do not change, because the body reads caps generically from the
--     table and never hardcodes a platform name or a limit number.
--
-- Destination-level live override (spec 121 Scope 8): a destination may
-- override the cap of any seeded rule via destinations.metadata:
--   metadata = { "claim_limits": [
--     { "metric": "published", "window_seconds": 86400, "cap": 42 } ] }
-- An array element whose metric AND window_seconds match a seeded rule
-- replaces that rule's cap for that destination only. (Spec 124's live
-- per-account Instagram quota read writes exactly this shape.)
--
-- Counting (precise): for a destination + rule, the counted total is
--   (publish_logs rows for the destination inside the rolling window —
--    result = 'success' only for metric 'published', all results for
--    metric 'calls')
--   + (queue_items currently in status 'publishing' for the destination —
--    in-flight attempts are not yet in publish_logs, and counting them
--    stops a burst of concurrent claims from overshooting the cap).
-- A destination is AT CAP when the counted total >= cap for ANY of its
-- rules. A destination under cap claims at most
--   min(p_max_per_destination, smallest remaining headroom across rules)
-- items in one call, so a claim can never push it over a cap.
--
-- Deferral semantics: at-cap destinations are NOT claimed and NOT failed.
-- Their still-'queued', already-due items for this platform/lane are
-- rescheduled in ONE update per destination per claim call to the window
-- end — the oldest counted event's timestamp + the window length, taking
-- the latest such time across all binding rules, floored at now() + 1
-- minute so a deferred item is never immediately re-claimable inside the
-- same call. When the window opens the items are ordinary due items
-- again. Deferral runs before the claim selection inside the same
-- transaction and the claim's FOR UPDATE SKIP LOCKED selection is
-- unchanged, so claim atomicity is preserved.
--
-- rate_limited auto-recovery: a destination with status 'rate_limited'
-- whose next_allowed_publish_at has passed is restored to status 'active'
-- with next_allowed_publish_at cleared, inside the claim transaction,
-- when it is evaluated by this call (it has a due queued item for this
-- platform). Downstream state is therefore truthful instead of relying on
-- every reader re-checking the cooldown timestamp.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. D5 config table + seed defaults
-- -----------------------------------------------------------------------------
CREATE TABLE public.destination_claim_limits (
  platform public.platform NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('published', 'calls')),
  cap INT NOT NULL CHECK (cap > 0),
  window_seconds INT NOT NULL CHECK (window_seconds > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_destination_claim_limits PRIMARY KEY (platform, metric, window_seconds)
);

-- Global (non-tenant) config: RLS on with no policies denies anon and
-- authenticated outright; service_role bypasses RLS, matching the
-- service-role-only posture of the claim RPC itself.
ALTER TABLE public.destination_claim_limits ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_destination_claim_limits_updated_at ON public.destination_claim_limits;
CREATE TRIGGER trg_destination_claim_limits_updated_at
  BEFORE UPDATE ON public.destination_claim_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.destination_claim_limits IS
  'Spec 121 D5: per-destination posting caps enforced by claim_due_queue_items. One row per (platform, metric, window). metric published = successful publishes in publish_logs; calls = all publish attempts in publish_logs. Later specs add caps by inserting rows; no RPC change needed.';
COMMENT ON COLUMN public.destination_claim_limits.metric IS
  'published: count publish_logs rows with result = success. calls: count all publish_logs rows (publish attempts). In-flight queue_items in status publishing are added to both counts by the claim RPC.';

INSERT INTO public.destination_claim_limits (platform, metric, cap, window_seconds) VALUES
  ('instagram', 'published', 100, 86400),
  ('instagram', 'calls',      25,  3600),
  ('threads',   'published', 250, 86400),
  ('x',         'published', 100,   900);

-- Window counting scans publish_logs per destination; the unified
-- migration only indexed destination_id alone.
CREATE INDEX idx_publish_logs_destination_result_created
  ON public.publish_logs (destination_id, result, created_at);

-- -----------------------------------------------------------------------------
-- 2. Refresh-lease columns (D6 single-flight lease, spec 121 Scope 9)
-- -----------------------------------------------------------------------------
-- Conditional-update lease protocol (the refresh job is the only user):
--   acquire: UPDATE ... SET refresh_lease_owner = '<run id>',
--              refresh_lease_expires_at = now() + '<lease ttl>'
--            WHERE id = '<row id>'
--              AND (refresh_lease_owner IS NULL
--                   OR refresh_lease_expires_at < now())
--            — exactly one concurrent run affects a row and wins.
--   renew/release: same UPDATE, additionally guarded by
--              refresh_lease_owner = '<run id>' (owner match), so a run
--              can only extend or clear its own lease.
-- X/IG/Threads tokens live on social_accounts; Facebook page tokens (and
-- any destination-scoped token) live on destinations
-- (destinations.encrypted_destination_token), and the refresh job scans
-- both tables — so both get the lease pair. Additive only, no backfill:
-- NULL owner = unleased.
ALTER TABLE public.social_accounts
  ADD COLUMN refresh_lease_owner TEXT NULL,
  ADD COLUMN refresh_lease_expires_at TIMESTAMPTZ NULL;

ALTER TABLE public.destinations
  ADD COLUMN refresh_lease_owner TEXT NULL,
  ADD COLUMN refresh_lease_expires_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.social_accounts.refresh_lease_owner IS
  'D6 token-refresh lease (spec 121 Scope 9): id of the refresh-job run holding the per-connection single-flight lease, NULL when unleased. Acquire via conditional UPDATE ... WHERE refresh_lease_owner IS NULL OR refresh_lease_expires_at < now(); renew/release only with a matching owner.';
COMMENT ON COLUMN public.social_accounts.refresh_lease_expires_at IS
  'D6 token-refresh lease expiry (spec 121 Scope 9): a lease whose expiry has passed may be taken over by another refresh run via the conditional-update protocol on refresh_lease_owner.';
COMMENT ON COLUMN public.destinations.refresh_lease_owner IS
  'D6 token-refresh lease (spec 121 Scope 9): id of the refresh-job run holding the per-connection single-flight lease for this destination''s token, NULL when unleased. Same conditional-update protocol as social_accounts.refresh_lease_owner.';
COMMENT ON COLUMN public.destinations.refresh_lease_expires_at IS
  'D6 token-refresh lease expiry (spec 121 Scope 9): a lease whose expiry has passed may be taken over by another refresh run via the conditional-update protocol on refresh_lease_owner.';

-- -----------------------------------------------------------------------------
-- 3. claim_due_queue_items(platform, TEXT[], INT, INT) — D5 caps, deferral,
--    rate_limited auto-recovery. Same signature and return shape as the
--    spec 120 definition; CREATE OR REPLACE keeps the existing ACLs, which
--    are re-asserted below to match the spec 120 pattern exactly.
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

  -- (b) D5 deferral: destinations at cap for any configured rule have
  -- their due queued items rescheduled to the window end — once per
  -- destination per call, before claim selection, inside this transaction.
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
  rule_usage AS (
    SELECT
      dd.destination_id,
      lr.metric,
      lr.window_seconds,
      COALESCE(ov.override_cap, lr.cap) AS cap,
      CASE WHEN lr.metric = 'published'
        THEN (SELECT COUNT(*) FROM public.publish_logs pl
              WHERE pl.destination_id = dd.destination_id
                AND pl.result = 'success'
                AND pl.created_at > now() - make_interval(secs => lr.window_seconds))
        ELSE (SELECT COUNT(*) FROM public.publish_logs pl
              WHERE pl.destination_id = dd.destination_id
                AND pl.created_at > now() - make_interval(secs => lr.window_seconds))
      END AS log_count,
      (SELECT COUNT(*) FROM public.queue_items q
       WHERE q.destination_id = dd.destination_id
         AND q.status = 'publishing') AS inflight_count,
      CASE WHEN lr.metric = 'published'
        THEN (SELECT MIN(pl.created_at) FROM public.publish_logs pl
              WHERE pl.destination_id = dd.destination_id
                AND pl.result = 'success'
                AND pl.created_at > now() - make_interval(secs => lr.window_seconds))
        ELSE (SELECT MIN(pl.created_at) FROM public.publish_logs pl
              WHERE pl.destination_id = dd.destination_id
                AND pl.created_at > now() - make_interval(secs => lr.window_seconds))
      END AS oldest_log_at,
      (SELECT MIN(COALESCE(q.claimed_at, q.updated_at)) FROM public.queue_items q
       WHERE q.destination_id = dd.destination_id
         AND q.status = 'publishing') AS oldest_inflight_at
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
  binding AS (
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
    FROM rule_usage ru
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
  -- configured cap = unbounded). At-cap destinations were deferred in
  -- step (b), so their items are no longer due here.
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
      dd.destination_id,
      COALESCE(ov.override_cap, lr.cap) AS cap,
      CASE WHEN lr.metric = 'published'
        THEN (SELECT COUNT(*) FROM public.publish_logs pl
              WHERE pl.destination_id = dd.destination_id
                AND pl.result = 'success'
                AND pl.created_at > now() - make_interval(secs => lr.window_seconds))
        ELSE (SELECT COUNT(*) FROM public.publish_logs pl
              WHERE pl.destination_id = dd.destination_id
                AND pl.created_at > now() - make_interval(secs => lr.window_seconds))
      END
      + (SELECT COUNT(*) FROM public.queue_items q
         WHERE q.destination_id = dd.destination_id
           AND q.status = 'publishing') AS counted_total
    FROM (SELECT DISTINCT rd0.destination_id FROM ranked_due rd0) dd
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
-- 4. worker_heartbeats per-lane counters (spec 121 Scope 7)
-- -----------------------------------------------------------------------------
-- The claimer/consumer heartbeat upsert (worker PR) writes per-lane
-- enqueued counts and per-lane DLQ-arrival counts each tick, alongside the
-- existing aggregate claimed/settled counters from spec 116. Additive
-- only, same shape as the existing counters (NOT NULL, DEFAULT 0,
-- CHECK >= 0), so existing rows and writers are unaffected.
ALTER TABLE public.worker_heartbeats
  ADD COLUMN last_enqueued_fast INT NOT NULL DEFAULT 0 CHECK (last_enqueued_fast >= 0),
  ADD COLUMN last_enqueued_heavy INT NOT NULL DEFAULT 0 CHECK (last_enqueued_heavy >= 0),
  ADD COLUMN last_dlq_fast INT NOT NULL DEFAULT 0 CHECK (last_dlq_fast >= 0),
  ADD COLUMN last_dlq_heavy INT NOT NULL DEFAULT 0 CHECK (last_dlq_heavy >= 0);

COMMENT ON COLUMN public.worker_heartbeats.last_enqueued_fast IS
  'Spec 121 Scope 7: items enqueued to the publish-fast lane on the last tick.';
COMMENT ON COLUMN public.worker_heartbeats.last_enqueued_heavy IS
  'Spec 121 Scope 7: items enqueued to the publish-heavy lane on the last tick.';
COMMENT ON COLUMN public.worker_heartbeats.last_dlq_fast IS
  'Spec 121 Scope 7: publish-fast DLQ arrivals observed on the last tick.';
COMMENT ON COLUMN public.worker_heartbeats.last_dlq_heavy IS
  'Spec 121 Scope 7: publish-heavy DLQ arrivals observed on the last tick.';
