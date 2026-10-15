# Implementation Tasks: Platform Audit Remediation (Spec 045)

**Feature Branch**: `fix/045-platform-audit-remediation`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Total Issues Covered**: 42 / 42 (from [`issues.md`](file:///home/agent/.gemini/antigravity/worktrees/fbuploadpro/sync_latest_main_code/issues.md))

---

## Phase 1: Foundational (Database Migrations & Core Contracts)

**Purpose**: Core database schema upgrades, stored procedures, and shared contract types required across all modules.

- [x] T001 [P] Create database migration `supabase/migrations/20261018000000_platform_audit_remediation.sql` with schema alters for `public.queue_items` (nullable `media_id`, `post_format` enum check, `link_url`, constraints `chk_queue_items_format_media` and `chk_queue_items_story_no_comment`).
- [x] T002 [P] Add schema alters for `public.facebook_pages` (`next_allowed_publish_at`, `buc_usage_pct`), `public.page_queue_slots` (`allowed_formats`), and `public.media_items` (`width`, `height`, duplicate and cursor indexes) in `supabase/migrations/20261018000000_platform_audit_remediation.sql`.
- [x] T003 Implement atomic stored procedure `public.settle_queue_item_outcome` in `supabase/migrations/20261018000000_platform_audit_remediation.sql` supporting Page pacing and atomic parent Account expiration cascade.
- [x] T004 Implement partitioned claim RPC `public.claim_due_queue_items(p_limit, p_max_per_page)` and decoupled recovery RPC `public.recover_stuck_publishing_items(p_timeout_minutes)` in `supabase/migrations/20261018000000_platform_audit_remediation.sql`.
- [x] T005 [P] Update `@fbuploadpro/contracts` with `PostFormatSchema`, updated `EnqueueItemRequestSchema`, and `UpdateQueueItemRequestSchema` enforcing format rules and story comment restrictions in `packages/contracts/src/domain/queue.ts`.
- [x] T006 [P] Add `validatePostFormatEligibility` and keyset pagination `MediaListQuerySchema` (`cursor`) in `packages/contracts/src/domain/media.ts`.
- [x] T007 [P] Consolidate canonical Graph API error classification into `evaluateGraphApiError` in `packages/contracts/src/domain/facebook.ts` handling OAuth codes (`190`, `102`, `10`, `200–299`), duplicate codes (`506`, `368 / 1404082`), bad link (`1609005`), rate limits (`80001`, `341`), and checkpoints (`368 / 4854002`).
- [x] T008 [P] Enforce production runtime master key guard against `DEV_FALLBACK_ENCRYPTION_KEY` in `packages/contracts/src/crypto/token.ts`.
- [x] T009 Add unit tests validating all contract schemas, crypto guards, and error classifications in `packages/contracts/tests/`.

---

## Phase 2: User Story 1 - Enterprise Multi-Format Publishing Engine & 200k Throughput Scale (Priority: P1)

**Goal**: Deliver 5-format publishing (`text`, `image`, `reel`, `video`, `story`), Graph API v26.0 client methods, Cloudflare Queue fan-out, fair-share claim partitioning, pacing, and transcoding race handling.  
**Issues Covered**: Issues 7, 8, 25, 26, 27, 28, 29, 30, 31 (FR-007, FR-008, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031).

- [x] T010 [US1] Implement Graph API v26.0 publishers `publishTextPost`, `publishVideo`, `publishPhotoStory`, and 3-phase `publishVideoStory` in `apps/worker/src/fb-client.ts`.
- [x] T011 [US1] Parse `X-Business-Use-Case-Usage` and `X-App-Usage` headers in `apps/worker/src/fb-client.ts` and expose calculated `nextAllowedPublishAt` and `bucUsagePct`.
- [x] T012 [US1] Wire all 5 format publishers into `dispatchItem` in `apps/worker/src/dispatcher.ts` and dispatch according to item `post_format`.
- [x] T013 [US1] Implement bounded retry loop for `postComment` during video/reel transcoding; on permanent failure, record main post as `published` with a warning log rather than duplicate-publishing.
- [x] T014 [US1] Refactor `settleOutcome` in `apps/worker/src/settlement.ts` and `recordDispatchOutcome` in `apps/worker/src/dispatcher.ts` to call atomic RPC `settle_queue_item_outcome`.
- [x] T015 [US1] Scale worker claim batch in `fanOutClaimedBatches` (`apps/worker/src/index.ts`) and wrap `queue.sendBatch` in a try/catch that reverts unsent items to `status = 'queued'` on failure.
- [x] T016 [US1] Update `recoverStuckPublishingItems` in `apps/worker/src/index.ts` to log errors via `console.error` rather than silently swallowing exceptions.
- [x] T017 [US1] Update `EnqueueModal` (`apps/web/src/components/pages/dedicated/tab-dashboard.tsx` / `apps/web/src/components/pages/enqueue-modal.tsx`) to support selecting all 5 post formats, hide `firstComment` when `postFormat === 'story'`, and validate eligibility via `validatePostFormatEligibility`.
- [x] T018 [US1] Update `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/route.ts` and `apps/web/src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/route.ts` to handle `post_format`, `link_url`, and enforce story first-comment suppression.
- [x] T019 [US1] Add worker dispatcher and publishing unit tests in `apps/worker/tests/dispatcher.test.ts` and `apps/worker/tests/fb-client.test.ts`.

---

## Phase 3: User Story 2 - Resilient Account OAuth Lifecycle & BYOC Configuration (Priority: P1)

**Goal**: Atomic account status cascade on OAuth failure, zero plumbing error leaks, non-optimistic BYOC status, and proactive token health countdown.  
**Issues Covered**: Issues 1, 2, 3, 4, 5, 6 (FR-001, FR-002, FR-003, FR-004, FR-005, FR-006).

- [x] T020 [US2] Verify atomic cascade in `settle_queue_item_outcome`: when `accountStatus === 'expired'`, parent `facebook_accounts.status = 'expired'`.
- [x] T021 [US2] Sanitize error responses in `apps/web/src/app/api/auth/facebook/route.ts` and `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/test/route.ts` using `sanitizeAuthErrorMessage`.
- [x] T022 [US2] Update `TenantAccountsPage` (`apps/web/src/app/tenant/[subdomain]/accounts/page.tsx`) to initialize `byocStatus` to `{ isConfigured: false, isLoading: true, error: null }` and gate connect button during loading.
- [x] T023 [US2] Add non-blocking retry banner to `TenantAccountsPage` when BYOC check fails with `500` or network exception, retaining existing configured state.
- [x] T024 [US2] Add `expiring_soon` filter option to `AccountsFilterBar` and surface token expiration countdown metadata and re-authentication CTA on `AccountCard`.
- [x] T025 [US2] Add unit tests for auth error sanitization and BYOC status error handling in `apps/web/tests/api/auth-facebook.test.ts` and `apps/web/tests/ui/byoc-settings.test.tsx`.

---

## Phase 4: User Story 3 - High-Performance Media Library, Keyset Pagination & Safe Cascades (Priority: P1)

**Goal**: Keyset cursor pagination ($O(1)$ index scan), server-side folder duplicate checks, R2 WebP thumbnail uploads, format eligibility metadata, and chunked R2 folder deletions.  
**Issues Covered**: Issues 16, 17, 18, 19, 20, 21 (FR-016, FR-017, FR-018, FR-019, FR-020, FR-021).

- [x] T026 [US3] Implement keyset cursor pagination (`WHERE (created_at, id) < (cursor_created_at, cursor_id) ORDER BY created_at DESC, id DESC`) in `apps/web/src/app/api/tenant/[subdomain]/media/route.ts`.
- [x] T027 [US3] Update `MediaLibraryExplorer` (`apps/web/src/components/media/media-library-explorer.tsx`) to use keyset cursor pagination and eliminate offset drift.
- [x] T028 [US3] Create API endpoint `POST /api/tenant/[subdomain]/media/check-duplicates` (`apps/web/src/app/api/tenant/[subdomain]/media/check-duplicates/route.ts`) to check folder duplicates across all database rows.
- [x] T029 [US3] Wire duplicate check in `MediaLibraryExplorer` to call `POST .../check-duplicates` before starting batch uploads.
- [x] T030 [US3] Update video frame capture in `MediaPreviewModal` to upload WebP blobs to Cloudflare R2 presigned URLs (`users/{userId}/thumbnails/{mediaId}.webp`) and reject raw `data:` base64 URLs in production in `handleUpdateMedia`.
- [x] T031 [US3] Extract `width` and `height` pixel dimensions during metadata probing and persist on `media_items` in `apps/web/src/app/api/tenant/[subdomain]/media/confirm/route.ts`.
- [x] T032 [US3] Batch R2 object deletions using chunked `Promise.allSettled` (up to 1,000 keys per batch) with bounded concurrency in `handleDeleteFolder` (`apps/web/src/app/api/tenant/[subdomain]/media/folders/[folderId]/route.ts`).
- [x] T033 [US3] Attach human-readable `failureReason` to each `QueuedUploadEntry` and render expandable failure summary in `UploadQueueBanner`.
- [x] T034 [US3] Add unit tests for keyset pagination, duplicate checking, and chunked folder deletions in `apps/web/tests/api/media-*.test.ts`.

---

## Phase 5: User Story 4 - Cloud Media Downloader Streaming Resilience & Memory Safety (Priority: P2)

**Goal**: Pre-stream size validation, byte-counting transform stream abort guard, fail-fast polling on permanent HTTP errors, and cancel support.  
**Issues Covered**: Issues 22, 23, 24 (FR-022, FR-023, FR-024).

- [x] T035 [US4] Implement pre-stream `HEAD` validation (rejecting $> 524,288,000$ bytes) and byte-counting `TransformStream` abort guard in `apps/worker/src/services/downloader-engine.ts` and `apps/web/src/lib/media-downloader.ts`.
- [x] T036 [US4] Refactor `pollDownloadJobCompletion` (`apps/web/src/components/media/...`) to wrap fetch in try/catch, immediately fail-fast on `401`, `403`, `404`, and bound transient retry attempts.
- [x] T037 [US4] Add `AbortSignal` cancellation support, progress stage reporting (`resolving` vs. `streaming`), and "Abort Download" button in the Downloader UI.
- [x] T038 [US4] Add unit tests for pre-stream abort guards and polling fail-fast logic in `apps/worker/tests/downloader-worker.test.ts`.

---

## Phase 6: User Story 5 - Real Upstash Redis Insights Caching & Analytics Visualizations (Priority: P2)

**Goal**: Real Upstash Redis REST caching, database snapshot prioritization, paginated worker sync, dual-metric chart, and layout skeleton loader.  
**Issues Covered**: Issues 32, 33, 34, 35, 36, 37 (FR-032, FR-033, FR-034, FR-035, FR-036, FR-037).

- [x] T039 [US5] Implement real Upstash Redis REST calls (`GET` / `SET ... EX`) in `apps/web/src/lib/insights/insights-cache.ts` when credentials exist, with in-memory `Map` as L1 fallback.
- [x] T040 [US5] Query `page_insights_daily_snapshots` first in `handleGetInsights` (`apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`) before falling back to Graph API.
- [x] T041 [US5] Paginate active pages query in `syncDailyPageInsights` (`apps/worker/src/insights-sync.ts`) using cursor/range batches (50–100 per batch) with bounded concurrency.
- [x] T042 [US5] Propagate Graph API errors from `FacebookInsightsClient` and prohibit caching zeroed fallback responses or assigning `s-maxage=900` on failure.
- [x] T043 [US5] Render dual-series trajectory chart plotting both Followers (`pageFollows`) and Content Impressions/Views (`pageViews`) in `apps/web/src/components/pages/dedicated/tab-insights.tsx`.
- [x] T044 [US5] Replace text-only loading state in `tab-insights.tsx` with structured skeleton loaders matching KPI grid/chart layout, and remove filled background comparison tracks.
- [x] T045 [US5] Add unit tests for Upstash Redis caching and insights snapshot querying in `apps/web/tests/api/page-insights-*.test.ts`.

---

## Phase 7: User Story 6 - Dedicated Page Workspace & Operational Controls (Priority: P2)

**Goal**: Elimination of write amplification in `GET /pages`, zeroed follower initial state, format-aware slots, timestamp validation, aggregated queue counters, checkpoint banner, and skipped/cancelled filter tabs.  
**Issues Covered**: Issues 9, 10, 11, 12, 13, 14, 15 (FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015).

- [x] T046 [US6] Remove synchronous `UPDATE` queries from `handleListPages` in `apps/web/src/app/api/tenant/[subdomain]/pages/route.ts` and evaluate effective status dynamically via `evaluatePageHealth`.
- [x] T047 [US6] Initialize follower metrics in `DedicatedPageView` (`apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`) to `0` or fetch real database values, eliminating fake `12,360` placeholder metrics.
- [x] T048 [US6] Add format filtering in `calculateNextVacantSlot` (`apps/web/src/lib/slot-scheduler.ts`) matching candidate slots against `page_queue_slots.allowed_formats`.
- [x] T049 [US6] Validate timestamp with `Number.isNaN(new Date(time).getTime())` in `resolveScheduledTime` (`apps/web/src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/route.ts`) returning 400 `ValidationError`.
- [x] T050 [US6] Return server-side aggregated status counts (`queuedCount`, `publishedCount`, `failedCount`) in `GET /api/tenant/[subdomain]/publishing/queue/route.ts`.
- [x] T051 [US6] Render instructional checkpoint banner and 1-click "Reactivate Page" button calling `PATCH /pages/[pageId]` when `page.status === 'page_checkpoint'` in `DedicatedPageHeader` and `PageTabSettings`.
- [x] T052 [US6] Add `'skipped'` and `'cancelled'` status filter buttons in `PageTabQueue` (`apps/web/src/components/pages/dedicated/tab-queue.tsx`).
- [x] T053 [US6] Add unit tests for format-aware slot scheduling and timestamp validation in `apps/web/tests/api/publishing-queue*.test.ts`.

---

## Phase 8: User Story 7 - Cross-Cutting Auth, RBAC, Workspace Guard & Design System Hairlines (Priority: P3)

**Goal**: Strict `STATUS_SIGNALS` theme tokens on `StatusDot` (zero hex literals), public error voice, elimination of legacy `db.query` branches, and StrictMode fetch guard.  
**Issues Covered**: Issues 38, 39, 40, 41, 42 (FR-038, FR-039, FR-040, FR-041, FR-042).

- [x] T054 [US7] Import `STATUS_SIGNALS` from `@/lib/theme` in `apps/web/src/components/ui/status-dot.tsx` and eliminate all hardcoded hex literals (`#848e9c`).
- [x] T055 [US7] Correct fallback message in `apps/web/src/app/api/auth/forgot-password/route.ts` to `"Unable to initiate password reset at this moment. Please try again shortly."`.
- [x] T056 [US7] Map `DomainErrorCode.FORBIDDEN` in `assertRole` (`apps/web/src/lib/rbac.ts`) to customer-friendly copy: `"You don't have permission to perform this action in this workspace."`.
- [x] T057 [US7] Remove all `isLegacyClient` and `db.query(...)` branches from API route handlers and migrate unit test mocks to typed `SupabaseClient<Database>` mocks.
- [x] T058 [US7] Ensure `useEffect` cleanup in `WorkspaceLifecycleGuard` (`apps/web/src/components/workspace/workspace-lifecycle-guard.tsx`) restores `window.fetch = originalFetch` and guards against double-wrapping with a symbol flag.
- [x] T059 [US7] Add unit tests for `StatusDot` styling, forgot-password error copy, and `assertRole` public copy in `apps/web/tests/`.

---

## Phase 9: Polish, Documentation & Verification

**Purpose**: Documentation updates, roadmap milestone synchronization, and quickstart validation.

- [x] T060 Update `docs/foundational-knowledge.md` with Spec 045 architecture, multi-format publishing engine, and 200k scale milestones.
- [x] T061 Mark all 42 issues in `issues.md` as remediated under Spec 045.
- [x] T062 Validate quickstart verification procedures against implementation artifacts.
- [x] T063 Run `/speckit-converge` to audit 100% convergence across `spec.md`, `plan.md`, and `tasks.md`.
