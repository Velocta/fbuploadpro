# Feature Specification: Platform Audit Remediation (Spec 045)

**Feature Branch**: `fix/045-platform-audit-remediation`  
**Created**: 2026-10-15  
**Status**: Draft  
**Input**: User request: "now using SDD read the issues.md file and make a spec to fix every one of them dont leave a single one"  

---

## Executive Summary & Traceability Matrix

This specification systematically addresses all **42 issues across 7 core modules** documented in [`issues.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/sync_latest_main_code/issues.md). No issue is omitted.

| Module | Issue ID / Scope | Severity | User Story | Functional Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Module 1** | Parent Account Status Cascade on OAuth Errors (`190`, `102`, `10`, `200–299`) | CRITICAL | Story 2 | FR-001 |
| **Module 1** | Unsanitized Error Leak in Facebook Auth & BYOC Connection Test Routes | HIGH | Story 2 | FR-002 |
| **Module 1** | Hardcoded Fallback Encryption Key in Token Crypto Module (`DEV_FALLBACK_ENCRYPTION_KEY`) | HIGH | Story 2 | FR-003 |
| **Module 1** | Premature Optimistic `byocStatus.isConfigured` Initial State | MEDIUM | Story 2 | FR-004 |
| **Module 1** | Silent Swallowing of `/api/tenant/[subdomain]/settings/byoc` Failures | MEDIUM | Story 2 | FR-005 |
| **Module 1** | Missing `expiring_soon` / Token Health Warning Filter & Indicator in `AccountsFilterBar` | LOW | Story 2 | FR-006 |
| **Module 2** | Hardcoded Media-Only Queue Schema Blocks Text Posts, Feed Videos & Page Stories | CRITICAL | Story 1 | FR-007 |
| **Module 2** | First Comment Allowed on Unsupported Story Format | CRITICAL | Story 1 | FR-008 |
| **Module 2** | Read-Request Write Amplification in `GET /api/tenant/[subdomain]/pages` | HIGH | Story 6 | FR-009 |
| **Module 2** | Hardcoded Dummy Follower Data in `DedicatedPageView` State Initialization | HIGH | Story 6 | FR-010 |
| **Module 2** | Format-Blind Recurring Publishing Slots (`page_queue_slots`) | MEDIUM | Story 6 | FR-011 |
| **Module 2** | Unhandled `RangeError: Invalid time value` in `resolveScheduledTime` | MEDIUM | Story 6 | FR-012 |
| **Module 2** | Client-Side Queue Counter Drift & Unpaginated Queue State | MEDIUM | Story 6 | FR-013 |
| **Module 2** | Missing Checkpoint Verification Banner & 1-Click Reactivation Button (`status = 'page_checkpoint'`) | HIGH | Story 6 | FR-014 |
| **Module 2** | Missing `skipped` and `cancelled` Status Filters in `PageTabQueue` | LOW | Story 6 | FR-015 |
| **Module 3** | Offset Pagination Drift & $O(N)$ Index Scan Degradation in Media Library | CRITICAL | Story 3 | FR-016 |
| **Module 3** | Client-Side Duplicate Detection Blind Spot Beyond 100 Items | HIGH | Story 3 | FR-017 |
| **Module 3** | Base64 `data:` URL Thumbnail Bloat in PostgreSQL | HIGH | Story 3 | FR-018 |
| **Module 3** | Missing Pixel Dimensions (`width`, `height`) & Post Format Eligibility Validators | HIGH | Story 3 | FR-019 |
| **Module 3** | Synchronous Unbatched R2 Deletes in Cascading Folder Deletion Risk Gateway Timeouts | HIGH | Story 3 | FR-020 |
| **Module 3** | Missing Per-File Failure Reason Breakdown in `UploadQueueBanner` | LOW | Story 3 | FR-021 |
| **Module 4** | Unbounded Memory & Missing Pre-Stream `HEAD` / `Content-Length` Enforcement | HIGH | Story 4 | FR-022 |
| **Module 4** | Silent Infinite-Like Polling Loop on Fatal HTTP Errors in `pollDownloadJobCompletion` | HIGH | Story 4 | FR-023 |
| **Module 4** | Lack of Per-URL Cancel & Real-Time Stage Indicator During 90-Second Downloader Polling | MEDIUM | Story 4 | FR-024 |
| **Module 5** | 14,400 Posts/Day Hard Throughput Ceiling vs. 200,000 Posts/Day Target | CRITICAL | Story 1 | FR-025 |
| **Module 5** | Missing Graph API v26.0 Publishers for `text`, `video`, and `story` in `FacebookPublishClient` | CRITICAL | Story 1 | FR-026 |
| **Module 5** | Table-Wide Lock Contention & Head-of-Line Blocking in `claim_due_queue_items` | HIGH | Story 1 | FR-027 |
| **Module 5** | Fixed 5-Minute Retry Delay & Missing Page-Level Rate-Limit Pacing | HIGH | Story 1 | FR-028 |
| **Module 5** | Inconsistent Rate-Limit Classification in `FacebookGraphError.isRateLimit` | HIGH | Story 1 | FR-029 |
| **Module 5** | First-Comment Race Condition During Asynchronous Video/Reel Transcoding | HIGH | Story 1 | FR-030 |
| **Module 5** | Orphaned `publishing` Items if `queue.sendBatch` Fails & Silent Catch in Stuck Items Recovery | HIGH | Story 1 | FR-031 |
| **Module 6** | `InsightsCache` In-Memory Stub Despite Requiring Upstash Redis Env Vars | CRITICAL | Story 5 | FR-032 |
| **Module 6** | Live Insights API Route Ignores `page_insights_daily_snapshots` Table | HIGH | Story 5 | FR-033 |
| **Module 6** | Unpaginated Active Page Scan in `syncDailyPageInsights` | HIGH | Story 5 | FR-034 |
| **Module 6** | Silent Error Swallowing in `FacebookInsightsClient` Caches Zeroed Metrics for 15 Minutes | HIGH | Story 5 | FR-035 |
| **Module 6** | Chart Title Claims "Follower & View Trajectory" But Only Plots `pageFollows` | MEDIUM | Story 5 | FR-036 |
| **Module 6** | Text-Only Loading State & Design System Violation on Progress Bars in `tab-insights.tsx` | MEDIUM | Story 5 | FR-037 |
| **Module 7** | Hardcoded Hex Color Literal (`#848e9c`) & Missing Halo in `status-dot.tsx` | HIGH | Story 7 | FR-038 |
| **Module 7** | Copy-Pasted Registration Fallback Message in Forgot-Password API Route | MEDIUM | Story 7 | FR-039 |
| **Module 7** | Internal Role Plumbing Exposed in `assertRole` Error Message | MEDIUM | Story 7 | FR-040 |
| **Module 7** | Residual Legacy `DatabaseClient` (`db.query`) Branches in API Route Handlers | MEDIUM | Story 7 | FR-041 |
| **Module 7** | Global `window.fetch` Monkey-Patching in `workspace-lifecycle-guard.tsx` | MEDIUM | Story 7 | FR-042 |

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enterprise Multi-Format Publishing Engine & 200k Throughput Scale (Priority: P1)

As a high-volume social media agency operator,  
I want to schedule, queue, and dispatch posts across all 5 canonical Meta formats (`text`, `image`, `reel`, `video`, `story`) at scale without head-of-line blocking, rate-limit storms, or worker lockups,  
So that our organization can reliably publish up to 200,000 posts per day with automated first comments, dynamic pacing, and zero dropped posts.

**Why this priority**: Publishing is the core value proposition of FBUploadPro. The existing worker is constrained to 14,400 posts/day, lacks Graph API v26.0 publishers for 3 out of 5 formats, allows invalid first comments on Stories, and suffers from single-page claim starvation.

**Independent Test**: Schedule a batch containing text posts, image posts, standard videos, reels, and photo stories across multiple Facebook Pages. Verify that:
1. All 5 formats are claimed and dispatched using their appropriate Graph API endpoints.
2. Stories reject or omit first comments without failing.
3. Queue claims are partitioned fairly across pages (`max_per_page`) and defer Pages in rate-limit cooldown.
4. Claimed batches fan out into Cloudflare Queues with immediate fallback if queueing fails.

**Acceptance Scenarios**:
1. **Given** a user opens `EnqueueModal`,  
   **When** selecting `text`,  
   **Then** `media_id` is not required, text caption and optional `link_url` are validated, and the item schedules successfully.
2. **Given** a user selects post format `story`,  
   **When** configuring queue properties,  
   **Then** the `first_comment` field is hidden and locked to `NULL`, and the database check constraint enforces `post_format <> 'story' OR first_comment IS NULL`.
3. **Given** 500 items are due across 5 distinct Facebook Pages,  
   **When** `claim_due_queue_items(p_limit => 50, p_max_per_page => 5)` is executed,  
   **Then** no single Page receives more than 5 items in the claim window, preventing rate-limit monopolization.
4. **Given** a Page receives Graph API rate limit error `80001` or headers with `X-Business-Use-Case-Usage`,  
   **When** `settle_queue_item_outcome` processes the response,  
   **Then** `facebook_pages.next_allowed_publish_at` is set, and sibling queued items for that Page are deferred rather than immediately retrying and failing.
5. **Given** a reel or video is successfully dispatched to Meta,  
   **When** `postComment` is invoked while transcoding is ongoing,  
   **Then** the dispatcher retries with bounded backoff, and if the comment times out, the main post remains marked as `published` with a warning log rather than re-publishing the video.

---

### User Story 2 - Resilient Account OAuth Lifecycle & BYOC Configuration (Priority: P1)

As a workspace administrator,  
I want connected Facebook accounts and BYOC settings to maintain synchronized status, fail-safe error boundaries, and proactive token health visibility,  
So that expired OAuth tokens cascade properly to parent accounts, network drops do not erase BYOC UI state, and internal technical errors never leak to operators.

**Why this priority**: When a Page token hard-fails with OAuth codes `190`, `102`, `10`, or `200-299`, the parent Facebook account remains misleadingly marked as `'active'` in `TenantAccountsPage`. Additionally, transient BYOC network errors falsely tell operators their BYOC app is unconfigured.

**Independent Test**: Simulate an expired token dispatch (`code: 190`). Verify that the atomic settlement RPC marks both `facebook_pages.status = 'invalid_token'` and `facebook_accounts.status = 'expired'`. Verify that transient BYOC fetch failures show a non-blocking retry banner instead of resetting configuration state.

**Acceptance Scenarios**:
1. **Given** a publishing dispatch fails with OAuth code `190` (invalidated or expired user session),  
   **When** `settle_queue_item_outcome` runs,  
   **Then** both the child Facebook Page status and parent Facebook Account status are updated to `'invalid_token'` and `'expired'` respectively.
2. **Given** a socket timeout or network error occurs during Facebook OAuth or BYOC testing,  
   **When** the endpoint responds with `500`,  
   **Then** all response messages are sanitized through `sanitizeAuthErrorMessage`, returning zero raw system or socket traces (`ECONNREFUSED`, IP addresses, stack traces).
3. **Given** production environment (`NODE_ENV === 'production'`),  
   **When** `encryptToken` or `decryptToken` runs without `FB_ENCRYPTION_MASTER_KEY` or with `DEV_FALLBACK_ENCRYPTION_KEY`,  
   **Then** a fatal `DomainError` (`INTERNAL_ERROR`) is raised, preventing silent use of hardcoded keys.
4. **Given** a user navigates to `TenantAccountsPage`,  
   **When** BYOC status is still loading (`isLoading: true`),  
   **Then** `byocStatus.isConfigured` is `false` (non-optimistic), connect buttons are gated, and if the status check fails with `500`, a retry banner appears without clearing configured state.
5. **Given** an account's 60-day token is within 7 days of expiration,  
   **When** viewing `AccountsFilterBar` and `AccountCard`,  
   **Then** an `expiring_soon` filter option and a proactive countdown warning with a re-authentication CTA are displayed.

---

### User Story 3 - High-Performance Media Library, Keyset Pagination & Safe Cascades (Priority: P1)

As a social media manager managing thousands of creative assets,  
I want the Media Library to load instantaneously via keyset cursor pagination, validate dimensions for format eligibility, check duplicates across entire folders, and safely cascade folder deletions in R2,  
So that large asset libraries (10,000+ files) browse smoothly without pagination drift, database thumbnail bloat, or gateway timeouts during folder cleanup.

**Why this priority**: Offset pagination ($O(N)$ index scans) degrades severely at scale and causes duplicate/missing cards during active uploads. Base64 thumbnails bloat PostgreSQL buffers, and single-file R2 deletes in cascading folder deletion timeout on large directories.

**Independent Test**: Load a folder with 1,000+ media items using cursor pagination (`createdAt|id`), upload WebP video frame thumbnails directly to R2 presigned URLs, and delete a folder containing 500 items via chunked batch deletions.

**Acceptance Scenarios**:
1. **Given** a user scrolls through a folder with 5,000 media items,  
   **When** fetching the next batch,  
   **Then** `handleListMedia` queries `(created_at, id) < (cursor_created_at, cursor_id)` ordered by `created_at DESC, id DESC` in $O(1)$ time without offset drift.
2. **Given** a user queues files for upload in a folder that already contains 500 items,  
   **When** duplicate detection runs,  
   **Then** `POST /api/tenant/[subdomain]/media/check-duplicates` queries the entire folder in PostgreSQL rather than comparing against only the first 100 items in browser memory.
3. **Given** a video preview generates a WebP thumbnail frame,  
   **When** saving the thumbnail,  
   **Then** the blob is uploaded to Cloudflare R2 (`users/{userId}/thumbnails/{mediaId}.webp`) via presigned URL, and raw `data:` base64 URLs are rejected in production.
4. **Given** a user uploads a media asset,  
   **When** metadata probing runs,  
   **Then** `width` and `height` are recorded, and post format eligibility (Reel vs. Video vs. Story vs. Image) is computed based on aspect ratio, resolution, and duration.
5. **Given** an operator deletes a folder containing 500+ media assets,  
   **When** `handleDeleteFolder` executes,  
   **Then** R2 keys are deleted in concurrent chunks (up to 1,000 keys per batch) before the recursive database subtree is deleted, completing within serverless timeout windows.
6. **Given** an upload batch has failed items,  
   **When** viewing `UploadQueueBanner`,  
   **Then** each failed item displays a human-readable `failureReason` explaining why the upload failed.

---

### User Story 4 - Cloud Media Downloader Streaming Resilience & Memory Safety (Priority: P2)

As an operator importing remote video assets from cloud URLs,  
I want the cloud downloader to validate size limits pre-stream, abort runaway streams, fail-fast on fatal HTTP errors, and support user cancellation with progress indicators,  
So that serverless isolates never experience out-of-memory crashes and stuck downloads can be canceled immediately.

**Why this priority**: Streaming up to 500 MB without pre-flight `HEAD` / `Content-Length` checks or byte-counting transform streams causes memory exhaustion and worker crashes. Polling loops also hammer endpoints on fatal `401`/`403`/`404` errors.

**Independent Test**: Attempt downloading a remote file $> 500\text{ MB}$. Verify immediate rejection via `HEAD` check. Poll a non-existent job ID and verify the UI stops polling immediately on `404` instead of looping 60 times.

**Acceptance Scenarios**:
1. **Given** a remote URL is submitted for download,  
   **When** initiating the download stream,  
   **Then** a pre-stream `HEAD` request verifies `Content-Length <= 524,288,000` bytes, and the response stream is piped through an abort-guarded `TransformStream`.
2. **Given** `pollDownloadJobCompletion` polls for status,  
   **When** the server returns `401`, `403`, or `404`,  
   **Then** polling terminates immediately with a descriptive failure status rather than executing all 60 retries for 90 seconds.
3. **Given** a remote download job is in progress,  
   **When** viewing the downloader interface,  
   **Then** the current stage ("Resolving link" vs. "Streaming to storage") is displayed along with an "Abort Download" button wired to an `AbortSignal`.

---

### User Story 5 - Real Upstash Redis Insights Caching & Accurate Analytics Visualizations (Priority: P2)

As a social media manager analyzing Page growth,  
I want Facebook Page analytics to read from real Upstash Redis caches and persisted daily snapshots, display dual-metric trajectory charts, and render layout-matching skeleton loaders,  
So that analytics load under 200ms without wasting Graph API quota, zeroed error metrics are never cached, and UI components adhere strictly to design guidelines.

**Why this priority**: `InsightsCache` currently uses an in-memory stub that discards cache entries on serverless cold starts. The API ignores persisted database snapshots, zeroed error responses get cached for 15 minutes, and progress bars violate anti-slop rules.

**Independent Test**: Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Verify that `InsightsCache` performs actual Redis `GET`/`SET` commands. Verify that `handleGetInsights` queries `page_insights_daily_snapshots` first before hitting Graph API.

**Acceptance Scenarios**:
1. **Given** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present,  
   **When** `InsightsCache` reads and writes,  
   **Then** requests execute against Upstash Redis REST API with TTL, using in-memory `Map` strictly as an L1 fallback.
2. **Given** a user opens the Insights tab for a date range,  
   **When** cached data is absent,  
   **Then** `page_insights_daily_snapshots` is queried first, avoiding live Graph API calls unless `?refresh=true` is requested.
3. **Given** a background worker runs daily insights sync across active pages,  
   **When** querying active pages,  
   **Then** pages are fetched with cursor/range pagination in bounded concurrency batches rather than an unpaginated 1,000-row scan.
4. **Given** Facebook Graph API returns an error during an insights fetch,  
   **When** `FacebookInsightsClient` handles the error,  
   **Then** the error is propagated as degraded/failed, and zeroed fallback data is never written to cache or assigned `s-maxage=900`.
5. **Given** viewing the "Follower & View Trajectory" chart card,  
   **When** rendering the chart,  
   **Then** both Followers and Content Impressions/Views are plotted as dual series (or toggleable metrics).
6. **Given** the Insights tab is loading,  
   **When** data is fetching,  
   **Then** structured skeleton loaders matching the KPI grid and chart card are displayed, and comparison bars omit filled background tracks.

---

### User Story 6 - Dedicated Page Workspace & Operational Controls (Priority: P2)

As an operator managing a dedicated Page,  
I want read queries to avoid write amplification, follower metrics to initialize accurately, recurring publishing slots to respect post formats, and clear checkpoint recovery banners,  
So that database locks are prevented, placeholder data is eradicated, time-slot scheduling is format-aware, and checkpointed pages can be reactivated in 1 click.

**Why this priority**: `GET /api/tenant/[subdomain]/pages` executes synchronous `UPDATE` statements on read, fake dummy follower numbers (12,360) are initialized in state, invalid dates throw unhandled `RangeError`s, and `page_checkpoint` lacks a 1-click reactivation CTA.

**Independent Test**: Call `GET /api/tenant/[subdomain]/pages` and verify zero database writes occur. Visit a dedicated page without preloaded metrics and verify starting followers initialize to 0. Test slot scheduling with format constraints.

**Acceptance Scenarios**:
1. **Given** a client calls `GET /api/tenant/[subdomain]/pages`,  
   **When** evaluating rate limit cooldowns,  
   **Then** effective status is evaluated in-memory via `evaluatePageHealth` on read, with zero synchronous `UPDATE` queries executed in the `GET` handler.
2. **Given** `DedicatedPageView` mounts without preloaded metrics,  
   **When** state initializes,  
   **Then** follower metrics initialize cleanly to `0` or fetch genuine database values, completely eliminating placeholder numbers (`12360`).
3. **Given** recurring slots configured in `page_queue_slots`,  
   **When** `calculateNextVacantSlot` evaluates candidates,  
   **Then** slots are filtered by `allowed_formats`, allocating designated slots for Stories vs. Reels vs. Feed Posts.
4. **Given** an invalid date string is supplied to `resolveScheduledTime`,  
   **When** parsing,  
   **Then** the function throws a 400 `ValidationError` before calling `.toISOString()`, eliminating unhandled `RangeError` 500s.
5. **Given** a Page has hundreds of queue items,  
   **When** loading `PageTabQueue`,  
   **Then** status badge counts are returned from server-side aggregations, and filter buttons include `'skipped'` and `'cancelled'`.
6. **Given** a Page hits Facebook checkpoint status (`page_checkpoint`),  
   **When** viewing the Page header or settings,  
   **Then** an instructional banner explains mobile verification and provides a 1-click "Reactivate Page" button calling `PATCH /pages/${id}` with `{ status: 'active' }`.

---

### User Story 7 - Cross-Cutting Auth, RBAC, Workspace Guard & Design System Hairlines (Priority: P3)

As a platform developer and end-user,  
I want UI status primitives to use strict theme tokens without hardcoded hex colors, error messages to use empathetic public copy, legacy raw SQL client branches removed, and workspace guards to avoid duplicate fetch wrapping,  
So that the codebase conforms strictly to Design System and Constitution rules with zero technical plumbing leaks.

**Why this priority**: Hardcoded hex literals (`#848e9c`) violate lint and design gates, role check errors leak internal enum strings, forgot-password error copy mentions registration, and duplicate `window.fetch` patches clone network responses in React StrictMode.

**Independent Test**: Inspect `status-dot.tsx` to verify zero hex strings. Trigger a forgot-password error and verify password-reset copy. Inspect route handlers to verify absence of `isLegacyClient` / `db.query` branches.

**Acceptance Scenarios**:
1. **Given** `StatusDot` renders an `idle` or operational state,  
   **When** styling is computed,  
   **Then** all colors and micro-halos are imported directly from `STATUS_SIGNALS` in `@/lib/theme`, containing zero hardcoded hex literals.
2. **Given** password reset initiation fails in `POST /api/auth/forgot-password`,  
   **When** error response is returned,  
   **Then** `fallbackMessage` reads: `"Unable to initiate password reset at this moment. Please try again shortly."`.
3. **Given** a user lacks permission for an action,  
   **When** `assertRole` rejects,  
   **Then** the API boundary returns user-friendly copy: `"You don't have permission to perform this action in this workspace."` without exposing raw role enum comparisons.
4. **Given** API route handlers execute,  
   **When** accessing Supabase,  
   **Then** queries use `@supabase/supabase-js` PostgREST exclusively, with `isLegacyClient` and `db.query(...)` branches completely removed.
5. **Given** `WorkspaceLifecycleGuard` mounts in React StrictMode,  
   **When** monkey-patching `window.fetch`,  
   **Then** a symbol guard prevents double-wrapping and the cleanup function safely restores `window.fetch = originalFetch`.

---

## Edge Cases

- **Mixed-Batch Claims**: When `claim_due_queue_items` runs, if some Pages are in rate-limit cooldown (`next_allowed_publish_at > now()`), the claim query must skip those pages and claim eligible items for other Pages up to `p_max_per_page`.
- **Worker Queue Batching Failure**: If Cloudflare Queue `sendBatch` rejects or times out, all claimed item IDs in that chunk must be reverted to `status = 'queued'` in a single atomic database query to prevent permanent orphan locks.
- **R2 Partial Cascade Failure**: If deleting 1,000 R2 keys experiences partial failure in `Promise.allSettled`, remaining keys must be recorded or retried, and database folder records must only be deleted if storage cleanup succeeded.
- **Downloader Redirects & Missing Headers**: If a remote media server does not return `Content-Length` on `HEAD`, the downloader engine must inspect initial `GET` headers and enforce a streaming byte-counter abort guard during chunk transfer.
- **Redis Outage Degradation**: If Upstash Redis experiences a transient network outage or rate limit, `InsightsCache` must automatically fall back to its in-memory L1 cache and log a warning without throwing 500 errors to the client.
- **Concurrent Checkpoint Reactivation**: If multiple operators click "Reactivate Page" simultaneously, the `PATCH` handler must handle the update idempotently without race conditions.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Module 1: Facebook Accounts & BYOC OAuth
- **FR-001**: System MUST atomically cascade OAuth failure codes (`190`, `102`, `10`, `200–299`) to update parent `public.facebook_accounts SET status = 'expired'` whenever `facebook_pages.status` is set to `'invalid_token'` via `settle_queue_item_outcome`.
- **FR-002**: System MUST sanitize all error responses in `/api/auth/facebook` and `/api/tenant/[subdomain]/settings/byoc/test` using `sanitizeAuthErrorMessage` before returning JSON responses.
- **FR-003**: System MUST enforce a runtime guard in `packages/contracts/src/crypto/token.ts` throwing `DomainError(INTERNAL_ERROR)` if `FB_ENCRYPTION_MASTER_KEY` is missing or matches `DEV_FALLBACK_ENCRYPTION_KEY` in production.
- **FR-004**: System MUST initialize `byocStatus` to `{ isConfigured: false, isLoading: true }` in `TenantAccountsPage` and gate connect triggers while loading.
- **FR-005**: System MUST track an `error` state on `byocStatus` and render a non-blocking retry banner on network/500 failures without resetting configuration state.
- **FR-006**: System MUST surface token expiration countdown metadata on `AccountCard` and provide an `expiring_soon` filter option when OAuth tokens are within 7 days of expiration.

#### Module 2: Facebook Pages & Dedicated Page Section
- **FR-007**: System MUST support all 5 canonical post formats (`text`, `image`, `reel`, `video`, `story`) in `public.queue_items` (`media_id` nullable for `text`, format check constraint `chk_queue_items_format_media`, and `link_url` support).
- **FR-008**: System MUST hide and disable the `firstComment` input for `story` format posts in `EnqueueModal`, enforce `first_comment = NULL` in schemas, and apply database constraint `chk_queue_items_story_no_comment`.
- **FR-009**: System MUST remove synchronous `UPDATE` statements from `GET /api/tenant/[subdomain]/pages` and evaluate page health dynamically on read via `evaluatePageHealth`.
- **FR-010**: System MUST initialize follower metrics in `DedicatedPageView` to `0` or fetch real database values, eliminating hardcoded placeholder values (`12360`).
- **FR-011**: System MUST support `allowed_formats TEXT[]` on `page_queue_slots` and filter candidate slots in `calculateNextVacantSlot` by the queued item's `postFormat`.
- **FR-012**: System MUST validate timestamp values using `Number.isNaN(new Date(time).getTime())` in `resolveScheduledTime` and return a 400 validation error before calling `.toISOString()`.
- **FR-013**: System MUST return server-side aggregated status counts (`queuedCount`, `publishedCount`, `failedCount`) in `GET /api/tenant/[subdomain]/publishing/queue`.
- **FR-014**: System MUST render an instructional checkpoint warning banner and a 1-click "Reactivate Page" button calling `PATCH /api/tenant/[subdomain]/pages/[pageId]` when `page.status === 'page_checkpoint'`.
- **FR-015**: System MUST include `'skipped'` and `'cancelled'` status filter buttons in `PageTabQueue`.

#### Module 3: Media Library & Batch Upload Pipeline
- **FR-016**: System MUST implement keyset cursor pagination (`cursor = createdAt|id`) in `MediaListQuerySchema`, `handleListMedia`, and `MediaLibraryExplorer`, querying `(created_at, id) < (cursor_created_at, cursor_id)` ordered by `created_at DESC, id DESC`.
- **FR-017**: System MUST provide endpoint `POST /api/tenant/[subdomain]/media/check-duplicates` checking target folder duplicates across all database rows before batch uploads begin.
- **FR-018**: System MUST upload video thumbnail frame WebP blobs to Cloudflare R2 presigned URLs (`users/{userId}/thumbnails/{mediaId}.webp`) and reject raw `data:` base64 URLs in `UpdateMediaRequestSchema` in production.
- **FR-019**: System MUST extract and persist `width` and `height` pixel dimensions on `media_items` and enforce `validatePostFormatEligibility` in `@fbuploadpro/contracts`.
- **FR-020**: System MUST delete R2 objects in chunked batches (up to 1,000 keys) with bounded concurrency in `handleDeleteFolder` before deleting the database folder subtree.
- **FR-021**: System MUST attach a human-readable `failureReason` to each `QueuedUploadEntry` and render a failure summary breakdown in `UploadQueueBanner`.

#### Module 4: Cloud Media Downloader (Frontend & Backend)
- **FR-022**: System MUST perform pre-stream `HEAD` validation rejecting remote files $> 524,288,000$ bytes, enforce a byte-counting `TransformStream` abort guard, and cap batch download concurrency.
- **FR-023**: System MUST fail-fast inside `pollDownloadJobCompletion` upon receiving HTTP `401`, `403`, or `404` status codes, aborting retries immediately.
- **FR-024**: System MUST support download cancellation via `AbortSignal`, expose progress stages (`resolving` vs. `streaming`) from the downloader status API, and render an "Abort Download" button.

#### Module 5: Publishing & Edge Dispatcher Backend (`apps/worker`)
- **FR-025**: System MUST scale publishing throughput by fanning out claimed queue batches into Cloudflare Queues (`PUBLISH_QUEUE`) for concurrent worker processing.
- **FR-026**: System MUST implement Graph API v26.0 publishers for `text` (`publishTextPost`), `video` (`publishVideo`), `photo_stories` (`publishPhotoStory`), and `video_stories` (`publishVideoStory`) in `FacebookPublishClient` and wire them into `dispatchItem`.
- **FR-027**: System MUST decouple stuck item recovery into `recover_stuck_publishing_items` and rewrite `claim_due_queue_items` with `ROW_NUMBER() OVER (PARTITION BY fb_page_id ORDER BY scheduled_time ASC)` filtering out Pages where `next_allowed_publish_at > now()`.
- **FR-028**: System MUST parse `X-Business-Use-Case-Usage` headers, persist `next_allowed_publish_at` and `buc_usage_pct` on `facebook_pages`, and defer sibling queued items for that Page during rate-limiting.
- **FR-029**: System MUST unify rate-limit and error classification in `evaluateGraphApiError`, ensuring codes `506` (Duplicate) and `1609005` (Bad Link) are non-transient, and checking subcode `4854002` for checkpoints.
- **FR-030**: System MUST wrap `postComment` in a bounded retry backoff loop for video/reel posts; if the comment fails after the post succeeds, record the post as `published` with a warning log rather than duplicate-publishing.
- **FR-031**: System MUST revert unsent claimed items to `status = 'queued'` if `queue.sendBatch` throws in `fanOutClaimedBatches`, and log errors in `recoverStuckPublishingItems` with `console.error`.

#### Module 6: Page Insights & Analytics (Frontend & Backend)
- **FR-032**: System MUST implement Upstash Redis REST calls (`GET` / `SET ... EX`) in `InsightsCache` when environment variables are configured, using in-memory `Map` strictly as an L1 fallback.
- **FR-033**: System MUST query `page_insights_daily_snapshots` first in `handleGetInsights` before invoking Graph API unless `?refresh=true` is specified.
- **FR-034**: System MUST paginate active pages in `syncDailyPageInsights` using cursor/range batches (50–100 per batch) with bounded concurrency.
- **FR-035**: System MUST propagate errors from `FacebookInsightsClient` and prohibit caching zeroed fallback responses or setting `s-maxage=900` on failed fetches.
- **FR-036**: System MUST plot dual series or provide toggleable metrics for both Followers and Content Impressions/Views on the insights trajectory chart.
- **FR-037**: System MUST render structured skeleton loaders matching the KPI grid and chart card during insights loading and eliminate filled background tracks on comparison bars.

#### Module 7: Cross-Cutting Auth, RBAC, Workspace Guard & UI Primitives
- **FR-038**: System MUST import all styling and micro-halos for `StatusDot` directly from `STATUS_SIGNALS` in `@/lib/theme`, containing zero hardcoded hex literals.
- **FR-039**: System MUST use fallback message `"Unable to initiate password reset at this moment. Please try again shortly."` in `/api/auth/forgot-password`.
- **FR-040**: System MUST map `DomainErrorCode.FORBIDDEN` in `assertRole` to customer-friendly copy: `"You don't have permission to perform this action in this workspace."`.
- **FR-041**: System MUST remove all `isLegacyClient` and `db.query(...)` branches from API route handlers and migrate remaining unit tests to typed `SupabaseClient<Database>` mocks.
- **FR-042**: System MUST restore `window.fetch = originalFetch` in the `WorkspaceLifecycleGuard` cleanup function and guard against double-wrapping with a symbol flag.

---

## Key Entities & Data Substrate Changes

### Database Schema Updates (`supabase/migrations/`)
1. **`public.queue_items`**:
   - `ALTER TABLE public.queue_items ALTER COLUMN media_id DROP NOT NULL;`
   - `ALTER TABLE public.queue_items ADD COLUMN post_format TEXT NOT NULL DEFAULT 'reel' CHECK (post_format IN ('text', 'image', 'reel', 'video', 'story'));`
   - `ALTER TABLE public.queue_items ADD COLUMN link_url TEXT;`
   - `ALTER TABLE public.queue_items ADD CONSTRAINT chk_queue_items_format_media CHECK ((post_format = 'text' AND media_id IS NULL) OR (post_format <> 'text' AND media_id IS NOT NULL));`
   - `ALTER TABLE public.queue_items ADD CONSTRAINT chk_queue_items_story_no_comment CHECK (post_format <> 'story' OR first_comment IS NULL);`
2. **`public.facebook_pages`**:
   - `ALTER TABLE public.facebook_pages ADD COLUMN next_allowed_publish_at TIMESTAMPTZ;`
   - `ALTER TABLE public.facebook_pages ADD COLUMN buc_usage_pct INT DEFAULT 0;`
3. **`public.page_queue_slots`**:
   - `ALTER TABLE public.page_queue_slots ADD COLUMN allowed_formats TEXT[] DEFAULT ARRAY['reel', 'video', 'image', 'text', 'story'];`
4. **`public.media_items`**:
   - `ALTER TABLE public.media_items ADD COLUMN width INT;`
   - `ALTER TABLE public.media_items ADD COLUMN height INT;`
5. **Stored Procedures / RPCs**:
   - `settle_queue_item_outcome`: Single atomic settlement updating queue item, Facebook Page status/pacing, and parent Facebook Account status (`expired`).
   - `claim_due_queue_items`: Partitioned claiming by `fb_page_id` (`p_max_per_page`), filtering out `next_allowed_publish_at > now()`.
   - `recover_stuck_publishing_items`: Decoupled recovery RPC resetting items in `'publishing'` state $> 10$ minutes.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes
- **SC-001**: 100% of the 42 issues in `issues.md` are resolved with 0 omissions.
- **SC-002**: Publishing throughput capacity scales from 14,400 to $\ge 200,000$ posts/day via Cloudflare Queues fan-out and partitioned claiming.
- **SC-003**: All 5 canonical post formats (`text`, `image`, `reel`, `video`, `story`) can be scheduled, validated, and dispatched via Graph API v26.0.
- **SC-004**: 100% of OAuth failure codes (`190`, `102`, `10`, `200–299`) atomically cascade to mark parent Facebook Accounts as `expired`.
- **SC-005**: Media Library keyset pagination queries execute in $O(1)$ index time regardless of library depth (10,000+ items).
- **SC-006**: Remote media downloader streams reject files $> 500\text{ MB}$ pre-stream and enforce abort guards without isolate OOM crashes.
- **SC-007**: 0 hardcoded hex literals in component TSX/JSX outside `theme.ts` (100% compliance with theme token standards).
- **SC-008**: 0 raw SQL `db.query` or `isLegacyClient` branches remain in API route handlers.
- **SC-009**: 100% of customer-facing error messages pass through sanitization without technical plumbing leakage.
- **SC-010**: All remote CI checks and SonarCloud quality gates pass with 100% success and 0 errors.

---

## Assumptions

- Meta Graph API v26.0 remains the target API version for all publishing, insights, and OAuth operations.
- Upstash Redis REST credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) are provided in production environments; in-memory fallback is acceptable for local unit tests.
- Cloudflare Queues (`PUBLISH_QUEUE`) is configured in Cloudflare Workers for production fan-out; local test harnesses use mock/direct dispatch.
- Database schema changes are deployed strictly via versioned migration files under `supabase/migrations/` and run automatically on merge to `main`.
