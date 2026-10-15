# Research & Architecture Decisions: Platform Audit Remediation (Spec 045)

**Feature Branch**: `fix/045-platform-audit-remediation`  
**Date**: 2026-10-15  

This document details the architectural decisions and technical resolutions for all 42 issues in [`issues.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/sync_latest_main_code/issues.md).

---

## 1. Publishing Engine & Scale Architecture (Module 2 & 5)

### Decision 1.1: 5-Format Queue Schema & Storage Model
- **Context**: `public.queue_items` has `media_id UUID NOT NULL` and only supports `video` and `image`.
- **Resolution**:
  - `ALTER TABLE public.queue_items ALTER COLUMN media_id DROP NOT NULL;`
  - Add `post_format TEXT NOT NULL DEFAULT 'reel' CHECK (post_format IN ('text', 'image', 'reel', 'video', 'story'))`.
  - Add `link_url TEXT`.
  - Add check constraint: `chk_queue_items_format_media CHECK ((post_format = 'text' AND media_id IS NULL) OR (post_format <> 'text' AND media_id IS NOT NULL))`.
  - Add check constraint: `chk_queue_items_story_no_comment CHECK (post_format <> 'story' OR first_comment IS NULL)`.

### Decision 1.2: Graph API v26.0 Multi-Format Publishers
- **Context**: `FacebookPublishClient` only implements `publishReel`, `publishPhoto`, and `postComment`.
- **Resolution**:
  - `publishTextPost(pageId, pageToken, message, link)`: `POST /{page-id}/feed` with `message` and optional `link`.
  - `publishVideo(pageId, pageToken, fileUrl, title, description)`: `POST /{page-id}/videos` with `file_url`, `title`, `description`.
  - `publishPhotoStory(pageId, pageToken, fileUrl)`: `POST /{page-id}/photos` with `published: false` returning `{ id: photoId }`, followed by `POST /{page-id}/photo_stories` with `photo_id`.
  - `publishVideoStory(pageId, pageToken, fileUrl)`: 3-phase upload session with `POST /{page-id}/video_stories` (`upload_phase=start`), transfer binary chunk (`upload_phase=transfer`), and finish (`upload_phase=finish`).

### Decision 1.3: 200k Posts/Day Throughput & Queue Fan-Out
- **Context**: The cron worker claims 10 items sequentially per minute ($14,400\text{ posts/day}$).
- **Resolution**:
  - Increase claim batch size to 100 items per minute.
  - Fan out claimed items into Cloudflare Queues (`PUBLISH_QUEUE`).
  - Worker queue consumer processes items concurrently using bounded concurrency (`p-limit` / `Promise.allSettled`).
  - If `queue.sendBatch` throws an exception, all claimed IDs in that chunk are immediately reverted to `status = 'queued'` in a single atomic database update.

### Decision 1.4: Fair-Share Claim Partitioning & Stuck Item Recovery
- **Context**: `claim_due_queue_items` scanned globally by `scheduled_time ASC`, allowing one page to monopolize the entire batch and trigger Meta rate limits.
- **Resolution**:
  - Rewrite `claim_due_queue_items(p_limit INT, p_max_per_page INT DEFAULT 3)` using window function:
    `ROW_NUMBER() OVER (PARTITION BY qi.fb_page_id ORDER BY qi.scheduled_time ASC) <= p_max_per_page`.
  - Exclude Pages where `facebook_pages.next_allowed_publish_at > now()`.
  - Decouple stuck publishing recovery into `recover_stuck_publishing_items(p_timeout_minutes INT DEFAULT 10)`.

### Decision 1.5: Pacing & Adaptive Backoff from Meta Headers
- **Context**: Retries hardcode a 5-minute delay and ignore `X-Business-Use-Case-Usage`.
- **Resolution**:
  - Parse `X-Business-Use-Case-Usage` and `X-App-Usage` headers in `FacebookPublishClient`.
  - Extract `estimated_time_to_regain_access` and calculate `next_allowed_publish_at`.
  - Store `next_allowed_publish_at` and `buc_usage_pct` on `facebook_pages`.
  - When rate limited (`80001`, `4`, `17`, `32`, `341`, `613`), defer all sibling queued items for that Page until `next_allowed_publish_at`.

### Decision 1.6: Transcoding Race Protection for First Comments
- **Context**: `postComment` immediately after video/reel publishing fails with `code: 100` while transcoding finalizes.
- **Resolution**:
  - Wrap `postComment` in a bounded exponential backoff loop (3 attempts, 3s delay).
  - If comment still fails, record main post as `published` (saving `fb_post_id`) and log a partial warning in `publish_logs` rather than retrying and duplicating the video.

---

## 2. Facebook Accounts & OAuth Integrity (Module 1)

### Decision 2.1: Atomic Parent Account Status Cascade
- **Context**: When child Page hits invalid token (`190`, `102`, `10`, `200–299`), parent account remains `active`.
- **Resolution**:
  - Single atomic RPC `settle_queue_item_outcome`:
    When error is classified as `accountStatus === 'expired'`, the RPC executes:
    `UPDATE public.facebook_accounts SET status = 'expired', updated_at = now() WHERE id = v_account_id AND user_id = v_user_id;`
    alongside updating `facebook_pages.status = 'invalid_token'`.

### Decision 2.2: Zero Plumbing Error Leaks in Auth & BYOC
- **Context**: Sockets and proxy errors leak raw system traces to client JSON responses.
- **Resolution**:
  - Pipe caught errors through `sanitizeAuthErrorMessage(err.message, fallback)` in `apps/web/src/app/api/auth/facebook/route.ts` and `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/test/route.ts`.

### Decision 2.3: Production Master Encryption Key Guard
- **Context**: `DEV_FALLBACK_ENCRYPTION_KEY` silently used in production if key is missing.
- **Resolution**:
  - Add explicit runtime guard in `packages/contracts/src/crypto/token.ts`:
    `if (process.env.NODE_ENV === 'production' && (!masterKey || masterKey === DEV_FALLBACK_ENCRYPTION_KEY)) throw new DomainError(DomainErrorCode.INTERNAL_ERROR, 'Encryption master key missing in production');`

### Decision 2.4: Non-Optimistic BYOC UI Initialization & Retry Banner
- **Context**: `byocStatus` initializes to `{ isConfigured: true, isLoading: true }`, allowing premature clicks.
- **Resolution**:
  - Initialize to `{ isConfigured: false, isLoading: true, error: null }`.
  - Gate connect trigger until `isLoading === false`.
  - On `500` or network failure, retain `isConfigured` value and render a non-blocking retry banner.

### Decision 2.5: Proactive Token Expiration Warning
- **Context**: 60-day tokens expire without warning until hard failure.
- **Resolution**:
  - Add `expiring_soon` filter to `AccountsFilterBar`.
  - Surface days-remaining countdown and a re-authentication CTA when token expires in $\le 7$ days.

---

## 3. Media Library, Upload Pipeline & Storage (Module 3)

### Decision 3.1: Keyset Cursor Pagination
- **Context**: Offset pagination shifts rows during mutations and degrades at $O(N)$ index scans.
- **Resolution**:
  - Use `cursor` formatted as `createdAt|id`.
  - Query: `WHERE (created_at, id) < (cursor_created_at, cursor_id) ORDER BY created_at DESC, id DESC LIMIT 100`.

### Decision 3.2: Full-Folder Duplicate Detection
- **Context**: Client duplicate check only inspected first 100 items in memory.
- **Resolution**:
  - Endpoint `POST /api/tenant/[subdomain]/media/check-duplicates` queries `media_items` across the entire target folder by `(LOWER(name), file_size, folder_id)`.

### Decision 3.3: Direct R2 WebP Thumbnail Uploads
- **Context**: Base64 `data:` URLs stored in `thumbnail_url` bloat PostgreSQL buffers.
- **Resolution**:
  - Client captures video frame and uploads WebP blob to Cloudflare R2 presigned URL (`users/{userId}/thumbnails/{mediaId}.webp`).
  - Reject `data:` base64 URLs in `UpdateMediaRequestSchema` in production.

### Decision 3.4: Pixel Dimensions & Format Eligibility
- **Context**: `media_items` lacks `width` and `height`, preventing format validation.
- **Resolution**:
  - Extract `videoWidth`/`videoHeight` and `naturalWidth`/`naturalHeight` during file probing.
  - Persist `width` and `height` columns on `media_items`.
  - Validate candidate format using `@fbuploadpro/contracts` `validatePostFormatEligibility`.

### Decision 3.5: Chunked Bounded R2 Object Deletions
- **Context**: Synchronous single-object R2 deletes in folder cascades trigger gateway timeouts.
- **Resolution**:
  - Batch R2 keys into chunks (up to 1,000 keys) and execute via `Promise.allSettled` with bounded concurrency before deleting database folder subtree.

---

## 4. Cloud Media Downloader (Module 4)

### Decision 4.1: Pre-Stream Header Validation & Abort Guard
- **Context**: Streaming up to 500 MB without pre-stream checks triggers isolate OOM crashes.
- **Resolution**:
  - Execute pre-stream `HEAD` (or inspect initial `GET` headers) checking `Content-Length <= 524,288,000` bytes.
  - Pipe response body through byte-counting `TransformStream` that aborts if cumulative bytes exceed 500 MB.

### Decision 4.2: Fail-Fast Polling on Fatal Status Codes
- **Context**: `if (!pollRes.ok) continue;` retries 60 times even on `401`, `403`, `404`.
- **Resolution**:
  - Fail immediately and surface error if status is `401`, `403`, or `404`.
  - Only retry on transient `5xx` up to a small consecutive error threshold (3).

### Decision 4.3: Per-Download Cancellation & Stage Feedback
- **Context**: No cancel button and no stage indicator during 90-second polling.
- **Resolution**:
  - Pass `AbortSignal` to cancel running job.
  - Expose stage (`resolving` vs. `streaming`) in status endpoint and UI.

---

## 5. Insights Analytics & Caching (Module 6)

### Decision 5.1: Real Upstash Redis REST Caching
- **Context**: `InsightsCache` was an in-memory `Map` stub that lost state across serverless instances.
- **Resolution**:
  - Implement Upstash Redis REST commands (`GET`, `SET ... EX`) when credentials exist, using in-memory `Map` strictly as L1 fallback.

### Decision 5.2: Database Snapshot Prioritization
- **Context**: `GET /pages/[pageId]/insights` hit live Graph API on every cache miss.
- **Resolution**:
  - Read persisted metrics from `page_insights_daily_snapshots` first for date window (`7d`, `14d`, `28d`, `90d`).
  - Only call Graph API on cache/snapshot miss or when `?refresh=true`.

### Decision 5.3: Error Propagation & Zero-Metric Cache Prevention
- **Context**: Graph API failures returned 0 metrics and cached them for 15 minutes.
- **Resolution**:
  - Propagate errors as degraded; never write zeroed error fallbacks into cache or assign `s-maxage=900`.

### Decision 5.4: Dual Trajectory Chart & Design System Skeleton
- **Context**: Chart only plotted followers despite title claiming views; loading state was plain text; progress bars had filled tracks.
- **Resolution**:
  - Plot both Followers and Impressions/Views.
  - Use structured skeleton loader matching KPI and chart card.
  - Remove filled background tracks on comparison bars.

---

## 6. Dedicated Page Workspace & UI Controls (Module 2)

### Decision 6.1: Elimination of Write Amplification on Read
- **Context**: `GET /api/tenant/[subdomain]/pages` executed synchronous `UPDATE` statements on read.
- **Resolution**:
  - Remove `UPDATE` queries from `handleListPages`.
  - Evaluate effective cooldown status in-memory via `evaluatePageHealth`.

### Decision 6.2: Removal of Placeholder Follower Data
- **Context**: `DedicatedPageView` initialized follower count to fake `12,360`.
- **Resolution**:
  - Initialize starting metrics to `0` or fetch genuine database record.

### Decision 6.3: Format-Aware Slot Scheduling
- **Context**: `page_queue_slots` did not distinguish between formats.
- **Resolution**:
  - Add `allowed_formats TEXT[]` to `page_queue_slots`.
  - Filter slots in `calculateNextVacantSlot` by `postFormat`.

### Decision 6.4: Timestamp Validation Guard
- **Context**: Invalid date strings caused unhandled `RangeError` 500s.
- **Resolution**:
  - Validate with `Number.isNaN(new Date(time).getTime())` and return 400 `ValidationError` before `.toISOString()`.

### Decision 6.5: Page Checkpoint Banner & 1-Click Reactivation
- **Context**: Pages with `page_checkpoint` had no instructional banner or reactivation button.
- **Resolution**:
  - Render warning callout in header and settings with 1-click CTA calling `PATCH /pages/${id}` with `{ status: 'active' }`.

---

## 7. Cross-Cutting Auth, RBAC & Theme Cleanliness (Module 7)

### Decision 7.1: Strict Theme Token Enforcement on StatusDot
- **Context**: `status-dot.tsx` used hardcoded hex literal `#848e9c` and missing micro-halo.
- **Resolution**:
  - Import `STATUS_SIGNALS` from `@/lib/theme` and eliminate all hardcoded hex strings.

### Decision 7.2: Public Voice Error Copy
- **Context**: Forgot-password error mentioned registration; `assertRole` leaked enum identifiers.
- **Resolution**:
  - Use `"Unable to initiate password reset at this moment. Please try again shortly."` for password reset.
  - Map `FORBIDDEN` to `"You don't have permission to perform this action in this workspace."`.

### Decision 7.3: Removal of Legacy Client Branches
- **Context**: API routes branched on `isLegacyClient` to call raw SQL `db.query`.
- **Resolution**:
  - Remove `isLegacyClient` and `db.query` calls.
  - Migrate all tests to typed `@supabase/supabase-js` mocks.

### Decision 7.4: StrictMode Fetch Guard
- **Context**: `WorkspaceLifecycleGuard` monkey-patched `window.fetch` without unmount cleanup or double-wrap guard.
- **Resolution**:
  - Add cleanup function restoring `window.fetch = originalFetch` and use symbol property to prevent double-wrapping.
