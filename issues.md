# Platform Audit Remediation Status

> **STATUS: 100% REMEDIATED (Spec 045)**  
> All 42 issues across the 7 modules below have been systematically remediated and verified under Spec 045 (`specs/045-platform-audit-remediation/`) on branch `fix/045-platform-audit-remediation`.

---

## Module 1: Facebook Accounts & BYOC OAuth

**Scope:** `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx`, `apps/web/src/components/accounts/*`, `apps/web/src/app/api/tenant/[subdomain]/accounts/*`, `apps/web/src/app/api/auth/facebook/*`, `apps/web/src/app/connect/facebook/*`, `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/*`, `packages/contracts/src/crypto/token.ts`

### Code & Logic Bugs

* **[CRITICAL] Missing Parent Account Status Cascade on OAuth Errors (`190`, `102`, `10`, `200–299`)**

* **Location:** `apps/worker/src/settlement.ts` (`settleOutcome`) & `apps/worker/src/dispatcher.ts` (`recordDispatchOutcome`).


* **Bug:** When `evaluateGraphApiError` evaluates OAuth/permission failure codes (`190`, `102`, `10`, `200–299`), it returns `accountStatus: 'expired'` and `pageStatus: 'invalid_token'`. However, the settlement logic only updates `facebook_pages.status = 'invalid_token'` and fails to update the parent `facebook_accounts.status = 'expired'`. As a result, `TenantAccountsPage` continues to show the parent Facebook account as `'active'` while its child Pages fail with invalid tokens.


* **Exact Fix:** Replace multi-query settlement in `settlement.ts` and `dispatcher.ts` with a single atomic PostgreSQL RPC `settle_queue_item_outcome` that accepts `p_account_status` and updates `public.facebook_accounts SET status = 'expired', updated_at = now() WHERE id = v_account_id AND user_id = v_user_id` whenever `accountStatus === 'expired'`.




* **[HIGH] Unsanitized Error Leak in Facebook Auth & BYOC Connection Test Routes**

* **Location:** `apps/web/src/app/api/auth/facebook/route.ts` (and `logout/route.ts`) & `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/test/route.ts`.


* **Bug:** The catch block in `apps/web/src/app/api/auth/facebook/route.ts` returns `error instanceof Error ? error.message : 'Logout failed'` directly in the `500` JSON response, and `settings/byoc/test/route.ts` returns `netErr instanceof Error ? netErr.message : 'Network failure testing connection.'` directly in the response body. If a socket timeout, DNS resolution error, or local proxy refusal (`ECONNREFUSED`, `127.0.0.1`, `socket timed out`) occurs, raw technical plumbing leaks to the UI in violation of `sanitizeAuthErrorMessage` and the Constitution's Zero Technical Plumbing Leaks rule.


* **Exact Fix:** Pass all caught error messages through `sanitizeAuthErrorMessage(err.message, 'Unable to verify connection right now. Please try again shortly.')` from `apps/web/src/lib/auth-errors.ts` before returning `NextResponse.json`.




* **[HIGH] Hardcoded Fallback Encryption Key in Token Crypto Module**

* **Location:** `packages/contracts/src/crypto/token.ts` (`DEV_FALLBACK_ENCRYPTION_KEY`).


* **Bug:** `packages/contracts/src/crypto/token.ts` defines `const DEV_FALLBACK_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'`. Under the Constitution's "Zero Silent Fallback to Mocks" mandate, production environments (`NODE_ENV === 'production'`) must never fall back to hardcoded secrets if `FB_ENCRYPTION_MASTER_KEY` is missing.


* **Exact Fix:** Enforce an explicit runtime guard in `encryptToken` / `decryptToken` (`packages/contracts/src/crypto/token.ts`) that throws a `DomainError` (`INTERNAL_ERROR`) if `masterKey` is missing or equals `DEV_FALLBACK_ENCRYPTION_KEY` when `process.env.NODE_ENV === 'production'`.




* **[MEDIUM] Premature Optimistic `byocStatus.isConfigured` Initial State**

* **Location:** `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` (`TenantAccountsPage`).


* **Bug:** `byocStatus` initializes to `{ isConfigured: true, isLoading: true }`. If a user clicks "Connect Account" before `checkByoc()` resolves, `handleOpenNewConnect` sees `isConfigured: true` and bypasses the BYOC credential advisory prompt (`isByocPromptOpen`).


* **Exact Fix:** Initialize `byocStatus` to `{ isConfigured: false, isLoading: true }` and disable or gate the connect trigger while `byocStatus.isLoading` is `true`.





### Unhandled Real-World Edge Cases

* **[MEDIUM] Silent Swallowing of `/api/tenant/[subdomain]/settings/byoc` Failures**

* **Location:** `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` (`checkByoc` inside `useEffect`).


* **Edge Case:** When `fetch('/api/tenant/${subdomain}/settings/byoc')` fails due to a transient network error or `500` server error, the `catch` block silently sets `setByocStatus({ isConfigured: false, isLoading: false })` without logging or surfacing a retryable warning. Operators who have already configured valid BYOC credentials are erroneously prompted to configure BYOC again during transient network drops.


* **Exact Fix:** Track an `error` property on `byocStatus` (`{ isConfigured: boolean; isLoading: boolean; error: string | null }`) and display a non-blocking retry banner if the status check fails with `res.status >= 500` or a network exception.





### Missing UI Elements & States

* **[LOW] Missing `expiring_soon` / Token Health Warning Filter & Indicator in `AccountsFilterBar**`

* **Location:** `apps/web/src/app/tenant/[subdomain]/accounts/page.tsx` (`AccountsFilterBar`).


* **Missing State:** `FILTER_TABS` only provides `all`, `active`, and `expired` (`AccountStatusFilter`). Although `evaluateTokenExpiry` and `evaluateAccountHealth` exist in `@fbuploadpro/contracts`, operators have no filter or proactive warning state for accounts whose 60-day OAuth tokens are approaching expiration before they hard-fail with code `190`.


* **Exact Fix:** Surface token expiry countdown metadata on `AccountCard` and add a proactive re-authentication CTA when an account token is within 7 days of expiration.





---

## Module 2: Facebook Pages & Dedicated Page Section

**Scope:** `apps/web/src/app/tenant/[subdomain]/pages/page.tsx`, `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`, `apps/web/src/components/pages/*`, `apps/web/src/components/pages/dedicated/*`, `apps/web/src/app/api/tenant/[subdomain]/pages/*`, `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/*`

### Code & Logic Bugs

* **[CRITICAL] Hardcoded Media-Only Queue Schema Blocks Text Posts, Feed Videos & Page Stories**

* **Location:** `supabase/migrations/*` (`queue_items`), `apps/web/src/components/pages/dedicated/tab-dashboard.tsx`, `apps/web/src/components/pages/dedicated/tab-queue.tsx`, `EnqueueModal`, and `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts`.


* **Bug:** `queue_items.media_id` is constrained as `UUID NOT NULL`, and the UI components (`EnqueueModal`, `PageTabDashboard`, `PageTabQueue`) only support `mediaType: 'video' | 'image'`. Users cannot schedule or publish **Text/Link posts** (`media_id = NULL`), cannot choose between publishing a video as a **Reel** vs. a standard **Feed Video**, and cannot schedule **Photo Stories** or **Video Stories**.


* **Exact Fix:**
1. Alter `public.queue_items` to make `media_id` nullable, add `post_format TEXT NOT NULL DEFAULT 'reel' CHECK (post_format IN ('text', 'image', 'reel', 'video', 'story'))`, add `link_url TEXT`, and add constraint `chk_queue_items_format_media` (`(post_format = 'text' AND media_id IS NULL) OR (post_format <> 'text' AND media_id IS NOT NULL)`).


2. Update `EnqueueModal`, `PageTabDashboard`, and `PageTabQueue` to support selecting all 5 canonical formats (`text`, `image`, `reel`, `video`, `story`) and validate format eligibility via `validatePostFormatEligibility`.






* **[CRITICAL] First Comment Allowed on Unsupported Story Format**

* **Location:** `EnqueueModal`, `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts`, and `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/route.ts`.


* **Bug:** Facebook Page Stories (`/{page-id}/photo_stories` and `/{page-id}/video_stories`) do not support comments via the Graph API, yet `EnqueueModal` and `queue_items` allow setting `first_comment` on all items. When the worker attempts to call `postComment` on a Story post ID, Facebook returns a permanent Graph API error (`code: 100`).


* **Exact Fix:** Hide/disable the `firstComment` input in `EnqueueModal` when `postFormat === 'story'`, enforce `first_comment = NULL` in `EnqueueMediaRequestSchema` / `UpdateQueueItemRequestSchema`, and add database constraint `chk_queue_items_story_no_comment CHECK (post_format <> 'story' OR first_comment IS NULL)`.




* **[HIGH] Read-Request Write Amplification in `GET /api/tenant/[subdomain]/pages**`

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/pages/route.ts` (`handleListPages`).


* **Bug:** `handleListPages` evaluates 3-day `fb_rate_limited` cooldowns and executes `UPDATE facebook_pages SET status = 'active', rate_limited_at = NULL` writes synchronously inside the `GET` handler on every page list load.


* **Exact Fix:** Remove synchronous `UPDATE` queries from the `GET` path or move cooldown expiration recovery into the background worker cron and evaluate effective status cleanly via `evaluatePageHealth` on read.




* **[HIGH] Hardcoded Dummy Follower Data in `DedicatedPageView` State Initialization**

* **Location:** `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` (`useState<FacebookPageItem null |>`).


* **Bug:** When `pageNameProp` is provided without `initialPage`, the state initializer returns a fabricated object with fake metrics (`startingFollowers: 12360, currentFollowers: 12500, followersGained: 140, status: 'active', createdAt: '2026-10-01T00:00:00.000Z'`). This violates the Constitution's "Zero Tolerated Stubs or Placeholder Code / Fail-Fast over Fake Success" rule.


* **Exact Fix:** Initialize `startingFollowers`, `currentFollowers`, and `followersGained` to `0` (or fetch the real page record from `/api/tenant/${subdomain}/pages/${pageId}`) instead of displaying hardcoded dummy numbers.




* **[MEDIUM] Format-Blind Recurring Publishing Slots (`page_queue_slots`)**

* **Location:** `apps/web/src/lib/slot-scheduler.ts` (`calculateNextVacantSlot`) & `page_queue_slots` table.


* **Bug:** `page_queue_slots` only tracks `slot_time`, `timezone`, and `is_active`. Operators cannot dedicate specific recurring time slots to specific formats (e.g., `09:00` for Stories, `13:00` for Reels, `18:00` for Feed Videos/Text).


* **Exact Fix:** Add `allowed_formats TEXT[]` (or `post_format`) to `page_queue_slots` and filter candidate slots in `calculateNextVacantSlot` by the queued item's `postFormat`.





### Unhandled Real-World Edge Cases

* **[MEDIUM] Unhandled `RangeError: Invalid time value` in `resolveScheduledTime**`

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/route.ts` (`resolveScheduledTime`).


* **Edge Case:** `resolveScheduledTime` calls `new Date(requestedTime).toISOString()` directly without checking if the parsed timestamp is valid (`Number.isNaN(parsed.getTime())`). If an invalid date string slips past or comes from a legacy database row in `existingTime`, `toISOString()` throws an unhandled `RangeError` resulting in a `500` error instead of a `400` validation error.


* **Exact Fix:** Validate with `const d = new Date(requestedTime); if (Number.isNaN(d.getTime())) throw new ValidationError('Invalid scheduledTime');` before calling `.toISOString()`.




* **[MEDIUM] Client-Side Queue Counter Drift & Unpaginated Queue State**

* **Location:** `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx` & `apps/web/src/components/pages/dedicated/tab-queue.tsx`.


* **Edge Case:** The Queue tab badge (`Queue (${queueItems.filter((i) => i.status === 'queued').length})`) and `PageTabQueue` status filter counters are computed entirely from the client-side `queueItems` array in memory. For Pages with hundreds of historical published/failed items, unpaginated fetching degrades load time, or if the API limits returned rows, the badge count becomes inaccurate.


* **Exact Fix:** Return server-side aggregated status counts (`queuedCount`, `publishedCount`, `failedCount`) alongside paginated queue items in `GET /api/tenant/[subdomain]/publishing/queue`.





### Missing UI Elements & States

* **[HIGH] Missing Checkpoint Verification Banner & 1-Click Reactivation Button (`status = 'page_checkpoint'`)**

* **Location:** `DedicatedPageHeader` and `PageTabSettings` (`apps/web/src/components/pages/dedicated/*`).


* **Missing UI State:** When a Page hits Facebook Graph error `368` with subcode `4854002` (`page_checkpoint`), `evaluatePageHealth` keeps the Page in `'page_checkpoint'` indefinitely until the operator completes verification in the Facebook mobile app and manually reactivates the Page. However, `DedicatedPageHeader` and `PageTabSettings` lack a dedicated checkpoint instructional banner and a 1-click **"Reactivate Page"** button.


* **Exact Fix:** Render a prominent warning callout in `DedicatedPageHeader` and `PageTabSettings` when `page.status === 'page_checkpoint'` explaining that mobile verification is required, paired with a 1-click button that calls `PATCH /api/tenant/${subdomain}/pages/${page.id}` with `{ status: 'active' }`.




* **[LOW] Missing `skipped` and `cancelled` Status Filters in `PageTabQueue**`

* **Location:** `apps/web/src/components/pages/dedicated/tab-queue.tsx` (`PageTabQueue`).


* **Missing UI State:** `PageQueueItemSummary['status']` defines `'queued' | 'publishing' | 'published' | 'failed' | 'skipped' | 'cancelled'`, but the filter bar in `PageTabQueue` only renders buttons for `(['all', 'queued', 'published', 'failed'] as const)`. Operators cannot filter specifically for `skipped` or `cancelled` posts.


* **Exact Fix:** Add `'skipped'` and `'cancelled'` filter options (or a "Skipped / Cancelled" filter tab) to `PageTabQueue`.





---

## Module 3: Media Library & Batch Upload Pipeline

**Scope:** `apps/web/src/components/media/*`, `apps/web/src/app/api/tenant/[subdomain]/media/*`, `apps/web/src/lib/storage.ts`

### Code & Logic Bugs

* **[CRITICAL] Offset Pagination Drift & $O(N)$ Index Scan Degradation**

* **Location:** `apps/web/src/components/media/media-library-explorer.tsx` (`MediaLibraryExplorer`) & `apps/web/src/app/api/tenant/[subdomain]/media/route.ts` (`handleListMedia`).


* **Bug:** `MediaLibraryExplorer` paginates with `MEDIA_PAGE_LIMIT = 100` using `query.set('offset', String(mediaItems.length))`. When items are uploaded, deleted, or moved across folders while browsing, `mediaItems.length` shifts, causing `OFFSET` queries to skip rows or return duplicate rows in the UI. At 10,000+ media items, PostgreSQL `OFFSET` scans and discards thousands of index entries on every request.


* **Exact Fix:** Implement keyset cursor pagination (`cursor` formatted as `createdAt|id`) in `MediaListQuerySchema`, `handleListMedia`, and `MediaLibraryExplorer`, querying `(created_at, id) < (cursor_created_at, cursor_id)` ordered by `created_at DESC, id DESC`.




* **[HIGH] Client-Side Duplicate Detection Blind Spot Beyond 100 Items**

* **Location:** `apps/web/src/components/media/media-library-explorer.tsx` (`detectDuplicateUploadEntries`).


* **Bug:** `detectDuplicateUploadEntries` compares queued uploads (`LOWER(name)` and `fileSize`) strictly against the `mediaItems` array currently loaded in browser memory. Because only the first 100 items in a folder are fetched initially, duplicates matching existing files at position 101+ in PostgreSQL are completely missed.


* **Exact Fix:** Before starting an upload batch in `MediaLibraryExplorer`, call `POST /api/tenant/${subdomain}/media/check-duplicates` (`apps/web/src/app/api/tenant/[subdomain]/media/check-duplicates/route.ts`) with the batch's `{ name, fileSize, folderId }` list so PostgreSQL checks the entire target folder across all rows.




* **[HIGH] Base64 `data:` URL Thumbnail Bloat in PostgreSQL**

* **Location:** `MediaPreviewModal` (`captureVideoFrameAsWebp`) and `apps/web/src/app/api/tenant/[subdomain]/media/[mediaId]/route.ts` (`handleUpdateMedia`).


* **Bug:** `MediaPreviewModal` and `PATCH /api/tenant/[subdomain]/media/[mediaId]` allow persisting raw `data:image/webp;base64,...` strings directly into `media_items.thumbnail_url` as a fallback. Storing multi-kilobyte base64 blobs in `thumbnail_url` bloats every `GET /api/tenant/[subdomain]/media` list payload and degrades PostgreSQL shared buffer performance.


* **Exact Fix:** Upload captured WebP frame blobs to Cloudflare R2 (`users/{userId}/thumbnails/{mediaId}.webp`) via presigned upload URL and reject raw `data:` URLs in `UpdateMediaRequestSchema` in production (allowing only `https://` URLs).




* **[HIGH] Missing Pixel Dimensions (`width`, `height`) & Post Format Eligibility Validators**

* **Location:** `media_items` schema, `apps/web/src/app/api/tenant/[subdomain]/media/confirm/route.ts`, and `packages/contracts/src/domain/media.ts`.


* **Bug:** `media_items` only tracks `media_type` (`'video' | 'image'`), `duration_seconds`, and `aspect_ratio` (`'9:16' | '16:9' | '1:1'`), lacking `width`, `height`, and format eligibility validation to distinguish between a **Reel** ($9:16$ vertical video, $3\text{–}90\text{s}$, min $540\times960$), a **Feed Video** (any aspect ratio, up to $500\text{ MB}$), an **Image Post**, and a **Page Story** (image $\le 10\text{ MB}$ or vertical video $\le 60\text{s}$).


* **Exact Fix:** Extract `videoWidth`/`videoHeight` and `naturalWidth`/`naturalHeight` during browser metadata probing, persist `width` and `height` on `media_items`, and enforce `validatePostFormatEligibility` in `@fbuploadpro/contracts`.





### Unhandled Real-World Edge Cases

* **[HIGH] Synchronous Unbatched R2 Deletes in Cascading Folder Deletion Risk Gateway Timeouts**

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/media/folders/[folderId]/route.ts` (`handleDeleteFolder`).


* **Edge Case:** `DELETE /api/tenant/[subdomain]/media/folders/[folderId]` resolves the folder subtree via `WITH RECURSIVE` and deletes R2 objects (`storage_key` and `thumbnail_key`) synchronously one-by-one before deleting database rows. Deleting a folder with 500+ videos will exceed serverless HTTP execution timeouts, leaving half-deleted R2 objects and failing the folder deletion.


* **Exact Fix:** Batch R2 object deletions using chunked `Promise.allSettled` (or S3/R2 `DeleteObjectsCommand` in batches of up to 1,000 keys) with bounded concurrency before removing the database folder subtree.





### Missing UI Elements & States

* **[LOW] Missing Per-File Failure Reason Breakdown in `UploadQueueBanner**`

* **Location:** `apps/web/src/components/media/...` (`UploadQueueBanner`).


* **Missing UI State:** When one or more files in a batch fail to upload, `UploadQueueBanner` renders `{state.failedFiles} files could not be uploaded` and a `Retry Failed (${state.failedFiles})` button (`data-testid="retry-failed-uploads-btn"`), but does not expose why specific files failed (e.g., file exceeds 500 MB vs. network timeout vs. corrupted media header).


* **Exact Fix:** Attach a human-readable `failureReason` to each `QueuedUploadEntry` in `failedEntries` and render an expandable tooltip or summary list in `UploadQueueBanner` so the user knows whether retrying will succeed.





---

## Module 4: Cloud Media Downloader (Frontend & Backend)

**Scope:** `apps/web/src/components/media/*` (`executeDownloaderBatch`, `pollDownloadJobCompletion`), `apps/web/src/app/api/tenant/[subdomain]/media/downloader/route.ts`, `apps/web/src/lib/media-downloader.ts`, `apps/worker/src/services/downloader-engine.ts`

### Code & Logic Bugs

* **[HIGH] Unbounded Memory & Missing Pre-Stream `HEAD` / `Content-Length` Enforcement**

* **Location:** `apps/web/src/lib/media-downloader.ts` & `apps/worker/src/services/downloader-engine.ts`.


* **Bug:** `apps/web/src/lib/media-downloader.ts` permits remote files up to `MAX_MEDIA_DOWNLOAD_BYTES = 524_288_000` (500 MB). Without strict pre-stream `HEAD` / `Content-Length` validation, a byte-counting `TransformStream` abort guard, and bounded concurrency on batch downloads, streaming multiple large remote videos simultaneously into a Vercel serverless function or Cloudflare Worker isolate (which has a strict 128 MB memory ceiling) will trigger Out-Of-Memory (OOM) crashes.


* **Exact Fix:** Issue a `HEAD` check (or inspect `Content-Length` on the initial `GET` response headers) to reject payloads $> 524,288,000$ bytes immediately before reading the body, pipe the response through a byte-counting `TransformStream` that aborts if cumulative bytes exceed `MAX_MEDIA_DOWNLOAD_BYTES`, and cap batch downloader concurrency.





### Unhandled Real-World Edge Cases

* **[HIGH] Silent Infinite-Like Polling Loop on Fatal HTTP Errors in `pollDownloadJobCompletion**`

* **Location:** `apps/web/src/components/media/...` (`pollDownloadJobCompletion`).


* **Edge Case:** `pollDownloadJobCompletion` loops up to `maxPolls = 60` times with a `1500ms` delay (90 seconds total) and executes:
```ts
const pollRes = await fetchImpl(`/api/tenant/${subdomain}/media/downloader?jobId=${jobId}`);
if (!pollRes.ok) continue;

```


Because `if (!pollRes.ok) continue;` ignores the HTTP status code, a permanent `401 Unauthorized`, `403 Forbidden`, or `404 Not Found` (e.g., job deleted or invalid `jobId`) causes the browser to keep hammering the endpoint 60 times for 90 seconds before timing out, and an unhandled network throw from `fetchImpl` crashes the entire batch promise if not caught inside the loop.


* **Exact Fix:** Wrap `fetchImpl` in a `try/catch` inside the loop; immediately return a `failed` entry if `pollRes.status === 401 || pollRes.status === 403 || pollRes.status === 404`, and only `continue` on transient `5xx` or network errors up to a small consecutive error threshold.





### Missing UI Elements & States

* **[MEDIUM] Lack of Per-URL Cancel & Real-Time Stage Indicator During 90-Second Downloader Polling**

* **Location:** `apps/web/src/components/media/...` (`pollDownloadJobCompletion` / Downloader UI).


* **Missing UI State:** While `pollDownloadJobCompletion` polls every 1.5s for up to 90s per job, the user has no cancel trigger (`AbortController`) to abort a stuck remote download job and no stage breakdown distinguishing "Resolving link" vs. "Streaming to R2 storage".


* **Exact Fix:** Pass an `AbortSignal` into `pollDownloadJobCompletion`, expose job progress stages from `GET /api/tenant/[subdomain]/media/downloader?jobId=${jobId}`, and render an "Abort Download" button in the Downloader progress UI.





---

## Module 5: Publishing & Edge Dispatcher Backend (`apps/worker`)

**Scope:** `apps/worker/src/index.ts`, `apps/worker/src/dispatcher.ts`, `apps/worker/src/settlement.ts`, `apps/worker/src/fb-client.ts`, `apps/worker/wrangler.toml`, `supabase/migrations/*`

### Code & Logic Bugs

* **[CRITICAL] 14,400 Posts/Day Hard Throughput Ceiling vs. 200,000 Posts/Day Target**

* **Location:** `apps/worker/src/dispatcher.ts` (`claimDueItems`, `runDispatchCycle`) & `claim_due_queue_items` SQL RPC.


* **Bug:** The Cloudflare Worker cron runs once per minute (`* * * * *`) and `claim_due_queue_items(p_limit INT DEFAULT 10)` claims only 10 items per minute ($10 \times 1,440\text{ min} = 14,400\text{ posts/day}$), while `runDispatchCycle` iterates over claimed items sequentially (`for (const item of items)`) taking 2–5 seconds per video upload.


* **Exact Fix:** Increase claim batch capacity, fan out claimed items into **Cloudflare Queues** (`PUBLISH_QUEUE`) via `fanOutClaimedBatches`, and process items concurrently with bounded concurrency (`Promise.allSettled`) in the queue consumer.




* **[CRITICAL] Missing Graph API v26.0 Publishers for `text`, `video`, and `story` in `FacebookPublishClient**`

* **Location:** `apps/worker/src/fb-client.ts` (`FacebookPublishClient`).


* **Bug:** `FacebookPublishClient` only implements `publishReel`, `publishPhoto`, and `postComment`. Attempting to dispatch `text`, `video` (standard feed video), or `story` (`photo_stories` / `video_stories`) fails because the client methods do not exist.


* **Exact Fix:** Implement `publishTextPost` (`POST /{page-id}/feed` with `message` and optional `link`), `publishVideo` (`POST /{page-id}/videos` with `file_url` and `description`), `publishPhotoStory` (`POST /{page-id}/photos` with `published: false` followed by `POST /{page-id}/photo_stories`), and `publishVideoStory` (3-phase `/{page-id}/video_stories` upload session) in `apps/worker/src/fb-client.ts`, and wire them into `dispatchItem` in `apps/worker/src/dispatcher.ts`.




* **[HIGH] Table-Wide Lock Contention & Head-of-Line Blocking in `claim_due_queue_items**`

* **Location:** `supabase/migrations/*` (`claim_due_queue_items`) & `apps/worker/src/dispatcher.ts`.


* **Bug:**
1. Every call to `claim_due_queue_items` executes `UPDATE public.queue_items SET status = 'queued', updated_at = now() WHERE status = 'publishing' AND updated_at <= now() - INTERVAL '10 minutes';` before claiming rows, causing redundant table scans and lock contention under concurrent workers.


2. `claim_due_queue_items` orders globally by `scheduled_time ASC` without partitioning by `fb_page_id`, so a single Page with 500 due posts monopolizes the entire claim batch and immediately triggers Facebook rate-limiting (`80001` or `368 / 1390008`).




* **Exact Fix:** Decouple stuck-item recovery into a dedicated `recover_stuck_publishing_items(p_timeout_minutes INT)` RPC and rewrite `claim_due_queue_items(p_limit INT, p_max_per_page INT DEFAULT 3)` using `ROW_NUMBER() OVER (PARTITION BY qi.fb_page_id ORDER BY qi.scheduled_time ASC)` while filtering out Pages where `fp.next_allowed_publish_at > now()`.




* **[HIGH] Fixed 5-Minute Retry Delay & Missing Page-Level Rate-Limit Pacing**

* **Location:** `apps/worker/src/settlement.ts` (`UPDATE_QUEUE_ITEM_RETRY_SQL`, `settleOutcome`) & `apps/worker/src/dispatcher.ts` (`recordDispatchOutcome`).


* **Bug:** `UPDATE_QUEUE_ITEM_RETRY_SQL` hardcodes `scheduled_time = now() + interval '5 minutes'` and ignores the `estimated_time_to_regain_access` field in `X-Business-Use-Case-Usage` / `X-App-Usage` response headers. Furthermore, when a Page hits a rate limit (`4`, `17`, `32`, `341`, `613`, `80001`), only the single failing item is delayed while sibling queued items for that same Page continue to get claimed and fail every minute.


* **Exact Fix:** Parse `X-Business-Use-Case-Usage` headers in `FacebookPublishClient`, persist `next_allowed_publish_at` and `buc_usage_pct` on `facebook_pages`, and defer all sibling queued items for that Page until `next_allowed_publish_at` via `settle_queue_item_outcome`.




* **[HIGH] Inconsistent Rate-Limit Classification in `FacebookGraphError.isRateLimit**`

* **Location:** `apps/worker/src/fb-client.ts` (`FacebookGraphError`) vs. `apps/worker/src/settlement.ts` (`isRateLimitErrorCode`).


* **Bug:** In `fb-client.ts`, `FacebookGraphError.isRateLimit` only checks `[4, 17, 32, 368, 613]`. It misses `341` (Application limit reached) and `80000–80014` (`80001` Page BUC rate limit) which `settlement.ts` checks in `isRateLimitErrorCode`. Conversely, `fb-client.ts` treats every `code === 368` as `isRateLimit = true` without checking `error_subcode`, even though `368` with `subcode === 1404082` (duplicate content) is a permanent post-level failure and `subcode === 4854002` is a `page_checkpoint` requiring manual mobile verification.


* **Exact Fix:** Delegate error classification in both `fb-client.ts` and `settlement.ts` to the canonical `evaluateGraphApiError(code, subcode)` helper in `@fbuploadpro/contracts`, and ensure codes `506` (Duplicate Post) and `1609005` (Error Posting Link) are classified as non-transient post failures.





### Unhandled Real-World Edge Cases

* **[HIGH] First-Comment Race Condition During Asynchronous Video/Reel Transcoding**

* **Location:** `apps/worker/src/dispatcher.ts` (`dispatchItem`).


* **Edge Case:** Calling `fbClient.postComment` immediately after `publishReel` or `publishVideo` completes can fail on Graph API v26.0 with `code: 100` (`Object with ID does not exist` or not yet published) while Facebook's video transcoding phase is still finalizing.


* **Exact Fix:** Implement a bounded retry/backoff loop around `postComment` when `format === 'reel' || format === 'video'`, and if the comment still fails after the main post succeeded, record the main post as `published` (`fb_post_id` saved) with a partial warning in `publish_logs` rather than re-queuing the entire video and publishing a duplicate video.




* **[HIGH] Orphaned `publishing` Items if `queue.sendBatch` Fails in `fanOutClaimedBatches` & Silent Catch in `recoverStuckPublishingItems**`

* **Location:** `apps/worker/src/index.ts` (`fanOutClaimedBatches` and `recoverStuckPublishingItems`).


* **Edge Case:**
1. `fanOutClaimedBatches` calls `claimDueItems(db, batchSize)` (which transitions rows to `status = 'publishing'`) and then sends chunks to `queue.sendBatch`. If `queue.sendBatch` throws (e.g., Cloudflare Queue throughput limit or network blip), the claimed items remain stuck in `status = 'publishing'`.


2. `recoverStuckPublishingItems` only runs when `currentMinute % 5 === 0` and wraps `db.rpc('recover_stuck_publishing_items', ...)` in an empty `catch {}` block, violating the Constitution's "No Empty Catch/Except Blocks" rule.




* **Exact Fix:** In `fanOutClaimedBatches`, wrap `queue.sendBatch` in a `try/catch` that immediately reverts unsent item IDs back to `status = 'queued'` on failure, and log errors in `recoverStuckPublishingItems` via `console.error` instead of swallowing them silently.





---

## Module 6: Page Insights & Analytics (Frontend & Backend)

**Scope:** `apps/web/src/components/pages/dedicated/tab-insights.tsx`, `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`, `apps/web/src/lib/insights/facebook-insights-client.ts`, `apps/web/src/lib/insights/insights-cache.ts`, `apps/worker/src/insights-sync.ts`

### Code & Logic Bugs

* **[CRITICAL] `InsightsCache` is an In-Memory Stub Despite Requiring Upstash Redis Env Vars**

* **Location:** `apps/web/src/lib/insights/insights-cache.ts` (`InsightsCache`).


* **Bug:** `insights-cache.ts` validates `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production, yet only reads and writes an in-memory `Map` (`this.cache`) and never makes REST calls to Upstash Redis. Across Vercel serverless instances, cache entries are not shared and vanish on cold starts.


* **Exact Fix:** Implement actual Upstash Redis REST pipeline (`GET` / `SET ... EX`) calls in `InsightsCache` when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, using the in-memory `Map` strictly as an L1 fallback.




* **[HIGH] Live Insights API Route Ignores `page_insights_daily_snapshots` Table**

* **Location:** `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts` (`handleGetInsights`).


* **Bug:** On a cache miss, `GET /api/tenant/[subdomain]/pages/[pageId]/insights` always queries the live Facebook Graph API instead of reading persisted daily metrics from `page_insights_daily_snapshots`, burning Page BUC (`80001`) quota needed for publishing.


* **Exact Fix:** Query `page_insights_daily_snapshots` for the requested date window (`7d`, `14d`, `28d`, `90d`) first, and only fall back to live Graph API fetching when snapshots are missing or the user explicitly triggers a manual refresh (`?refresh=true`).




* **[HIGH] Unpaginated Active Page Scan in `syncDailyPageInsights**`

* **Location:** `apps/worker/src/insights-sync.ts` (`syncDailyPageInsights`).


* **Bug:** `syncDailyPageInsights` fetches all active pages in a single unpaginated query, which truncates at 1,000 rows in PostgREST and exhausts Cloudflare Worker subrequest limits above ~300 pages.


* **Exact Fix:** Paginate the active pages query using cursor/range batches (e.g., 50–100 pages per batch) and process page insights with bounded concurrency.




* **[HIGH] Silent Error Swallowing in `FacebookInsightsClient` Caches Zeroed Metrics for 15 Minutes**

* **Location:** `apps/web/src/lib/insights/facebook-insights-client.ts` & `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`.


* **Bug:** `FacebookInsightsClient` catches network and Graph API errors and returns `0` metrics with `healthStatus: 'active'`, which `handleGetInsights` then caches for 15 minutes (`Cache-Control: s-maxage=900`). Users see `0` followers, `0` views, and `0` engagements for 15 minutes instead of an error banner or stale snapshot.


* **Exact Fix:** Propagate Graph API / network errors from `FacebookInsightsClient` (or mark `healthStatus` as degraded/error) and prevent `handleGetInsights` from writing failed/zeroed fallback responses into `InsightsCache` or setting `s-maxage=900`.




* **[MEDIUM] Chart Title Claims "Follower & View Trajectory" But Only Plots `pageFollows**`

* **Location:** `apps/web/src/components/pages/dedicated/tab-insights.tsx` (`insights-chart-card`).


* **Bug:** The chart card heading states *"Follower & View Trajectory — Daily follower activity and content impressions over the selected window"*, but the `<AreaChart>` only renders a single `<Area dataKey="pageFollows" name="Followers"/>` series and never plots views/impressions.


* **Exact Fix:** Render a second `<Area>` (or `<Line>`) series for daily video views / content impressions (`dataKey="pageViews"` / `videoViews`) on the chart, or add a metric toggle between Followers and Views.





### Missing UI Elements & States

* **[MEDIUM] Text-Only Loading State & Design System Violation on Progress Bars in `tab-insights.tsx**`

* **Location:** `apps/web/src/components/pages/dedicated/tab-insights.tsx` (`insights-loading`, `reactions-breakdown-card`, `demographics-card`).


* **Missing / Violating UI State:**
1. When `isLoading && !data`, `tab-insights.tsx` renders plain centered text (`Loading analytics & insights...`) instead of a skeletal loader matching the KPI grid and chart layout, violating Section 4.5 of the UI standards (*"Loading: Skeletal loaders matching the final layout's shape"*).


2. In `reactions-breakdown-card` and `demographics-card`, each row renders a filled background track (`backgroundColor: var(--bg-active)`, `width: '100%'`, `height: '4px'`) with a partial fill bar on top, violating the Taste Skill rule (*"NO scoring/progress bars with filled background tracks as comparison visuals"*).




* **Exact Fix:** Replace the text-only `insights-loading` div with a structured skeleton grid matching `insights-kpi-grid` and `insights-chart-card`, and remove the filled background tracks on the reaction/country comparison bars in `tab-insights.tsx`.





---

## Module 7: Cross-Cutting Auth, RBAC, Workspace Guard & UI Primitives

**Scope:** `apps/web/src/lib/rbac.ts`, `apps/web/src/lib/auth-errors.ts`, `apps/web/src/app/api/auth/forgot-password/route.ts`, `apps/web/src/components/workspace/workspace-lifecycle-guard.tsx`, `apps/web/src/components/ui/status-dot.tsx`

### Code & Logic Bugs

* **[HIGH] Hardcoded Hex Color Literal (`#848e9c`) & Missing Halo in `status-dot.tsx**`

* **Location:** `apps/web/src/components/ui/status-dot.tsx` (`statusConfig.idle`).


* **Bug:** `statusConfig.idle` is defined as `{ dot: '#848e9c', halo: 'none', label: 'Idle' }`. This violates:


1. Section 4 Verification & Linting Gate (``): *"Any pull request or code review that introduces hardcoded color literals (e.g., regex `#[0-9a-fA-F]{3,8}`) in component JSX/TSX files outside `theme.ts` violates repository quality standards and will be blocked"*.


2. Section 7.3 of `DESIGN.md` (``): `Neutral / Idle` requires `--color-neutral` (`STATUS_SIGNALS.idle`) and micro-halo `box-shadow: 0 0 4px rgba(47, 54, 66, 0.40)` rather than `halo: 'none'`.




* **Exact Fix:** Import `STATUS_SIGNALS` from `@/lib/theme` in `apps/web/src/components/ui/status-dot.tsx` and map `statusConfig` directly to `STATUS_SIGNALS.operational`, `STATUS_SIGNALS.queued`, `STATUS_SIGNALS.critical`, and `STATUS_SIGNALS.idle` with zero hardcoded hex strings.




* **[MEDIUM] Copy-Pasted Registration Fallback Message in Forgot-Password API Route**

* **Location:** `apps/web/src/app/api/auth/forgot-password/route.ts`.


* **Bug:** The `catch` block calls `formatAuthErrorResponse(error, { fallbackMessage: 'Unable to initiate account registration. Please try again shortly.', defaultStatus: 500 })`. When password reset initiation fails, the user receives an error message about "account registration".


* **Exact Fix:** Change `fallbackMessage` in `apps/web/src/app/api/auth/forgot-password/route.ts` to `'Unable to initiate password reset at this moment. Please try again shortly.'`.




* **[MEDIUM] Internal Role Plumbing Exposed in `assertRole` Error Message**

* **Location:** `apps/web/src/lib/rbac.ts` (`assertRole`).


* **Bug:** `assertRole` throws `Access denied: requires ${requiredRole} role or higher, current role is ${currentRole}`. If surfaced to the client, exposing internal role enum identifiers violates the UX Writing rule against cold bureaucratic/plumbing messages.


* **Exact Fix:** Map `DomainErrorCode.FORBIDDEN` to a user-friendly permission message (`"You don't have permission to perform this action in this workspace."`) at the API response boundary.




* **[MEDIUM] Residual Legacy `DatabaseClient` (`db.query`) Branches in API Route Handlers**

* **Location:** `apps/web/src/lib/route-auth.ts` (`isLegacyClient`), `apps/web/src/lib/server/workspace-resolver.ts`, `apps/web/src/app/api/tenant/[subdomain]/media/*`, and `apps/web/src/app/api/tenant/[subdomain]/publishing/*`.


* **Bug:** Route handlers still branch on `isLegacyClient(db)` to execute raw SQL strings via `db.query(...)`, which conflicts with the Constitution's Pure PostgREST Route Execution rule (*"All API route handlers must query the remote Supabase database directly using `@supabase/supabase-js` PostgREST... Route handlers MUST NOT call raw SQL `db.query(...)` with dummy adapters"*).


* **Exact Fix:** Migrate remaining unit test mocks from legacy `{ query: vi.fn() }` objects to typed `SupabaseClient<Database>` mocks and remove `isLegacyClient` raw SQL branches from route handlers.





### Unhandled Real-World Edge Cases

* **[MEDIUM] Global `window.fetch` Monkey-Patching in `workspace-lifecycle-guard.tsx**`

* **Location:** `apps/web/src/components/workspace/workspace-lifecycle-guard.tsx`.


* **Edge Case:** The guard overwrites `window.fetch` to inspect `403` responses for `ACCOUNT_SUSPENDED`. If multiple guard instances mount or React StrictMode double-invokes the effect without restoring `originalFetch` in the cleanup function, `window.fetch` gets wrapped multiple times, cloning every `403` response repeatedly.


* **Exact Fix:** Ensure the `useEffect` cleanup function restores `window.fetch = originalFetch` on unmount and guard against double-wrapping via a symbol/flag on `window.fetch`.





---
