# Spec 042: High-Throughput 200,000 Posts/Day Multi-Format Publishing Engine (`text`, `image`, `reel`, `video`, `story`), Media Library Scaling, Dedicated Page Workspace & Hybrid Insights Architecture

## 1. Role, Monorepo Context & Non-Negotiable Governance Rules

You are a Staff Full-Stack TypeScript, PostgreSQL, and Cloudflare Edge Systems Architect working inside the `fbuploadpro` monorepo[cite: 1, 3, 47]:
- **`packages/contracts`**: Shared TypeScript interfaces, Zod schemas, AES-256-GCM token cryptography (`src/crypto/token.ts`), and Facebook Graph API error classification (`src/domain/*`)[cite: 1, 3, 25].
- **`supabase/migrations`**: Chronological PostgreSQL schema migrations, Row-Level Security (RLS) policies, triggers, and `SECURITY DEFINER` RPC functions[cite: 3, 47].
- **`apps/worker`**: Cloudflare Workers edge runtime (`src/index.ts`, `src/dispatcher.ts`, `src/fb-client.ts`, `src/settlement.ts`, `src/insights-sync.ts`) responsible for asynchronous publishing dispatch and daily Page insights synchronization[cite: 1, 47].
- **`apps/web`**: Next.js 16 App Router + React 19 application (`src/app/api/tenant/[subdomain]/*`, `src/components/media/*`, `src/components/pages/*`, `src/lib/*`)[cite: 1, 3, 14].

### 1.1 Architectural & Design Constraints
1. **Immutable Design System (`DESIGN.md`)**:
   - NEVER modify `DESIGN.md`[cite: 1, 5].
   - All new or updated React UI in `apps/web` MUST strictly use tokens from `apps/web/src/lib/theme.ts` (`THEME`, `PALETTE`, `RADII`, `SPACING`, `TYPOGRAPHY`, `COMPONENT_STYLES`, `STATUS_SIGNALS`) and CSS variables (`var(--bg-canvas)`, `var(--bg-panel)`, `var(--text-main)`, `var(--text-sub)`, `var(--border-subtle)`)[cite: 1, 9, 11, 35].
2. **UX Writing Standards (`.agents/rules/ux-writing-standards.md`)**:
   - All user-facing copy across buttons, modals, badges, empty states, and error banners MUST be clear, human, outcome-oriented, and free of internal developer jargon[cite: 1].
3. **Strict Backwards Compatibility with Existing Tests**:
   - Do not break any existing function signatures, route exports, or `data-testid` attributes required by the existing Vitest suites across `packages/contracts`, `apps/worker`, and `apps/web` (including `dedicated-page-placeholder`, `back-to-pages-btn`, `claimDueItems`, `dispatchItem`, `recordDispatchOutcome`, `settleOutcome`, `runDispatchCycle`, and `syncDailyPageInsights`)[cite: 3, 47].

---

## 2. Deep Root-Cause Audit of Existing Issues (Context for Implementation)

Every change you implement MUST directly resolve the following verified architectural bottlenecks and bugs:

### 2.1 Media Library & Cloud Downloader Issues (`apps/web/src/components/media/*`, `apps/web/src/app/api/tenant/[subdomain]/media/*`)
1. **Offset Pagination Drift & $O(N)$ Index Scan Degradation**:
   - `MediaLibraryExplorer` (`apps/web/src/components/media/media-library-explorer.tsx`) paginates with `MEDIA_PAGE_LIMIT = 100` using `query.set('offset', String(mediaItems.length))`[cite: 14].
   - When items are uploaded, deleted, or moved while a user browses, `mediaItems.length` shifts, causing `OFFSET` queries to skip rows or return duplicate rows. At 10,000+ media items, PostgreSQL `OFFSET` scans and discards thousands of index entries on every page request.
2. **Client-Side Duplicate Detection Blind Spot (>100 Items)**:
   - Pre-upload duplicate detection (`detectDuplicateUploadEntries`) compares queued uploads (`LOWER(name)` and `fileSize`) strictly against the `mediaItems` array currently loaded in browser memory.
   - Because only the first 100 items in a folder are fetched initially, duplicates matching existing files at position 101+ in PostgreSQL are completely missed.
3. **Base64 `data:` URL Thumbnail Bloat in PostgreSQL**:
   - `MediaPreviewModal` (`captureVideoFrameAsWebp`) and `PATCH /api/tenant/[subdomain]/media/[mediaId]` allow persisting raw `data:image/webp;base64,...` strings directly into `media_items.thumbnail_url` as a fallback[cite: 3, 14].
   - Storing multi-kilobyte base64 blobs inside `media_items.thumbnail_url` bloats every `GET /api/tenant/[subdomain]/media` list response and degrades PostgreSQL shared buffer performance.
4. **Synchronous Unbatched R2 Deletes in Cascading Folder Deletion**:
   - `DELETE /api/tenant/[subdomain]/media/folders/[folderId]` resolves the folder subtree via `WITH RECURSIVE` and deletes R2 objects synchronously before deleting database rows[cite: 3].
   - For large folders (500+ videos), unbatched storage deletion risks HTTP gateway timeouts and orphaned R2 objects.
5. **Missing Pixel Dimensions & Format Eligibility Validators**:
   - `media_items` only tracks `media_type` (`'video' | 'image'`), `duration_seconds`, and `aspect_ratio` (`'9:16' | '16:9' | '1:1'`), lacking `width`, `height`, and format eligibility validation to distinguish between a **Reel** ($9:16$ vertical video, $3\text{–}90\text{s}$), a **Feed Video** (any aspect ratio, up to $500\text{ MB}$), an **Image Post**, and a **Page Story** (image $\le 10\text{ MB}$ or vertical video $\le 60\text{s}$).
6. **Cloud Media Downloader Memory & Stream Hardening**:
   - `apps/web/src/lib/media-downloader.ts` allows up to `MAX_MEDIA_DOWNLOAD_BYTES = 524_288_000` (500 MB) per remote file[cite: 25]. It needs strict pre-stream `HEAD`/`Content-Length` enforcement and bounded concurrency so batch downloads do not exhaust serverless memory.

### 2.2 Pages & Dedicated Page Section Issues (`apps/web/src/components/pages/*`, `apps/web/src/app/api/tenant/[subdomain]/pages/*`)
1. **Hardcoded Media-Only Queue Schema Blocks Text Posts, Feed Videos & Stories**:
   - `queue_items.media_id UUID NOT NULL` requires every queued item to reference a row in `media_items`.
   - `EnqueueModal`, `PageTabDashboard`, and `PageTabQueue` only know about `mediaType: 'video' | 'image'`[cite: 9].
   - Consequently, users cannot create **Text/Link posts** (`media_id = NULL`), cannot choose between publishing a video as a **Reel** vs. a standard **Feed Video**, and cannot schedule **Photo Stories** or **Video Stories**.
2. **First Comment Allowed on Unsupported Story Format**:
   - `EnqueueModal` and `queue_items` allow setting `first_comment` on all items[cite: 9]. However, Facebook Page Stories (`/{page-id}/photo_stories` and `/{page-id}/video_stories`) do not support comments via the Graph API.
3. **Read-Request Write Amplification in `GET /api/tenant/[subdomain]/pages`**:
   - `handleListPages` evaluates 3-day `fb_rate_limited` cooldowns and executes `UPDATE facebook_pages SET status = 'active', rate_limited_at = NULL` writes synchronously inside the `GET` handler.
4. **Client-Side Queue Counter & Unpaginated Queue State**:
   - `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` computes the Queue tab badge (`Queue (${queueItems.filter((i) => i.status === 'queued').length})`) from the client-side array.
5. **Format-Blind Recurring Publishing Slots (`page_queue_slots`)**:
   - `page_queue_slots` only stores `slot_time`, `timezone`, and `is_active`[cite: 3, 36]. Operators cannot restrict specific recurring time slots to specific formats (e.g., 09:00 for Stories, 13:00 for Reels, 18:00 for Feed Videos/Text).
6. **Checkpoint Verification & Reactivation UX Gap**:
   - Pages flagged with `status = 'page_checkpoint'` (`368 / 4854002`) require the user to complete a checkpoint on the Facebook mobile app and then manually reactivate the Page in the UI, which lacks a dedicated banner and 1-click reactivation button in `DedicatedPageHeader` and `PageTabSettings`[cite: 9].

### 2.3 Posting Backend & Edge Worker Issues (14,400/Day Bottleneck vs. 200,000/Day Target)
1. **14,400 Posts/Day Hard Throughput Ceiling**:
   - The Cloudflare Worker cron runs once per minute (`* * * * *`) and `claim_due_queue_items(p_limit INT DEFAULT 10)` claims only `10` items per minute ($10 \times 1,440\text{ min} = 14,400\text{ posts/day}$).
   - `runDispatchCycle` iterates over claimed items sequentially (`for (const item of items)`), taking 2–5 seconds per video/reel upload.
   - Reaching **200,000 posts/day** requires sustaining **~139 posts/min** average and handling **2,500–5,000 posts/min** peak bursts at top-of-hour (`:00` and `:30`) slot boundaries.
2. **Cloudflare Worker Subrequest Limit Exhaustion**:
   - Each Reel/Video/Story publish plus first comment and DB settlement consumes 4–7 HTTP subrequests. Processing 500+ items inside a single Worker invocation will immediately crash against Cloudflare's per-invocation subrequest limit unless work is fanned out across **Cloudflare Queues** (`PUBLISH_QUEUE`) consumers with bounded concurrency.
3. **Table-Wide Lock Contention in `claim_due_queue_items`**:
   - Every invocation of `claim_due_queue_items` runs `UPDATE public.queue_items SET status = 'queued', updated_at = now() WHERE status = 'publishing' AND updated_at <= now() - INTERVAL '10 minutes';` before claiming rows. Under high-concurrency claiming, this causes redundant scans and lock contention.
4. **Head-of-Line Blocking & Missing Per-Page Claim Fairness**:
   - `claim_due_queue_items` orders globally by `scheduled_time ASC` without partitioning by `fb_page_id`. A single Page with 500 due posts monopolizes the batch and triggers immediate Facebook rate-limiting (`80001` or `368 / 1390008`).
5. **Fixed 5-Minute Retry Delay & Missing Page-Level Rate-Limit Pacing**:
   - `settlement.ts` and `dispatcher.ts` hardcode `scheduled_time = now() + interval '5 minutes'` on retry and ignore the `estimated_time_to_regain_access` value in `X-Business-Use-Case-Usage` / `X-App-Usage` response headers.
   - When a Page hits a rate limit (`4`, `17`, `32`, `341`, `613`, `80001`), only the single failing item is delayed while sibling queued items for that same Page continue to get claimed and fail every minute.
6. **Duplicate & Non-Transactional Multi-Roundtrip Settlement**:
   - Settlement logic is duplicated across `recordDispatchOutcome` (`dispatcher.ts`) and `settleOutcome` (`settlement.ts`), executing 2–3 separate PostgREST HTTP queries per item instead of a single atomic PostgreSQL RPC call.
7. **Missing Graph API v26.0 Publishers for `text`, `video`, and `story`**:
   - `FacebookPublishClient` (`apps/worker/src/fb-client.ts`) only implements `publishReel`, `publishPhoto`, and `postComment`[cite: 25, 47].
8. **First-Comment Race Condition During Async Video/Reel Processing**:
   - Calling `postComment` immediately after `publishReel` or `publishVideo` finishes can fail on Graph API v26.0 while the video node is still finalizing transcoding.
9. **Missing Parent Account Expiration Cascade on OAuth Errors (`190`, `102`, `10`, `200–299`)**:
   - When `evaluateGraphApiError` returns `accountStatus: 'expired'` and `pageStatus: 'invalid_token'`, `settlement.ts` updates `facebook_pages.status` but fails to update `facebook_accounts.status = 'expired'`.

### 2.4 Insights Backend Issues (`apps/worker/src/insights-sync.ts`, `apps/web/src/lib/insights/*`)
1. **`InsightsCache` is an In-Memory Stub Despite Requiring Upstash Redis Env Vars**:
   - `apps/web/src/lib/insights/insights-cache.ts` validates `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production, yet only reads/writes an in-memory `Map` (`this.cache`) and never calls Upstash Redis.
2. **Live Insights Route Ignores `page_insights_daily_snapshots`**:
   - `GET /api/tenant/[subdomain]/pages/[pageId]/insights` (`route.ts`) always hits the live Facebook Graph API on cache misses instead of serving persisted daily snapshots from `page_insights_daily_snapshots`, burning Page BUC (`80001`) quota[cite: 3, 36].
3. **Unpaginated Page Scan in `syncDailyPageInsights`**:
   - `apps/worker/src/insights-sync.ts` fetches all active pages without pagination, truncating at 1,000 rows in PostgREST and breaching Cloudflare Worker subrequest limits above ~300 pages[cite: 47].
4. **Silent Error Swallowing Caches Zeroed Metrics**:
   - `FacebookInsightsClient` catches network/Graph errors and returns `0` metrics with `healthStatus: 'active'`, which `handleGetInsights` caches for 15 minutes (`Cache-Control: s-maxage=900`).

---

## 3. Phase 1: Database Forward Migration (`supabase/migrations/20261016000000_multi_format_200k_scale_upgrade.sql`)

Create the forward migration file `supabase/migrations/20261016000000_multi_format_200k_scale_upgrade.sql` with the exact schema, index, and RPC upgrades below:

```sql
-- =============================================================================
-- Migration: 20261016000000_multi_format_200k_scale_upgrade.sql
-- Purpose:
--   1. Multi-format publishing support ('text', 'image', 'reel', 'video', 'story')
--   2. Nullable media_id for text posts & strict story no-comment constraint
--   3. Format-aware page_queue_slots (allowed_formats)
--   4. Page-level rate-limit pacing (next_allowed_publish_at, buc_usage_pct)
--   5. Media dimensions (width, height) & keyset/duplicate lookup indexes
--   6. Fair per-page partitioned claim_due_queue_items RPC for 200k posts/day
--   7. Single-roundtrip atomic settle_queue_item_outcome RPC
--   8. Server-side queue status aggregation RPC
-- =============================================================================

-- 1. Create facebook_post_format enum
DO $$ BEGIN
  CREATE TYPE public.facebook_post_format AS ENUM ('text', 'image', 'reel', 'video', 'story');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Extend queue_items for all 5 post formats
ALTER TABLE public.queue_items
  ALTER COLUMN media_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS post_format public.facebook_post_format NOT NULL DEFAULT 'reel',
  ADD COLUMN IF NOT EXISTS link_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS next_comment_retry_at TIMESTAMPTZ NULL;

-- Backfill existing rows based on linked media_items.media_type
UPDATE public.queue_items qi
SET post_format = CASE
  WHEN mi.media_type = 'image' THEN 'image'::public.facebook_post_format
  ELSE 'reel'::public.facebook_post_format
END
FROM public.media_items mi
WHERE qi.media_id = mi.id;

-- Enforce format vs. media_id and story first_comment invariants
ALTER TABLE public.queue_items
  DROP CONSTRAINT IF EXISTS chk_queue_items_format_media,
  ADD CONSTRAINT chk_queue_items_format_media CHECK (
    (post_format = 'text' AND length(btrim(caption)) > 0)
    OR (post_format IN ('image', 'reel', 'video', 'story') AND media_id IS NOT NULL)
  ),
  DROP CONSTRAINT IF EXISTS chk_queue_items_story_no_comment,
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

-- 6. High-throughput partial indexes for 200k/day queue claiming & recovery
CREATE INDEX IF NOT EXISTS idx_queue_items_claim_partitioned
  ON public.queue_items (fb_page_id, scheduled_time ASC, id ASC)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_queue_items_stuck_publishing
  ON public.queue_items (updated_at ASC)
  WHERE status = 'publishing';

-- 7. Dedicated stuck-publishing recovery RPC (decoupled from hot claim path)
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

-- 8. Upgraded fair per-page partitioned claim_due_queue_items RPC
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
  status public.queue_status,
  retry_count SMALLINT,
  fb_post_id TEXT,
  fb_comment_id TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  page_external_id TEXT,
  encrypted_page_token BYTEA,
  media_type public.media_type,
  media_url TEXT,
  storage_key TEXT
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
    c.status,
    c.retry_count,
    c.fb_post_id,
    c.fb_comment_id,
    c.published_at,
    c.created_at,
    c.updated_at,
    fp.fb_page_id AS page_external_id,
    fp.encrypted_page_token,
    mi.media_type,
    mi.url AS media_url,
    mi.storage_key
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

-- 9. Single-roundtrip atomic settlement RPC
CREATE OR REPLACE FUNCTION public.settle_queue_item_outcome(
  p_queue_item_id UUID,
  p_user_id UUID,
  p_fb_page_id UUID,
  p_outcome_status TEXT,            -- 'published' | 'queued' | 'failed'
  p_fb_post_id TEXT DEFAULT NULL,
  p_fb_comment_id TEXT DEFAULT NULL,
  p_retry_count SMALLINT DEFAULT 0,
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
  v_log_status TEXT;
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

    v_log_status := 'published';
    v_log_message := p_comment_warning;

  ELSIF p_outcome_status = 'queued' THEN
    UPDATE public.queue_items
    SET status = 'queued',
        retry_count = p_retry_count,
        scheduled_time = now() + make_interval(secs => GREATEST(1, COALESCE(p_retry_delay_seconds, 300))),
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'retried';
    v_log_message := p_error_message;

  ELSE
    UPDATE public.queue_items
    SET status = 'failed',
        retry_count = p_retry_count,
        updated_at = now()
    WHERE id = p_queue_item_id
      AND user_id = p_user_id;

    v_log_status := 'failed';
    v_log_message := p_error_message;
  END IF;

  INSERT INTO public.publish_logs (
    user_id,
    queue_item_id,
    fb_page_id,
    status,
    fb_error_code,
    fb_error_subcode,
    error_message,
    created_at
  ) VALUES (
    p_user_id,
    p_queue_item_id,
    p_fb_page_id,
    v_log_status,
    p_error_code,
    p_error_subcode,
    v_log_message,
    now()
  );

  -- Update page status, rate_limited_at, next_allowed_publish_at, and buc_usage_pct
  UPDATE public.facebook_pages
  SET status = CASE
        WHEN p_target_page_status IS NOT NULL THEN p_target_page_status::public.page_status
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

  -- Cascade parent Facebook account status to 'expired' when required (e.g. 190 non-492, 102, 10, 200-299)
  IF p_target_account_status = 'expired' AND v_facebook_account_id IS NOT NULL THEN
    UPDATE public.facebook_accounts
    SET status = 'expired',
        updated_at = now()
    WHERE id = v_facebook_account_id
      AND user_id = p_user_id;
  END IF;
END;
$$;

-- 10. Server-side queue status counter RPC for Dedicated Page Workspace
CREATE OR REPLACE FUNCTION public.get_page_queue_status_counts(
  p_page_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  queued_count BIGINT,
  publishing_count BIGINT,
  published_count BIGINT,
  failed_count BIGINT
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
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
  FROM public.queue_items
  WHERE fb_page_id = p_page_id
    AND user_id = p_user_id;
$$;
```

---

## 4. Phase 2: Shared Contracts & Domain Schemas (`packages/contracts`)

### 4.1 `packages/contracts/src/domain/publishing.ts` & `packages/contracts/src/domain/dispatcher.ts`
Update the publishing/dispatcher contract files (and re-export from `packages/contracts/src/index.ts`) with the following:

1. **`PostFormatSchema` & `PostFormat`**:
   ```ts
   export const PostFormatValues = ['text', 'image', 'reel', 'video', 'story'] as const;
   export const PostFormatSchema = z.enum(PostFormatValues);
   export type PostFormat = z.infer<typeof PostFormatSchema>;
   ```

2. **`GraphRateLimitTelemetry` & `PublishResult`**:
   ```ts
   export interface GraphRateLimitTelemetry {
     appUsageMaxPct?: number | undefined;
     bucUsageMaxPct?: number | undefined;
     estimatedTimeToRegainAccessMinutes?: number | undefined;
   }

   export interface PublishResult {
     postId: string;
     telemetry?: GraphRateLimitTelemetry | undefined;
   }
   ```

3. **Extend `ClaimedQueueItemSchema`**:
   - Keep backwards compatibility for existing tests that omit `postFormat` by defaulting `postFormat` based on `mediaType` (`mediaType === 'image' ? 'image' : 'reel'`) when `postFormat` is not provided.
   - Allow `mediaId`, `mediaType`, `mediaUrl`, and `storageKey` to be `string | null | undefined` when `postFormat === 'text'`.
   - Add optional `linkUrl?: string | null | undefined` and `facebookAccountId?: string | null | undefined`.

4. **Extend `DispatchOutcome` & `DispatchOutcomeSchema`**:
   - Add optional fields:
     - `targetAccountStatus?: 'active' | 'expired' | undefined`
     - `retryDelaySeconds?: number | undefined`
     - `pageCooldownSeconds?: number | undefined`
     - `bucUsagePct?: number | undefined`

5. **Extend `IFacebookPublishClient`**:
   - Keep `publishReel`, `publishPhoto`, and `postComment` with their exact existing signatures and return types (`Promise<{ postId: string; telemetry?: GraphRateLimitTelemetry }>` and `Promise<{ commentId: string; telemetry?: GraphRateLimitTelemetry }>`)[cite: 25].
   - Add:
     - `publishTextPost?(params: { pageId: string; accessToken: string; message: string; linkUrl?: string | null | undefined }): Promise<PublishResult>`
     - `publishVideo?(params: { pageId: string; accessToken: string; videoUrl: string; caption: string; title?: string | undefined }): Promise<PublishResult>`
     - `publishPhotoStory?(params: { pageId: string; accessToken: string; imageUrl: string }): Promise<PublishResult>`
     - `publishVideoStory?(params: { pageId: string; accessToken: string; videoUrl: string }): Promise<PublishResult>`

6. **Format Eligibility Helper (`validatePostFormatEligibility` & `getEligiblePostFormatsForMedia`)**:
   - Export pure domain functions in `packages/contracts/src/domain/publishing.ts`:
     - `validatePostFormatEligibility(input: { postFormat: PostFormat; caption?: string | null; firstComment?: string | null; linkUrl?: string | null; media?: { mediaType: 'video' | 'image'; fileSize?: number | null; durationSeconds?: number | null; aspectRatio?: string | null } | null }): { valid: boolean; error?: string; warnings?: string[] }`
       - Rules:
         - `'text'`: `media` must be null/undefined; `caption` (or `linkUrl`) must be non-empty. `firstComment` is allowed.
         - `'image'`: `media` is required and `media.mediaType === 'image'`. `firstComment` is allowed.
         - `'reel'`: `media` is required and `media.mediaType === 'video'`. If `durationSeconds` is present and $> 90$, return a validation error (`"Reels cannot exceed 90 seconds. Choose Feed Video instead."`). If `aspectRatio && aspectRatio !== '9:16'`, include a non-blocking warning (`"Reels perform best in 9:16 vertical aspect ratio."`). `firstComment` is allowed.
         - `'video'`: `media` is required and `media.mediaType === 'video'`. Supports all aspect ratios (`16:9`, `1:1`, `9:16`) and durations. `firstComment` is allowed.
         - `'story'`: `media` is required (`'image'` or `'video'`). If `'image'` and `fileSize > 10 * 1024 * 1024`, return error (`"Photo Stories cannot exceed 10 MB."`). If `'video'` and `durationSeconds && durationSeconds > 60`, return error (`"Video Stories cannot exceed 60 seconds."`). If `firstComment && firstComment.trim().length > 0`, return error (`"Facebook Stories do not support comments."`).
     - `getEligiblePostFormatsForMedia(media: { mediaType: 'video' | 'image'; fileSize?: number | null; durationSeconds?: number | null; aspectRatio?: string | null }): PostFormat[]`
       - For `'image'`: returns `['image', 'story']` (if `fileSize <= 10MB` or unspecified, else `['image']`).
       - For `'video'`:
         - Always includes `'video'`.
         - Includes `'reel'` if `durationSeconds == null || (durationSeconds >= 3 && durationSeconds <= 90)`.
         - Includes `'story'` if `durationSeconds == null || durationSeconds <= 60`.

### 4.2 `packages/contracts/src/domain/queue.ts`
1. Update `EnqueueRequestSchema` (and `QueueItemSchema` / `UpdateQueueItemRequestSchema`):
   - Add `postFormat: PostFormatSchema.optional()` (if omitted in legacy calls, infer `'text'` when `mediaId == null`, or infer from media item's `mediaType`: `'image'` $\rightarrow$ `'image'`, `'video'` $\rightarrow$ `'reel'`).
   - Change `mediaId` to `z.string().uuid().nullable().optional()`.
   - Add `linkUrl: z.string().url().nullable().optional()`.
   - Add `.superRefine(...)` enforcing:
     - If `postFormat === 'text'`, `caption` must be non-empty (`caption.trim().length > 0`).
     - If `postFormat !== 'text'`, `mediaId` must be a valid non-null UUID.
     - If `postFormat === 'story'`, `firstComment` must be null, undefined, or empty string `""` (normalize empty string to `null`).
2. Update `PageQueueSlotSchema`, `CreateQueueSlotRequestSchema`, and `UpdateQueueSlotRequestSchema`:
   - Add `allowedFormats: z.array(PostFormatSchema).min(1).default(['text', 'image', 'reel', 'video', 'story']).optional()`.

### 4.3 `packages/contracts/src/domain/media.ts`
1. Update `MediaItemResponseSchema` and `ConfirmMediaUploadRequestSchema`:
   - Add `width: z.number().int().positive().nullable().optional()`.
   - Add `height: z.number().int().positive().nullable().optional()`.
2. Update `MediaListQuerySchema`:
   - Add `cursor: z.string().optional()` for keyset pagination (`createdAt|id`).
   - Add `postFormat: PostFormatSchema.optional()` so the Media Library or `EnqueueModal` can filter compatible assets server-side.
3. Add `CheckDuplicatesRequestSchema` and `CheckDuplicatesResponseSchema`:
   ```ts
   export const CheckDuplicatesEntrySchema = z.object({
     clientKey: z.string().min(1),
     name: z.string().min(1),
     fileSize: z.number().int().nonnegative(),
     folderId: z.string().uuid().nullable().optional(),
   });

   export const CheckDuplicatesRequestSchema = z.object({
     folderId: z.string().uuid().nullable().optional(),
     entries: z.array(CheckDuplicatesEntrySchema).min(1).max(500),
   });
   ```

---

## 5. Phase 3: High-Throughput 200,000 Posts/Day Edge Worker & Graph API v26.0 Client (`apps/worker`)

### 5.1 `apps/worker/src/fb-client.ts`
Upgrade `FacebookPublishClient` and `MockFacebookPublishClient`:

1. **Rate-Limit Header Telemetry Parser (`parseGraphRateLimitHeaders`)**:
   - Export a helper `parseGraphRateLimitHeaders(headers?: Headers | null): GraphRateLimitTelemetry | undefined`.
   - Parse `x-app-usage` JSON (`{ call_count, total_cputime, total_time }`) and compute `appUsageMaxPct = Math.max(call_count || 0, total_cputime || 0, total_time || 0)`.
   - Parse `x-business-use-case-usage` JSON (object keyed by business/page ID mapping to an array of usage entries `[{ call_count, total_cputime, total_time, estimated_time_to_regain_access }]`). Compute `bucUsageMaxPct` and max `estimatedTimeToRegainAccessMinutes`.
   - Attach `telemetry` to `FacebookGraphError` on error responses AND to `PublishResult` on successful responses.

2. **Implement All 5 Graph API v26.0 Format Publishers in `FacebookPublishClient`**:
   - Always pass the Page access token in `Authorization: Bearer ${accessToken}` header (never in URL query parameters).
   - **`publishTextPost({ pageId, accessToken, message, linkUrl })`**:
     - `POST ${this.baseUrl}/${pageId}/feed`
     - Body: `JSON.stringify({ message, ...(linkUrl ? { link: linkUrl } : {}) })`
     - Return `{ postId: String(data.id), telemetry }`.
   - **`publishPhoto({ pageId, accessToken, imageUrl, caption })`**:
     - `POST ${this.baseUrl}/${pageId}/photos`
     - Body: `JSON.stringify({ url: imageUrl, message: caption, published: true })`
     - Return `{ postId: String(data.post_id ?? data.id), telemetry }`.
   - **`publishReel({ pageId, accessToken, videoUrl, caption })`**:
     - Phase 1: `POST ${this.baseUrl}/${pageId}/video_reels` with `{ upload_phase: 'start' }` $\rightarrow$ `videoId = data.video_id`.
     - Phase 2: `POST ${this.ruploadUrl}/${videoId}` with headers `Authorization: Bearer ${accessToken}` and `file_url: videoUrl`.
     - Phase 3: `POST ${this.baseUrl}/${pageId}/video_reels` with `{ upload_phase: 'finish', video_id: videoId, video_state: 'PUBLISHED', description: caption }`.
     - Return `{ postId: String(data.post_id ?? videoId), telemetry }`.
   - **`publishVideo({ pageId, accessToken, videoUrl, caption, title })`**:
     - `POST ${this.baseUrl}/${pageId}/videos`
     - Body: `JSON.stringify({ file_url: videoUrl, description: caption, ...(title ? { title } : {}) })`
     - Return `{ postId: String(data.id), telemetry }`.
   - **`publishPhotoStory({ pageId, accessToken, imageUrl })`**:
     - Step 1 (Upload unpublished photo): `POST ${this.baseUrl}/${pageId}/photos` with `JSON.stringify({ url: imageUrl, published: false })` $\rightarrow$ extract `photoId = String(photoData.id)`.
     - Step 2 (Publish Photo Story): `POST ${this.baseUrl}/${pageId}/photo_stories` with `JSON.stringify({ photo_id: photoId })` $\rightarrow$ return `{ postId: String(storyData.post_id ?? storyData.id ?? photoId), telemetry }`.
   - **`publishVideoStory({ pageId, accessToken, videoUrl })`**:
     - Step 1 (Start Video Story session): `POST ${this.baseUrl}/${pageId}/video_stories` with `JSON.stringify({ upload_phase: 'start' })` $\rightarrow$ extract `videoId = String(startData.video_id)` and `uploadUrl = startData.upload_url ?? "${this.ruploadUrl}/${videoId}"`.
     - Step 2 (Transfer remote video via `file_url`): `POST ${uploadUrl}` with headers `Authorization: Bearer ${accessToken}` and `file_url: videoUrl`.
     - Step 3 (Finish Video Story): `POST ${this.baseUrl}/${pageId}/video_stories` with `JSON.stringify({ upload_phase: 'finish', video_id: videoId })` $\rightarrow$ return `{ postId: String(finishData.post_id ?? finishData.id ?? videoId), telemetry }`.

3. **Upgrade `MockFacebookPublishClient`**:
   - Add tracking arrays:
     - `public textPostsPublished: Array<{ pageId: string; message: string; linkUrl?: string | null | undefined }> = []`
     - `public videosPublished: Array<{ pageId: string; videoUrl: string; caption: string; title?: string | undefined }> = []`
     - `public photoStoriesPublished: Array<{ pageId: string; imageUrl: string }> = []`
     - `public videoStoriesPublished: Array<{ pageId: string; videoUrl: string }> = []`
   - Implement `publishTextPost`, `publishVideo`, `publishPhotoStory`, and `publishVideoStory` on `MockFacebookPublishClient` so unit tests can inspect every format's invocation.

### 5.2 `apps/worker/src/dispatcher.ts`
1. **Update `claimDueItems(db, limit = 10, maxPerPage = 3)`**:
   - Support both legacy `db.query` and Supabase `db.rpc('claim_due_queue_items', ...)`.
   - When calling `db.rpc('claim_due_queue_items', ...)`, pass `{ p_limit: limit }` if `maxPerPage === 3` (to preserve exact mock assertions in existing tests that check `.toHaveBeenCalledWith('claim_due_queue_items', { p_limit: 10 })`) and `{ p_limit: limit, p_max_per_page: maxPerPage }` when a custom `maxPerPage` is provided.
   - Map `post_format` (defaulting to `row.media_type === 'image' ? 'image' : 'reel'` if absent in legacy test fixtures), `link_url`, and `facebook_account_id`.

2. **Update `dispatchItem(item, fbClient, masterKeyHex, maxRetries = 3)`**:
   - Determine effective format:
     ```ts
     const format: PostFormat =
       item.postFormat ??
       (item.mediaType === 'image' ? 'image' : 'reel');
     ```
   - Decrypt Page access token using `decryptToken(item.encryptedPageToken, masterKeyHex)`.
   - Route by `format`:
     - `'text'`: Call `fbClient.publishTextPost({ pageId: item.pageExternalId, accessToken: pageToken, message: item.caption, linkUrl: item.linkUrl })`.
     - `'image'`: Require `item.mediaUrl`; call `fbClient.publishPhoto({ pageId: item.pageExternalId, accessToken: pageToken, imageUrl: item.mediaUrl, caption: item.caption })`.
     - `'reel'`: Require `item.mediaUrl`; call `fbClient.publishReel({ pageId: item.pageExternalId, accessToken: pageToken, videoUrl: item.mediaUrl, caption: item.caption })`.
     - `'video'`: Require `item.mediaUrl`; if `fbClient.publishVideo` is defined, call `fbClient.publishVideo({ pageId: item.pageExternalId, accessToken: pageToken, videoUrl: item.mediaUrl, caption: item.caption })`, else fallback to `fbClient.publishReel(...)`.
     - `'story'`: Require `item.mediaUrl`; if `item.mediaType === 'image'`, call `fbClient.publishPhotoStory({ pageId: item.pageExternalId, accessToken: pageToken, imageUrl: item.mediaUrl })`; else call `fbClient.publishVideoStory({ pageId: item.pageExternalId, accessToken: pageToken, videoUrl: item.mediaUrl })`.
   - **Conditional First Comment Execution**:
     - If `format === 'story'`, NEVER call `fbClient.postComment` (even if `item.firstComment` is non-empty).
     - For `'text'`, `'image'`, `'reel'`, and `'video'`, if `item.firstComment && item.firstComment.trim().length > 0`:
       - Call `fbClient.postComment({ postId, accessToken: pageToken, message: item.firstComment.trim() })`.
       - If `postComment` fails, catch the error and set `commentWarning` while still returning `status: 'published'`.
   - **Proactive Rate-Limit Pacing & Error Backoff**:
     - If a successful publish returns `telemetry?.bucUsageMaxPct && telemetry.bucUsageMaxPct >= 85`, attach `bucUsagePct` and `pageCooldownSeconds = (telemetry.estimatedTimeToRegainAccessMinutes || 5) * 60` to the outcome so the Page proactively cools down before hitting a hard block.
     - On `FacebookGraphError`:
       - Evaluate via `evaluateGraphApiError(err.code, err.subcode, err.message)`.
       - If `evaluation.accountStatus === 'expired'`, set `targetAccountStatus: 'expired'`.
       - If `evaluation.isTransient && nextRetryCount < maxRetries`:
         - Compute `retryDelaySeconds`: if `err.telemetry?.estimatedTimeToRegainAccessMinutes` is $> 0$, use `err.telemetry.estimatedTimeToRegainAccessMinutes * 60`; otherwise use `300 * Math.pow(2, item.retryCount)` capped at `3600` seconds (note: when `item.retryCount === 0`, `300 * 2^0 = 300` seconds = 5 minutes).
         - For rate-limit codes (`4`, `17`, `32`, `341`, `613`, `80000–80014`), also set `pageCooldownSeconds = retryDelaySeconds` so all queued items on that Page pause until the cooldown expires.

3. **Bounded Parallel Dispatch Pool in `runDispatchCycle`**:
   - Upgrade `runDispatchCycle(db, fbClient, masterKeyHex, batchSize = 10, concurrency = 25)`:
     - Claim up to `batchSize` items via `claimDueItems(db, batchSize)`.
     - Process items with bounded concurrency (`Math.min(concurrency, items.length)`) using `Promise.all` worker lanes rather than a slow sequential `for...of` loop, while preserving deterministic stats aggregation (`claimed`, `published`, `retried`, `failed`).

### 5.3 `apps/worker/src/settlement.ts`
1. Update `settleOutcome(db, outcome)`:
   - In `settleSupabaseOutcome`:
     - If `outcome.targetAccountStatus === 'expired'`, also update `facebook_accounts` (`status = 'expired'`) for the page's parent account or via `facebook_pages` lookup.
     - If `outcome.pageCooldownSeconds` is set, update `facebook_pages.next_allowed_publish_at = new Date(Date.now() + outcome.pageCooldownSeconds * 1000).toISOString()`.
     - When `outcome.status === 'queued'`, schedule retry at `new Date(Date.now() + (outcome.retryDelaySeconds ?? 300) * 1000).toISOString()`.

### 5.4 High-Throughput 200,000 Posts/Day Producer-Consumer Engine (`apps/worker/src/index.ts` & `apps/worker/wrangler.toml`)
To handle **200,000 posts/day** (up to 3,000–5,000 posts/minute during peak `:00` / `:30` scheduling bursts) without hitting Cloudflare Worker subrequest limits:
1. Extend `Env` interface in `apps/worker/src/index.ts`:
   ```ts
   export interface Env {
     SUPABASE_URL?: string;
     SUPABASE_SERVICE_ROLE_KEY?: string;
     DATABASE_URL?: string;
     MASTER_ENCRYPTION_KEY?: string;
     DISPATCH_BATCH_SIZE?: string;
     DISPATCH_MAX_BATCHES_PER_TICK?: string;
     DISPATCH_CONCURRENCY?: string;
     PUBLISH_QUEUE?: {
       sendBatch(messages: Array<{ body: ClaimedQueueItem }>): Promise<void>;
     };
   }
   ```
2. **Producer Path in `scheduled(event, env, ctx)`**:
   - Every 5 minutes (`minute % 5 === 0`), run `db.rpc('recover_stuck_publishing_items', { p_timeout_minutes: 10 })` (ignoring errors if RPC is not mocked in unit tests).
   - If `env.PUBLISH_QUEUE` is bound:
     - Loop up to `maxBatches = Number(env.DISPATCH_MAX_BATCHES_PER_TICK || 5)` times, claiming `batchSize = Number(env.DISPATCH_BATCH_SIZE || 500)` items per iteration (`2,500` items/min capacity).
     - Chunk claimed items into slices of 100 and dispatch via `await env.PUBLISH_QUEUE.sendBatch(slice.map((body) => ({ body })))`.
   - If `env.PUBLISH_QUEUE` is NOT bound (local dev & existing unit tests):
     - Execute `await runDispatchCycle(db, fbClient, env.MASTER_ENCRYPTION_KEY, batchSize, concurrency)` directly so all existing `worker.test.ts` tests pass without modification.
3. **Consumer Path (`async queue(batch, env, ctx)` on default export)**:
   - Add a `queue(batch: { messages: Array<{ body: ClaimedQueueItem; ack(): void; retry(): void }> }, env: Env, ctx: ExecutionContext)` handler to the worker's default export.
   - Process all messages in `batch.messages` in parallel (`Promise.allSettled`), calling `dispatchItem` + `settleOutcome`, and calling `msg.ack()` on completion.
4. Update `apps/worker/wrangler.toml` with documented `[queues.producers]` and `[queues.consumers]` configuration comments and high-throughput defaults (`DISPATCH_BATCH_SIZE = "250"`, `DISPATCH_CONCURRENCY = "25"`).

---

## 6. Phase 4: Media Library & Cloud Downloader Upgrades (`apps/web`)

### 6.1 `apps/web/src/app/api/tenant/[subdomain]/media/route.ts`
1. **Keyset Cursor Pagination + Format Filter**:
   - Parse optional `cursor` (`"createdAt|id"`) and `postFormat` (`'image' | 'reel' | 'video' | 'story'`) from query params.
   - If `cursor` is provided, apply keyset filtering (`created_at < cursorCreatedAt OR (created_at = cursorCreatedAt AND id < cursorId)`) for $O(1)$ index performance at 50,000+ items, while preserving `offset` pagination when `cursor` is omitted.
   - If `postFormat` is provided:
     - `'image'`: filter `media_type = 'image'`
     - `'reel'`: filter `media_type = 'video'` and (`duration_seconds IS NULL OR duration_seconds <= 90`)
     - `'video'`: filter `media_type = 'video'`
     - `'story'`: filter (`media_type = 'image' AND file_size <= 10485760`) OR (`media_type = 'video' AND (duration_seconds IS NULL OR duration_seconds <= 60)`)
   - Include `nextCursor` in the JSON response alongside `items` and `total`.

### 6.2 New Pre-Upload Duplicate Check Endpoint (`apps/web/src/app/api/tenant/[subdomain]/media/check-duplicates/route.ts`)
1. Create `POST /api/tenant/[subdomain]/media/check-duplicates`:
   - Authenticate tenant session via `authenticateTenantRoute`.
   - Validate request body with `CheckDuplicatesRequestSchema`.
   - Query `media_items` for the authenticated `user.id` matching the target `folder_id` (or root `folder_id IS NULL`) and matching `file_size` + case-insensitive `name`.
   - Return `{ duplicates: Array<{ clientKey: string; existingItem: MediaItemResponse }> }` so the frontend detects duplicates across folders with 10,000+ items, not just the first 100 items in memory.

### 6.3 Eliminate Base64 Data-URL Bloat in `apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts`
1. In `PATCH /api/tenant/[subdomain]/media/[mediaId]`:
   - If `parsed.data.thumbnailUrl` is a `data:image/...;base64,...` URL AND `storageService` (`getStorageService()`) is available:
     - Decode the base64 payload into a `Buffer` / `Uint8Array`.
     - Upload it to R2 at key `users/${auth.session.userId}/thumbnails/${mediaId}-${Date.now()}.webp` using `storageService.putObject(...)`.
     - Replace `thumbnailUrl` with the public R2 CDN URL and set `thumbnailKey` before updating `media_items` in PostgreSQL.
     - Only fall back to storing the `data:` URL if `storageService` is unavailable in unit-test environments without R2 env vars.

### 6.4 Batched R2 Deletion in `apps/web/src/app/api/tenant/[subdomain]/media/folders/[folderId]/route.ts`
1. In `DELETE /api/tenant/[subdomain]/media/folders/[folderId]`:
   - Collect all R2 keys (`storage_key` and `thumbnail_key`) across the recursive folder tree.
   - Delete keys in bounded parallel batches of up to 50 concurrent R2 deletes (or batch delete API if supported by `IStorageService`) with `Promise.allSettled` so large folder deletions never time out.

### 6.5 Media Library UI Enhancements (`apps/web/src/components/media/*`)
1. **`MediaAssetCard` (`media-asset-card.tsx`) & `MediaTableRow` (`media-table-row.tsx`)**:
   - Use `getEligiblePostFormatsForMedia(item)` from `@fbuploadpro/contracts` to display compact format eligibility badges (e.g., `Reel`, `Story`, `Video`, `Photo`) on media cards and table rows[cite: 14].
2. **`MediaLibraryExplorer` (`media-library-explorer.tsx`)**:
   - Before uploading a batch, call `POST /api/tenant/[subdomain]/media/check-duplicates` (falling back to client-side `detectDuplicateUploadEntries` if the endpoint is not mocked in unit tests) so duplicates beyond the first 100 items are accurately caught[cite: 14].

---

## 7. Phase 5: Pages & Dedicated Page Section Upgrades (`apps/web`)

### 7.1 `GET /api/tenant/[subdomain]/pages/route.ts` & `GET /api/tenant/[subdomain]/pages/[pageId]/route.ts`
1. **Clean Cooldown Evaluation in `GET /api/tenant/[subdomain]/pages`**:
   - When a page has `status === 'fb_rate_limited'` and `rate_limited_at` is older than 3 days (`72h`), compute its effective status as `'active'` for the response and trigger the DB recovery update asynchronously (non-blocking `void Promise.allSettled(recoveryPromises)`) so `GET` latency is never blocked by write amplification.
2. **Server-Side Queue Status Counts in `GET /api/tenant/[subdomain]/pages/[pageId]`**:
   - Return `queueCounts: { queued: number; publishing: number; published: number; failed: number }` in the response payload so the Dedicated Page Workspace tab badge and KPI cards reflect exact counts even when `queueItems` is paginated.

### 7.2 Publishing Queue Routes (`apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts` & `[itemId]/route.ts`)
1. **`POST /api/tenant/[subdomain]/publishing/queue` (`handleEnqueuePost`)**:
   - Accept `postFormat: 'text' | 'image' | 'reel' | 'video' | 'story'`, optional `mediaId` (`null` when `postFormat === 'text'`), `caption`, `firstComment`, `linkUrl`, and `scheduledTime`[cite: 24].
   - When `postFormat === 'text'`:
     - Do not query `media_items`. Validate that `caption.trim().length > 0`.
   - When `postFormat !== 'text'`:
     - Fetch the media item from `media_items` and validate format compatibility via `validatePostFormatEligibility` (e.g. reject video on `'image'`, reject image on `'reel'`/`'video'`, reject $>90\text{s}$ video on `'reel'`, reject $>60\text{s}$ video or $>10\text{MB}$ image on `'story'`).
   - When `postFormat === 'story'`:
     - Force `first_comment = null` (or return `400 VALIDATION_ERROR` if a non-empty `firstComment` was explicitly submitted and strict validation is requested).
   - Persist `post_format`, `media_id`, `link_url`, `caption`, and `first_comment` into `queue_items` and return `postFormat` and `linkUrl` in the response.
2. **`PATCH /api/tenant/[subdomain]/publishing/queue/[itemId]`**:
   - Allow updating `caption`, `firstComment` (only if `post_format !== 'story'`), `linkUrl`, `postFormat`, and `scheduledTime` on `'queued'` items[cite: 24].
3. **Format-Aware Slot Scheduler (`apps/web/src/lib/slot-scheduler.ts`)**:
   - Update `findNextAvailableSlot` so that if a slot specifies `allowedFormats`, it only matches items whose `postFormat` is included in `allowedFormats` (defaulting to allowing all formats when `allowedFormats` is empty/undefined).

### 7.3 Multi-Format `EnqueueModal` (`apps/web/src/components/pages/dedicated/enqueue-modal.tsx`)
Upgrade `EnqueueModal` to support all 5 formats (`text`, `image`, `reel`, `video`, `story`) while keeping all existing `data-testid` attributes intact[cite: 9]:
1. **Format Selector Bar (`data-testid="enqueue-format-selector"`)**:
   - Render 5 format selector buttons:
     - `data-testid="enqueue-format-reel"` (**Reel**)
     - `data-testid="enqueue-format-video"` (**Video**)
     - `data-testid="enqueue-format-image"` (**Image**)
     - `data-testid="enqueue-format-story"` (**Story**)
     - `data-testid="enqueue-format-text"` (**Text**)
   - Default to `'reel'` (or dynamically switch based on the selected media item if the user clicks a media item in legacy tests before choosing a format: if the user clicks an `'image'` item while on default `'reel'`, automatically set `postFormat` to `'image'` so all existing tests that immediately click a media item and submit continue to pass!).
2. **Format-Specific Form Behavior**:
   - When `postFormat === 'text'`:
     - Hide the Media Library picker grid (`mediaId` is not required).
     - Show `caption` textarea (required) and an optional **Link URL** input (`data-testid="enqueue-link-url-input"`).
     - Show the **First Comment** input (`data-testid="enqueue-first-comment-input"`).
   - When `postFormat === 'image' | 'reel' | 'video'`:
     - Show the Media Library picker filtered to compatible assets (while still rendering all passed `mediaItems` if no filter is active in legacy tests).
     - Show `caption` textarea and optional **First Comment** input (`data-testid="enqueue-first-comment-input"`).
   - When `postFormat === 'story'`:
     - Show the Media Library picker allowing both Story-eligible images ($\le 10\text{ MB}$) and videos ($\le 60\text{s}$).
     - Clear `firstComment` to `''` and hide/disable the First Comment field, rendering an informational notice (`data-testid="story-no-comment-notice"`): *"First comments are not supported on Facebook Stories."*
3. **Submit Payload**:
   - Include `postFormat`, `mediaId: postFormat === 'text' ? null : selectedMediaId`, `caption`, `firstComment: postFormat === 'story' ? null : (firstComment.trim() || null)`, `linkUrl: postFormat === 'text' && linkUrl.trim() ? linkUrl.trim() : null`, and `scheduledTime`.

### 7.4 `PageTabDashboard`, `PageTabQueue`, `PageTabCalendar`, `DedicatedPageHeader`, and `PageTabSettings` (`apps/web/src/components/pages/dedicated/*`)
1. **`PageTabDashboard` (`tab-dashboard.tsx`) & `PageTabQueue` (`tab-queue.tsx`)**[cite: 9]:
   - Extend `PageQueueItemSummary` and `DedicatedQueueItem` with `postFormat?: 'text' | 'image' | 'reel' | 'video' | 'story'`, `linkUrl?: string | null`, and nullable `mediaId?: string | null` / `mediaType?: 'video' | 'image' | null`.
   - Render a format badge (`TEXT`, `IMAGE`, `REEL`, `VIDEO`, `STORY`) on each queue item.
   - For `'text'` posts (where `mediaId` is null), render a clean typography icon thumbnail instead of an `<img>` tag.
   - In `PageTabQueue`'s edit dialog, hide the First Comment input when the item's `postFormat === 'story'`.
2. **`PageTabCalendar` (`tab-calendar.tsx`)**[cite: 9]:
   - Allow viewing and selecting `allowedFormats` (`text`, `image`, `reel`, `video`, `story`) when creating or editing a recurring time slot.
3. **Checkpoint Verification Banner (`page-header.tsx` & `tab-settings.tsx`)**[cite: 9]:
   - When `page.status === 'page_checkpoint'`, render an actionable warning callout (`data-testid="checkpoint-reactivation-banner"`) explaining that Facebook requires verification in the mobile app and providing a **"Mark Verified & Reactivate Page"** button that calls `PATCH /api/tenant/[subdomain]/pages/[pageId]` with `{ status: 'active' }`.

---

## 8. Phase 6: Hybrid DB + Upstash Redis Insights Backend (`apps/web` & `apps/worker`)

### 8.1 Real Upstash Redis REST Integration (`apps/web/src/lib/insights/insights-cache.ts`)
1. Preserve synchronous `get<T>(key: string)` and `set<T>(key: string, data: T, ttlSeconds?: number)` methods backed by the L1 in-memory `Map` so all existing synchronous unit tests pass without change.
2. Add `getOrFetchAsync<T>` / `getAsync<T>(key: string)` and `setAsync<T>(key: string, data: T, ttlSeconds?: number)` methods that:
   - Check L1 in-memory `this.cache` first.
   - When `process.env.UPSTASH_REDIS_REST_URL` and `process.env.UPSTASH_REDIS_REST_TOKEN` are set (and `fetch` is available), execute Upstash REST API requests:
     - `GET ${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}` with `Authorization: Bearer ${UPSTASH_REDIS_REST_TOKEN}`.
     - `POST ${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}?EX=${ttl}` with the serialized JSON entry.
   - Gracefully fall back to the L1 in-memory `Map` if Upstash is unreachable or unconfigured in test environments.

### 8.2 DB-First Hybrid Snapshot Serving (`apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`)
1. In `handleGetInsights`[cite: 3, 36]:
   - Check `insightsCache` (`getAsync` / `get`) first when `!refresh`.
   - Before calling the live Facebook Graph API (or if the live Graph API returns a transient rate-limit error `4`, `17`, `32`, `613`, `80001`), query `page_insights_daily_snapshots` for `user_id` and `fb_page_id` over the requested date range (`7d`, `14d`, `28d`, `90d`).
   - If fresh daily snapshots exist in `page_insights_daily_snapshots` (including today's snapshot) and `!refresh`, assemble the time-series, reactions, and demographics response directly from PostgreSQL snapshots to conserve Graph API BUC quota for 200k/day publishing.
   - Never cache zeroed fallback metrics when an upstream Graph API call fails.

### 8.3 Paginated Worker Insights Sync (`apps/worker/src/insights-sync.ts`)
1. Upgrade `syncDailyPageInsights(db, fbInsightsClient, masterKeyHex, concurrency = 5, batchSize = 200)`[cite: 47]:
   - Support cursor-paginated fetching or configurable `batchSize` so workspaces with thousands of connected Pages do not hit PostgREST's 1,000-row limit or Cloudflare Worker subrequest ceilings.
   - Ensure `savePageSnapshot` updates `current_followers` across all workspace rows sharing `(user_id, fb_page_id)` while preserving `rate_limited_at`.

---

## 9. Phase 7: Exhaustive Verification & Test Suite Requirements

Run and verify all existing and new tests across the monorepo (`pnpm test` / `pnpm typecheck` / `pnpm lint`)[cite: 5]:

1. **`packages/contracts/tests/publishing-contracts.test.ts`**:
   - Test `PostFormatSchema` (`'text'`, `'image'`, `'reel'`, `'video'`, `'story'`).
   - Test `validatePostFormatEligibility` and `getEligiblePostFormatsForMedia` across all 5 formats, verifying:
     - `'text'` succeeds without `media` when `caption` is non-empty, and allows `firstComment`.
     - `'reel'` rejects videos $> 90\text{s}$ and allows `firstComment`.
     - `'video'` accepts $16:9$, $1:1$, and $9:16$ videos of any duration and allows `firstComment`.
     - `'story'` accepts images $\le 10\text{ MB}$ and videos $\le 60\text{s}$, and strictly rejects non-empty `firstComment`.
2. **`apps/worker/tests/dispatcher.test.ts`, `fb-client.test.ts`, & `settlement.test.ts`**:
   - Test `FacebookPublishClient` & `MockFacebookPublishClient` for:
     - `publishTextPost` (`POST /{page-id}/feed` with `message` and optional `link`)
     - `publishPhoto` (`POST /{page-id}/photos`)
     - `publishReel` (3-phase `/{page-id}/video_reels`)
     - `publishVideo` (`POST /{page-id}/videos`)
     - `publishPhotoStory` (`POST /{page-id}/photos` with `published: false` $\rightarrow$ `POST /{page-id}/photo_stories`)
     - `publishVideoStory` (3-phase `/{page-id}/video_stories`)
   - Test `dispatchItem` routing for all 5 formats (`text`, `image`, `reel`, `video`, `story`), verifying that `firstComment` is posted when provided on `text`, `image`, `reel`, and `video`, and is **never** posted on `story`.
   - Test `parseGraphRateLimitHeaders` extracting `estimated_time_to_regain_access` from `X-Business-Use-Case-Usage` and setting `retryDelaySeconds` and `pageCooldownSeconds`.
   - Test OAuth error `190` (non-492) setting `targetAccountStatus: 'expired'` and cascading to `facebook_accounts.status = 'expired'` in `settlement.ts`.
   - Test parallel batch execution in `runDispatchCycle` and Cloudflare Queue producer/consumer handling in `worker.test.ts`.
3. **`apps/web/tests/`**:
   - Test `EnqueueModal` switching across all 5 formats (`reel`, `video`, `image`, `story`, `text`), verifying that:
     - Selecting `text` hides the media picker and enables `linkUrl` + `firstComment`.
     - Selecting `story` hides/disables `firstComment` and displays `data-testid="story-no-comment-notice"`.
   - Test `POST /api/tenant/[subdomain]/publishing/queue` enqueuing all 5 formats (`text` with `mediaId: null`, `image`, `reel`, `video`, and `story` with `firstComment: null`).
   - Test `POST /api/tenant/[subdomain]/media/check-duplicates` detecting duplicate files across large folders.
   - Confirm 100% of existing tests in `packages/contracts`, `apps/worker`, and `apps/web` pass with zero regressions.
