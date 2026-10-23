-- =============================================================================
-- Migration: 20261022120000_unified_schema_migration.sql
-- Spec: 120 Unified Schema Migration — Option C (Shahzeb, 2026-10-22)
-- Purpose:
--   1. RENAME the two tables whose names collide with the unified schema
--      (queue_items -> legacy_queue_items, publish_logs -> legacy_publish_logs)
--      and rename their primary-key constraints so the new tables can take
--      the default PK names. The legacy tables keep every row and stay in
--      place until the Phase 7 drop (spec 128); production code keeps
--      running against them (its references are updated in the same PR).
--   2. Re-point the four EXISTING RPCs (claim_due_queue_items (INT, INT),
--      settle_queue_item_outcome (16 args), recover_stuck_publishing_items
--      (INT), get_page_queue_status_counts (UUID, UUID)) at the legacy
--      tables. Bodies are verbatim copies of the live definitions with only
--      the table names changed: PL/pgSQL/SQL function bodies resolve table
--      names at parse time in a fresh session, so without this step the old
--      RPCs would bind to the NEW tables (which lack fb_page_id / user_id)
--      and fail. Signatures, return shapes and ACLs are unchanged.
--   3. CREATE the unified multi-platform schema (spec 119 §4.1): platform
--      enum, social_accounts, destinations, posting_slots, queue_items,
--      publish_logs, platform_credentials, indexes, RLS tenant policies and
--      updated_at triggers.
--   4. CREATE the new RPCs (spec 119 §4.2) as overloads alongside the old
--      ones, service-role-only from birth (spec 117 grant conventions).
--   5. BACKFILL all Facebook data old -> new in FK order, preserving every
--      row id 1:1 and copying ciphertext byte-for-byte. Every non-1:1
--      status/format mapping is an explicit CASE below and listed in the PR.
-- Nothing is dropped. No other existing object is modified.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Renames (Option C)
-- -----------------------------------------------------------------------------
ALTER TABLE public.queue_items RENAME TO legacy_queue_items;
ALTER TABLE public.publish_logs RENAME TO legacy_publish_logs;

-- Free the default primary-key names for the new tables; the constraints
-- themselves (and every index/FK/trigger/policy, which is scoped per table)
-- stay attached to the legacy tables.
ALTER TABLE public.legacy_queue_items RENAME CONSTRAINT queue_items_pkey TO legacy_queue_items_pkey;
ALTER TABLE public.legacy_publish_logs RENAME CONSTRAINT publish_logs_pkey TO legacy_publish_logs_pkey;

-- -----------------------------------------------------------------------------
-- 2. Existing RPCs re-pointed at the legacy tables (reference update only)
-- -----------------------------------------------------------------------------

-- 2a. claim_due_queue_items(INT, INT) — verbatim from
--     20261018000000_platform_audit_remediation.sql, table names updated.
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
    LIMIT GREATEST(1, p_limit)
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

-- 2b. settle_queue_item_outcome (16 args) — verbatim, table names updated.
CREATE OR REPLACE FUNCTION public.settle_queue_item_outcome(
  p_queue_item_id UUID,
  p_user_id UUID,
  p_fb_page_id UUID,
  p_outcome_status TEXT,
  p_fb_post_id TEXT DEFAULT NULL,
  p_fb_comment_id TEXT DEFAULT NULL,
  p_retry_count INT DEFAULT 0,
  p_retry_delay_seconds INT DEFAULT 300,
  p_error_code INT DEFAULT NULL,
  p_error_subcode INT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_comment_warning TEXT DEFAULT NULL,
  p_target_page_status TEXT DEFAULT NULL,
  p_target_account_status TEXT DEFAULT NULL,
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
    UPDATE public.legacy_queue_items
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
    UPDATE public.legacy_queue_items
    SET status = 'queued',
        retry_count = p_retry_count,
        scheduled_time = now() + make_interval(secs => GREATEST(1, COALESCE(p_retry_delay_seconds, 300))),
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'retry';
    v_log_message := p_error_message;

  ELSE
    UPDATE public.legacy_queue_items
    SET status = 'failed',
        retry_count = p_retry_count,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'failure';
    v_log_message := p_error_message;
  END IF;

  INSERT INTO public.legacy_publish_logs (
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

  IF p_target_account_status = 'expired' AND v_facebook_account_id IS NOT NULL THEN
    UPDATE public.facebook_accounts
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_facebook_account_id
      AND user_id = p_user_id;
  END IF;
END;
$$;

-- 2c. recover_stuck_publishing_items(INT) — verbatim, table name updated.
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
    UPDATE public.legacy_queue_items
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

-- 2d. get_page_queue_status_counts(UUID, UUID) — verbatim, table name updated.
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
  FROM public.legacy_queue_items
  WHERE fb_page_id = p_page_id
    AND user_id = p_user_id;
$$;

-- -----------------------------------------------------------------------------
-- 3. Platform enum
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.platform AS ENUM ('facebook', 'instagram', 'threads', 'youtube', 'x', 'tiktok');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Unified tables (spec 119 §4.1)
-- -----------------------------------------------------------------------------

-- 4a. platform_credentials (replaces workspace_byoc_credentials)
CREATE TABLE public.platform_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  client_id VARCHAR(255) NOT NULL,
  encrypted_client_secret TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'unverified'
    CHECK (status IN ('unverified', 'valid', 'invalid')),
  last_tested_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_platform_credentials_workspace_platform UNIQUE (workspace_id, platform)
);
CREATE INDEX idx_platform_credentials_workspace_id ON public.platform_credentials (workspace_id);

-- 4b. social_accounts (replaces facebook_accounts)
CREATE TABLE public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  external_account_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  avatar_url TEXT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT NULL,
  token_expires_at TIMESTAMPTZ NULL,
  scopes TEXT[] NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_social_accounts_workspace_platform_external
    UNIQUE (workspace_id, platform, external_account_id)
);
CREATE INDEX idx_social_accounts_workspace_id ON public.social_accounts (workspace_id);

-- 4c. destinations (replaces facebook_pages)
CREATE TABLE public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  external_destination_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  handle VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  status VARCHAR(30) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'rate_limited', 'disconnected', 'error')),
  encrypted_destination_token TEXT NULL,
  next_allowed_publish_at TIMESTAMPTZ NULL,
  rate_usage_pct SMALLINT NOT NULL DEFAULT 0 CHECK (rate_usage_pct BETWEEN 0 AND 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_destinations_account_external UNIQUE (account_id, external_destination_id)
);
CREATE INDEX idx_destinations_account_id ON public.destinations (account_id);
CREATE INDEX idx_destinations_workspace_id ON public.destinations (workspace_id);

-- 4d. posting_slots (replaces page_queue_slots)
-- `kind` carries the slot's format coverage. The old representation is an
-- array (page_queue_slots.allowed_formats TEXT[]), so `kind` is TEXT[] and
-- the backfill copies the array verbatim, one row per old slot, ids kept.
CREATE TABLE public.posting_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  kind TEXT[] NOT NULL DEFAULT ARRAY['text', 'image', 'reel', 'video', 'story'],
  time_of_day TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posting_slots_destination_id ON public.posting_slots (destination_id);

-- 4e. queue_items (generalised)
CREATE TABLE public.queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  kind VARCHAR(20) NOT NULL
    CHECK (kind IN ('text', 'image', 'video', 'story', 'carousel')),
  platform_format VARCHAR(50) NULL,
  caption TEXT NOT NULL DEFAULT '',
  title TEXT NULL,
  first_comment TEXT NULL,
  media_item_id UUID NULL REFERENCES public.media_items(id) ON DELETE SET NULL,
  media_url TEXT NULL,
  media_storage_key VARCHAR(500) NULL,
  link_url TEXT NULL,
  platform_options JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_time TIMESTAMPTZ NOT NULL,
  slot_id UUID NULL REFERENCES public.posting_slots(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'publishing', 'published', 'failed', 'cancelled')),
  claimed_at TIMESTAMPTZ NULL,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INT NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
  error_code TEXT NULL,
  error_subcode TEXT NULL,
  error_message TEXT NULL,
  external_post_id VARCHAR(255) NULL,
  external_comment_id VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queue_items_status_scheduled_time ON public.queue_items (status, scheduled_time);
CREATE INDEX idx_queue_items_platform_status_scheduled_time ON public.queue_items (platform, status, scheduled_time);
CREATE INDEX idx_queue_items_destination_id_status ON public.queue_items (destination_id, status);
CREATE INDEX idx_queue_items_workspace_id ON public.queue_items (workspace_id);
CREATE INDEX idx_queue_items_slot_id ON public.queue_items (slot_id);

-- 4f. publish_logs (generalised)
CREATE TABLE public.publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id UUID NOT NULL REFERENCES public.queue_items(id) ON DELETE CASCADE,
  destination_id UUID NOT NULL REFERENCES public.destinations(id) ON DELETE CASCADE,
  platform public.platform NOT NULL,
  attempt_no INT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
  result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'retry', 'failure')),
  external_post_id VARCHAR(255) NULL,
  response_code INT NULL,
  response_message TEXT NULL,
  duration_ms INT NULL,
  detail JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_publish_logs_queue_item_id ON public.publish_logs (queue_item_id);
CREATE INDEX idx_publish_logs_destination_id ON public.publish_logs (destination_id);

-- -----------------------------------------------------------------------------
-- 5. RLS + tenant policies (workspace-ownership pattern of the FB tables)
-- -----------------------------------------------------------------------------
ALTER TABLE public.platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posting_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_credentials_workspace_owner_access" ON public.platform_credentials
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "social_accounts_workspace_owner_access" ON public.social_accounts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "destinations_workspace_owner_access" ON public.destinations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "posting_slots_workspace_owner_access" ON public.posting_slots
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.destinations d
    JOIN public.workspaces w ON w.id = d.workspace_id
    WHERE d.id = destination_id AND w.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.destinations d
    JOIN public.workspaces w ON w.id = d.workspace_id
    WHERE d.id = destination_id AND w.owner_id = auth.uid()
  ));

CREATE POLICY "queue_items_workspace_owner_access" ON public.queue_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "publish_logs_workspace_owner_access" ON public.publish_logs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.destinations d
    JOIN public.workspaces w ON w.id = d.workspace_id
    WHERE d.id = destination_id AND w.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.destinations d
    JOIN public.workspaces w ON w.id = d.workspace_id
    WHERE d.id = destination_id AND w.owner_id = auth.uid()
  ));

-- updated_at triggers (same set_updated_at() convention as the core tables;
-- publish_logs has no updated_at column, as before)
DROP TRIGGER IF EXISTS trg_platform_credentials_updated_at ON public.platform_credentials;
CREATE TRIGGER trg_platform_credentials_updated_at
  BEFORE UPDATE ON public.platform_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_social_accounts_updated_at ON public.social_accounts;
CREATE TRIGGER trg_social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_destinations_updated_at ON public.destinations;
CREATE TRIGGER trg_destinations_updated_at
  BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_posting_slots_updated_at ON public.posting_slots;
CREATE TRIGGER trg_posting_slots_updated_at
  BEFORE UPDATE ON public.posting_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_queue_items_updated_at ON public.queue_items;
CREATE TRIGGER trg_queue_items_updated_at
  BEFORE UPDATE ON public.queue_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6. New RPCs (spec 119 §4.2) — overloads, service-role-only
-- -----------------------------------------------------------------------------

-- 6a. claim_due_queue_items(platform, text[], int, int)
-- Internal p_limit hard cap: 1000. Spec 121 claims in rounds of 500, so the
-- cap must be >= 500 or a round would be silently truncated; 1000 leaves
-- one full round of headroom while still bounding a single claim call.
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
  RETURN QUERY
  WITH ranked_due AS (
    SELECT
      qi.id AS queue_id,
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
  candidate_ids AS (
    SELECT q.id
    FROM public.queue_items q
    INNER JOIN ranked_due rd ON rd.queue_id = q.id
    WHERE rd.destination_rank <= GREATEST(1, p_max_per_destination)
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

-- 6b. settle_queue_item_outcome — new-schema overload. Distinct from the
-- legacy 16-arg overload because p_error_code / p_error_subcode are TEXT
-- (platform error codes are not all numeric) and page concepts are
-- destination concepts (p_destination_id, p_external_post_id, ...).
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
  p_rate_usage_pct SMALLINT DEFAULT NULL
)
RETURNS VOID
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
      AND workspace_id = p_workspace_id;

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
      AND workspace_id = p_workspace_id;

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
      AND workspace_id = p_workspace_id;

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
    CASE
      WHEN p_error_code IS NOT NULL OR p_error_subcode IS NOT NULL
        THEN jsonb_strip_nulls(jsonb_build_object('errorCode', p_error_code, 'errorSubcode', p_error_subcode))
      ELSE NULL
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
          THEN now() + make_interval(secs => p_destination_cooldown_seconds)
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_queue_item_outcome(UUID, UUID, UUID, TEXT, TEXT, TEXT, INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INT, SMALLINT) TO service_role;

-- 6c. recover_stuck_publishing_items — new-schema overload. The legacy
-- overload is recover_stuck_publishing_items(INT); an identical new
-- signature would replace it, so the new overload takes the platform as a
-- required first argument: recover_stuck_publishing_items(platform, INT).
-- Legacy 1-arg calls keep resolving to the legacy overload untouched.
CREATE OR REPLACE FUNCTION public.recover_stuck_publishing_items(
  p_platform public.platform,
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
        claimed_at = NULL,
        updated_at = now()
    WHERE status = 'publishing'
      AND platform = p_platform
      AND COALESCE(claimed_at, updated_at) <= now() - make_interval(mins => GREATEST(1, p_timeout_minutes))
    RETURNING id
  )
  SELECT count(*)::INT INTO v_recovered_count FROM recovered;

  RETURN COALESCE(v_recovered_count, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recover_stuck_publishing_items(public.platform, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recover_stuck_publishing_items(public.platform, INT) TO service_role;

-- -----------------------------------------------------------------------------
-- 7. Backfill (FK order: credentials -> accounts -> destinations -> slots
--    -> queue items -> logs). All row ids are preserved 1:1 and all
--    ciphertext is copied byte-for-byte (no re-encryption).
-- -----------------------------------------------------------------------------

-- 7a. workspace_byoc_credentials -> platform_credentials (status 1:1)
INSERT INTO public.platform_credentials (
  id, workspace_id, platform, client_id, encrypted_client_secret,
  status, last_tested_at, created_at, updated_at
)
SELECT
  id, workspace_id, 'facebook'::public.platform, fb_app_id, encrypted_fb_app_secret,
  status, last_tested_at, created_at, updated_at
FROM public.workspace_byoc_credentials;

-- 7b. facebook_accounts -> social_accounts
-- Status CASE (non-1:1): active -> active, expired -> expired,
-- disconnected -> revoked (the new vocabulary has no 'disconnected' for
-- accounts; a disconnected account's token is no longer usable, which is
-- what 'revoked' means for an authorising identity). The old table has no
-- refresh-token or scopes columns: both backfill NULL.
INSERT INTO public.social_accounts (
  id, workspace_id, platform, external_account_id, display_name, avatar_url,
  encrypted_access_token, encrypted_refresh_token, token_expires_at, scopes,
  status, metadata, created_at, updated_at
)
SELECT
  id, workspace_id, 'facebook'::public.platform, fb_account_id, display_name, profile_picture_url,
  encrypted_access_token, NULL, token_expires_at, NULL,
  CASE status::text
    WHEN 'active' THEN 'active'
    WHEN 'expired' THEN 'expired'
    WHEN 'disconnected' THEN 'revoked'
    ELSE 'error'
  END,
  jsonb_strip_nulls(jsonb_build_object('gender', gender, 'account_link', account_link)),
  created_at, updated_at
FROM public.facebook_accounts;

-- 7c. facebook_pages -> destinations
-- Status CASE (non-1:1): active -> active, fb_rate_limited -> rate_limited,
-- paused -> disconnected (no paused state in the new vocabulary;
-- 'disconnected' is the non-publishable state and the claim RPC only
-- claims 'active' / cooldown-expired 'rate_limited', matching how paused
-- pages are never claimed today), disconnected -> disconnected,
-- invalid_token -> error, page_checkpoint -> error.
INSERT INTO public.destinations (
  id, workspace_id, account_id, platform, external_destination_id, name,
  handle, avatar_url, timezone, status, encrypted_destination_token,
  next_allowed_publish_at, rate_usage_pct, metadata, created_at, updated_at
)
SELECT
  id, workspace_id, facebook_account_id, 'facebook'::public.platform, fb_page_id, page_name,
  NULL, profile_picture_url, timezone,
  CASE status::text
    WHEN 'active' THEN 'active'
    WHEN 'fb_rate_limited' THEN 'rate_limited'
    WHEN 'paused' THEN 'disconnected'
    WHEN 'disconnected' THEN 'disconnected'
    WHEN 'invalid_token' THEN 'error'
    WHEN 'page_checkpoint' THEN 'error'
    ELSE 'error'
  END,
  encrypted_access_token,
  next_allowed_publish_at, buc_usage_pct,
  jsonb_strip_nulls(jsonb_build_object(
    'category', category,
    'tasks', tasks,
    'starting_followers', starting_followers,
    'current_followers', current_followers,
    'rate_limited_at', rate_limited_at
  )),
  created_at, updated_at
FROM public.facebook_pages;

-- 7d. page_queue_slots -> posting_slots (kind = allowed_formats verbatim)
INSERT INTO public.posting_slots (
  id, destination_id, kind, time_of_day, is_active, created_at, updated_at
)
SELECT
  id, fb_page_id, allowed_formats, slot_time, is_active, created_at, updated_at
FROM public.page_queue_slots;

-- 7e. legacy_queue_items -> queue_items (ids preserved)
-- Format CASE (non-1:1): old post_format 'reel' normalises to kind 'video'
-- with platform_format 'reel' (the new kind vocabulary has no 'reel';
-- Facebook's own format name is preserved in platform_format). 'video'
-- stays kind 'video' / platform_format 'video'; text/image/story are 1:1.
-- Status CASE (non-1:1): queued/publishing/published/failed are 1:1;
-- old 'skipped' -> 'cancelled' (the new vocabulary has no 'skipped').
-- claimed_at: the old table has no claimed_at column; rows still in
-- 'publishing' take their updated_at as claimed_at so the recovery sweep
-- semantics (age since claim) survive. published_at has no column in the
-- new table (spec 119 §4.1) and is not carried; it remains on the legacy
-- table until spec 128. next_comment_retry_at is transient retry state
-- and is not carried; platform_options is '{}' on every backfilled row.
INSERT INTO public.queue_items (
  id, workspace_id, destination_id, platform, kind, platform_format,
  caption, title, first_comment, media_item_id, media_url, media_storage_key,
  link_url, platform_options, scheduled_time, slot_id, status, claimed_at,
  retry_count, max_retries, error_code, error_subcode, error_message,
  external_post_id, external_comment_id, created_at, updated_at
)
SELECT
  qi.id, fp.workspace_id, qi.fb_page_id, 'facebook'::public.platform,
  CASE qi.post_format::text
    WHEN 'text' THEN 'text'
    WHEN 'image' THEN 'image'
    WHEN 'reel' THEN 'video'
    WHEN 'video' THEN 'video'
    WHEN 'story' THEN 'story'
    ELSE 'video'
  END,
  qi.post_format::text,
  qi.caption, NULL, qi.first_comment, qi.media_id, mi.url, mi.storage_key,
  qi.link_url, '{}'::jsonb, qi.scheduled_time, qi.slot_id,
  CASE qi.status
    WHEN 'queued' THEN 'queued'
    WHEN 'publishing' THEN 'publishing'
    WHEN 'published' THEN 'published'
    WHEN 'failed' THEN 'failed'
    WHEN 'skipped' THEN 'cancelled'
    ELSE 'cancelled'
  END,
  CASE WHEN qi.status = 'publishing' THEN qi.updated_at ELSE NULL END,
  qi.retry_count, qi.max_retries, NULL, NULL, NULL,
  qi.fb_post_id, qi.fb_comment_id, qi.created_at, qi.updated_at
FROM public.legacy_queue_items qi
JOIN public.facebook_pages fp
  ON fp.id = qi.fb_page_id AND fp.user_id = qi.user_id
LEFT JOIN public.media_items mi
  ON mi.id = qi.media_id AND mi.user_id = qi.user_id;

-- 7f. legacy_publish_logs -> publish_logs (ids preserved; queue-item ids
-- were preserved in 7e, so queue_item_id carries directly)
-- Result is the old status verbatim (success|retry|failure are 1:1).
-- fb_error_code / fb_error_subcode have no columns in the new table; they
-- are merged into `detail` alongside the old error_details payload.
INSERT INTO public.publish_logs (
  id, queue_item_id, destination_id, platform, attempt_no, result,
  external_post_id, response_code, response_message, duration_ms, detail,
  created_at
)
SELECT
  id, queue_item_id, fb_page_id, 'facebook'::public.platform, attempt_number, status,
  NULL, fb_response_code, error_message, NULL,
  CASE
    WHEN error_details IS NULL AND fb_error_code IS NULL AND fb_error_subcode IS NULL THEN NULL
    ELSE COALESCE(error_details, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object('fb_error_code', fb_error_code, 'fb_error_subcode', fb_error_subcode))
  END,
  created_at
FROM public.legacy_publish_logs;
