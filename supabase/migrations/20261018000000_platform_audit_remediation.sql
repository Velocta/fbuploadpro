-- =============================================================================
-- Migration: 20261018000000_platform_audit_remediation.sql
-- Spec: 045 Platform Audit Remediation
-- Purpose:
--   1. Comprehensive schema hardening for multi-format publishing
--   2. Strict invariants for text posts (nullable media_id) and stories (no comments)
--   3. Format-aware recurring publishing slots (allowed_formats)
--   4. Page-level rate-limit pacing (next_allowed_publish_at, buc_usage_pct)
--   5. Media dimensions (width, height) & cursor pagination indexes
--   6. Decoupled stuck-publishing recovery RPC (recover_stuck_publishing_items)
--   7. Fair per-page partitioned claim RPC (claim_due_queue_items)
--   8. Single-roundtrip atomic settlement RPC with parent account cascade (settle_queue_item_outcome)
--   9. Server-side queue status counter RPC (get_page_queue_status_counts) with skipped/cancelled
-- =============================================================================

-- 1. Ensure facebook_post_format enum exists
DO $$ BEGIN
  CREATE TYPE public.facebook_post_format AS ENUM ('text', 'image', 'reel', 'video', 'story');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Ensure queue_items table columns and constraints
ALTER TABLE public.queue_items
  ALTER COLUMN media_id DROP NOT NULL;

ALTER TABLE public.queue_items
  ADD COLUMN IF NOT EXISTS post_format public.facebook_post_format NOT NULL DEFAULT 'reel',
  ADD COLUMN IF NOT EXISTS link_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS next_comment_retry_at TIMESTAMPTZ NULL;

-- Invariant constraints on queue_items
ALTER TABLE public.queue_items
  DROP CONSTRAINT IF EXISTS chk_queue_items_format_media;

ALTER TABLE public.queue_items
  ADD CONSTRAINT chk_queue_items_format_media CHECK (
    (post_format = 'text' AND length(btrim(caption)) > 0)
    OR (post_format IN ('image', 'reel', 'video', 'story') AND media_id IS NOT NULL)
  );

ALTER TABLE public.queue_items
  DROP CONSTRAINT IF EXISTS chk_queue_items_story_no_comment;

ALTER TABLE public.queue_items
  ADD CONSTRAINT chk_queue_items_story_no_comment CHECK (
    post_format <> 'story' OR first_comment IS NULL OR length(btrim(first_comment)) = 0
  );

-- 3. Extend page_queue_slots with allowed_formats
ALTER TABLE public.page_queue_slots
  ADD COLUMN IF NOT EXISTS allowed_formats TEXT[] NOT NULL DEFAULT ARRAY['text', 'image', 'reel', 'video', 'story'];

-- 4. Extend facebook_pages with rate-limit pacing & BUC telemetry columns
ALTER TABLE public.facebook_pages
  ADD COLUMN IF NOT EXISTS next_allowed_publish_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS buc_usage_pct SMALLINT NOT NULL DEFAULT 0 CHECK (buc_usage_pct BETWEEN 0 AND 100);

-- 5. Extend media_items with pixel dimensions & high-scale indexes
ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS width INT NULL CHECK (width IS NULL OR width > 0),
  ADD COLUMN IF NOT EXISTS height INT NULL CHECK (height IS NULL OR height > 0);

CREATE INDEX IF NOT EXISTS idx_media_items_user_folder_created_id
  ON public.media_items (user_id, folder_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_media_items_duplicate_lookup
  ON public.media_items (
    user_id,
    COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
    LOWER(name),
    file_size
  );

-- Partial indexes for queue claiming & stuck item recovery
CREATE INDEX IF NOT EXISTS idx_queue_items_claim_partitioned
  ON public.queue_items (fb_page_id, scheduled_time ASC, id ASC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_queue_items_stuck_publishing
  ON public.queue_items (updated_at ASC)
  WHERE status = 'publishing';

-- 6. Dedicated stuck-publishing recovery RPC
CREATE OR REPLACE FUNCTION public.recover_stuck_publishing_items(
  p_timeout_minutes INT DEFAULT 10
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovered_count INT;
BEGIN
  WITH recovered AS (
    UPDATE public.queue_items
    SET status = 'queued',
        updated_at = now()
    WHERE status = 'publishing'
      AND updated_at <= now() - make_interval(mins => GREATEST(1, p_timeout_minutes))
    RETURNING id
  )
  SELECT count(*)::INT INTO v_recovered_count FROM recovered;

  RETURN COALESCE(v_recovered_count, 0);
END;
$$;

-- 7. Upgraded fair per-page partitioned claim_due_queue_items RPC
DROP FUNCTION IF EXISTS public.claim_due_queue_items(INT);
DROP FUNCTION IF EXISTS public.claim_due_queue_items(INT, INT);

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
  -- Auto-recover pages whose 3-day (72h) fb_rate_limited cooldown has elapsed
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
    FROM public.queue_items qi
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
    FROM public.queue_items q
    INNER JOIN ranked_due rd ON rd.queue_id = q.id
    WHERE rd.page_rank <= GREATEST(1, p_max_per_page)
      AND q.status = 'queued'
    ORDER BY rd.item_scheduled_time ASC, q.id ASC
    LIMIT GREATEST(1, p_limit)
    FOR UPDATE OF q SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.queue_items qi
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
    fp.encrypted_access_token::TEXT,
    fp.encrypted_access_token::TEXT AS encrypted_page_token,
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

-- 8. Single-roundtrip atomic settlement RPC
CREATE OR REPLACE FUNCTION public.settle_queue_item_outcome(
  p_queue_item_id UUID,
  p_user_id UUID,
  p_fb_page_id UUID,
  p_outcome_status TEXT,            -- 'published' | 'queued' | 'failed'
  p_fb_post_id TEXT DEFAULT NULL,
  p_fb_comment_id TEXT DEFAULT NULL,
  p_retry_count INT DEFAULT 0,
  p_retry_delay_seconds INT DEFAULT 300,
  p_error_code INT DEFAULT NULL,
  p_error_subcode INT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_comment_warning TEXT DEFAULT NULL,
  p_target_page_status TEXT DEFAULT NULL,     -- 'invalid_token' | 'fb_rate_limited' | 'page_checkpoint'
  p_target_account_status TEXT DEFAULT NULL,  -- 'expired'
  p_page_cooldown_seconds INT DEFAULT NULL,
  p_buc_usage_pct SMALLINT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_facebook_account_id UUID;
  v_log_status VARCHAR(20);
  v_log_message TEXT;
BEGIN
  IF p_outcome_status = 'published' THEN
    UPDATE public.queue_items
    SET status = 'published',
        fb_post_id = p_fb_post_id,
        fb_comment_id = p_fb_comment_id,
        published_at = now(),
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'success';
    v_log_message := p_comment_warning;

  ELSIF p_outcome_status = 'queued' OR p_outcome_status = 'retry' THEN
    UPDATE public.queue_items
    SET status = 'queued',
        retry_count = p_retry_count,
        scheduled_time = now() + make_interval(secs => GREATEST(1, COALESCE(p_retry_delay_seconds, 300))),
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'retry';
    v_log_message := p_error_message;

  ELSE
    UPDATE public.queue_items
    SET status = 'failed',
        retry_count = p_retry_count,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'failure';
    v_log_message := p_error_message;
  END IF;

  INSERT INTO public.publish_logs (
    user_id,
    queue_item_id,
    fb_page_id,
    status,
    attempt_number,
    fb_response_code,
    fb_error_code,
    fb_error_subcode,
    error_message,
    error_details,
    created_at
  ) VALUES (
    p_user_id,
    p_queue_item_id,
    p_fb_page_id,
    v_log_status,
    COALESCE(p_retry_count, 0) + 1,
    p_error_code,
    p_error_code,
    p_error_subcode,
    v_log_message,
    CASE
      WHEN p_error_subcode IS NOT NULL THEN jsonb_build_object('errorCode', p_error_code, 'errorSubcode', p_error_subcode)
      WHEN p_error_code IS NOT NULL THEN jsonb_build_object('errorCode', p_error_code)
      ELSE NULL
    END,
    now()
  );

  -- Update page status, rate_limited_at, next_allowed_publish_at, and buc_usage_pct
  UPDATE public.facebook_pages
  SET status = CASE
        WHEN p_target_page_status IS NOT NULL THEN p_target_page_status::public.facebook_page_status
        ELSE status
      END,
      rate_limited_at = CASE
        WHEN p_target_page_status = 'fb_rate_limited' THEN now()
        WHEN p_target_page_status IS NOT NULL THEN NULL
        ELSE rate_limited_at
      END,
      next_allowed_publish_at = CASE
        WHEN p_page_cooldown_seconds IS NOT NULL AND p_page_cooldown_seconds > 0
          THEN now() + make_interval(secs => p_page_cooldown_seconds)
        ELSE next_allowed_publish_at
      END,
      buc_usage_pct = COALESCE(p_buc_usage_pct, buc_usage_pct),
      updated_at = now()
  WHERE id = p_fb_page_id
    AND user_id = p_user_id
  RETURNING facebook_account_id INTO v_facebook_account_id;

  -- Cascade parent Facebook account status to 'expired' when required (e.g. 190, 102, 10, 200-299)
  IF p_target_account_status = 'expired' AND v_facebook_account_id IS NOT NULL THEN
    UPDATE public.facebook_accounts
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_facebook_account_id
      AND user_id = p_user_id;
  END IF;
END;
$$;

-- 9. Server-side queue status counter RPC (supporting skipped & cancelled)
CREATE OR REPLACE FUNCTION public.get_page_queue_status_counts(
  p_page_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  queued_count BIGINT,
  publishing_count BIGINT,
  published_count BIGINT,
  failed_count BIGINT,
  skipped_count BIGINT,
  cancelled_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE status = 'queued') AS queued_count,
    COUNT(*) FILTER (WHERE status = 'publishing') AS publishing_count,
    COUNT(*) FILTER (WHERE status = 'published') AS published_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
    COUNT(*) FILTER (WHERE status = 'skipped') AS skipped_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count
  FROM public.queue_items
  WHERE fb_page_id = p_page_id
    AND user_id = p_user_id;
$$;
