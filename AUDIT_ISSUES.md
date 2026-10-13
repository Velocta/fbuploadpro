# FBUploadPro Codebase Audit: Comprehensive Issues Log

This document cataloging all 38 engineering, security, data-integrity, architectural, and design issues identified across the FBUploadPro monorepo.

---

## Domain Breakdown

- **P0: Critical Security & Production Outages** (Issues 01–06)
- **P1: Data Integrity, Query Safety & Worker Logic** (Issues 07–19)
- **P2: Frontend State, API Integration & Design System** (Issues 20–29)
- **P3: Dead Code, Tooling, CI/CD & Monorepo Hygiene** (Issues 30–38)

---

### Issue 01: Fix Header Spoofing Vulnerability in Auth & Middleware
- **Priority**: P0 (Security)
- **Labels**: `security`, `auth`, `p0`
- **Target Files**: `apps/web/src/lib/auth.ts`, `apps/web/src/middleware.ts`
- **Description**: `getServerSessionContext()` in `auth.ts` trusts `x-user-id`, `x-user-role`, `x-user-email`, and `x-user-subdomain` request headers before verifying the `fbup_session` cookie. In `middleware.ts`, requests to `/api/*` pass through without stripping incoming client-supplied `x-user-*` headers, allowing external callers to spoof roles (e.g., `x-user-role: admin`).
- **Acceptance Criteria**:
  - `auth.ts` cryptographically verifies the `fbup_session` cookie via `verifySessionToken` as the primary source of truth.
  - Header fallback is allowed only when `process.env.NODE_ENV === 'test'`, and validates roles against `UserRoleSchema` rather than `as UserRole`.
  - `middleware.ts` deletes any client-supplied `x-user-*` headers from incoming requests on all pass-through routes.
  - All unit/route auth tests pass.

---

### Issue 02: Centralize `getTokenEncryptionKey()` and Prohibit Hardcoded Keys in Production
- **Priority**: P0 (Security)
- **Labels**: `security`, `crypto`, `p0`
- **Target Files**: `packages/contracts/src/crypto/token.ts`, `apps/web/src/app/api/auth/facebook/callback/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/accounts/[accountId]/pages/discover/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/pages/import/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/route.ts`, `apps/web/src/app/api/tenant/[subdomain]/settings/byoc/test/route.ts`
- **Description**: Several API routes fall back to a public dummy 64-hex key (`0123456789abcdef...`) even when `NODE_ENV === 'production'`, and routes inconsistently look up `TOKEN_ENCRYPTION_KEY` vs `FB_ENCRYPTION_MASTER_KEY`.
- **Acceptance Criteria**:
  - Export `getTokenEncryptionKey(env?)` from `packages/contracts/src/crypto/token.ts` checking both keys.
  - Throws a descriptive `DomainError` if the key is missing when `NODE_ENV === 'production'`.
  - All API routes replace ad-hoc key resolutions with `getTokenEncryptionKey()`.
  - Unit tests verify that production mode throws when the key is absent.

---

### Issue 03: Fix `rate-limiter.ts` Production Crash & Persistent Storage Backing
- **Priority**: P0 (Outage)
- **Labels**: `bug`, `rate-limiter`, `p0`
- **Target Files**: `apps/web/src/lib/rate-limiter.ts`, `.env.production.example`, `.github/scripts/sync-vercel-env.mjs`, `.github/workflows/sync-vercel-env.yml`
- **Description**: `validateRateLimiterConfig()` crashes all rate-limited auth routes in production if `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` are unset, yet the code never calls Upstash and neither environment files nor Vercel sync scripts define these variables.
- **Acceptance Criteria**:
  - `rate-limiter.ts` does not crash production requests when Upstash environment variables are absent (or cleanly integrates persistent/RPC rate limiting).
  - Add missing Upstash environment variable blueprints to `.env.production.example` and `sync-vercel-env.mjs`.
  - Existing rate-limiting test suites pass.

---

### Issue 04: Fix `AuthSessionMissingError` in `resetUserPassword`
- **Priority**: P0 (Bug)
- **Labels**: `bug`, `auth`, `p0`
- **Target Files**: `apps/web/src/lib/supabase-auth.ts`, `apps/web/src/app/api/auth/reset-password/route.ts`
- **Description**: In `resetUserPassword()`, when called with `params.token` (recovery token), it calls `supabase.auth.updateUser({ password })` on an unauthenticated client without verifying the token first, throwing `AuthSessionMissingError`.
- **Acceptance Criteria**:
  - Verify `params.token` via `supabase.auth.verifyOtp({ token_hash: params.token, type: 'recovery' })` before calling `updateUser`.
  - Throw a clear user-safe error if token verification fails.
  - Test coverage confirms password reset with token parameter succeeds against mocked Supabase.

---

### Issue 05: Fix Column Names in `refreshConnectedPageTokens`
- **Priority**: P0 (Data Integrity)
- **Labels**: `bug`, `facebook`, `database`, `p0`
- **Target Files**: `apps/web/src/app/api/auth/facebook/callback/route.ts`
- **Description**: Reconnecting an expired account attempts to update `encrypted_page_token` and `token_expires_at` on `facebook_pages`. In the actual schema (`20261008120002_facebook_tokens.sql`), the column is `encrypted_access_token` and `token_expires_at` does not exist on `facebook_pages`, causing updates to fail silently.
- **Acceptance Criteria**:
  - Update `facebook_pages` using `encrypted_access_token` and remove references to `token_expires_at` on that table.
  - Verify that `{ error }` from Supabase is checked and logged.
  - Existing OAuth reconnect tests pass.

---

### Issue 06: Resolve Workspace BYOC Credentials in Magic-Link OAuth Route
- **Priority**: P0 (Bug)
- **Labels**: `bug`, `oauth`, `byoc`, `p0`
- **Target Files**: `apps/web/src/app/connect/facebook/route.ts`
- **Description**: `/connect/facebook/route.ts` hardcodes `process.env.FACEBOOK_APP_ID` and never resolves the workspace's Bring-Your-Own-Credentials (`workspace_byoc_credentials`), breaking magic-link connections for BYOC workspaces.
- **Acceptance Criteria**:
  - Query `workspace_byoc_credentials` using the workspace subdomain from the verified magic token to resolve `fb_app_id`.
  - Fall back to `process.env.FACEBOOK_APP_ID` if no BYOC record exists.
  - Redirect to error view if neither is configured.

---

### Issue 07: Use Constant-Time `crypto.subtle.verify` in `oauth.ts`
- **Priority**: P1 (Security)
- **Labels**: `security`, `crypto`, `p1`
- **Target Files**: `packages/contracts/src/domain/oauth.ts`
- **Description**: `verifySignedEnvelope` compares HMAC hex signatures using standard JavaScript `!==` equality, exposing a timing side-channel.
- **Acceptance Criteria**:
  - Convert `providedSignature` to `Uint8Array` and verify using `crypto.subtle.verify('HMAC', ...)` or constant-time comparison.
  - Reject invalid hex formats with `UnauthorizedError`.
  - All contracts OAuth tests pass.

---

### Issue 08: Support Multi-Workspace Ownership in Session & Tenant Auth
- **Priority**: P1 (Bug)
- **Labels**: `auth`, `rbac`, `p1`
- **Target Files**: `packages/contracts/src/domain/session.ts`, `packages/contracts/src/domain/rbac.ts`, `apps/web/src/lib/route-auth.ts`, `apps/web/src/app/api/workspaces/**`
- **Description**: `canAccessTenant` only compares `session.subdomain === targetSubdomain`. If an owner has multiple tabs open on different workspaces they own, switching workspaces in Tab B invalidates Tab A with 403 Forbidden.
- **Acceptance Criteria**:
  - Add optional `allowedSubdomains?: string[]` to `SessionPayloadSchema`.
  - Update `canAccessTenant` to permit access if `targetSubdomain` matches `session.subdomain` or is in `allowedSubdomains`.
  - Populates `allowedSubdomains` during workspace switch and creation.

---

### Issue 09: Fix UUID Type Mismatch and Invalid `'cancelled'` Status on Page Disconnect
- **Priority**: P1 (Bug)
- **Labels**: `database`, `bug`, `p1`
- **Target Files**: `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/route.ts`
- **Description**: Disconnecting a page runs `UPDATE queue_items SET status = 'cancelled' WHERE fb_page_id = String(fbPageId)`. `'cancelled'` violates the PostgreSQL check constraint and Zod schema, and `fb_page_id` is an internal `UUID`, not the external Meta string ID.
- **Acceptance Criteria**:
  - Filter `queue_items` by the internal `pageId` (UUID).
  - Update status to `'skipped'` (valid in DB and Zod schema).
  - Test confirms queued items transition to `'skipped'` on page disconnect.

---

### Issue 10: Fix UUID Cast Failure & PostgREST Filter Injection in Page Insights Route
- **Priority**: P1 (Bug)
- **Labels**: `security`, `database`, `p1`
- **Target Files**: `apps/web/src/app/api/tenant/[subdomain]/pages/[pageId]/insights/route.ts`
- **Description**: Querying `.or(\`id.eq.${pageId},fb_page_id.eq.${pageId}\`)` fails with `invalid input syntax for type uuid` when `pageId` is a numeric Meta ID, and interpolating unvalidated input into `.or()` allows filter injection.
- **Acceptance Criteria**:
  - Validate whether `pageId` is a UUID. If true, query `.eq('id', pageId)`; otherwise validate numeric format and query `.eq('fb_page_id', pageId)`.
  - Fix legacy branch column name reference to `encrypted_access_token`.

---

### Issue 11: Sanitize PostgREST `.or()` Search Input in Media List Route
- **Priority**: P1 (Bug)
- **Labels**: `database`, `bug`, `p1`
- **Target Files**: `apps/web/src/app/api/tenant/[subdomain]/media/route.ts`
- **Description**: Raw `search` strings containing commas, parentheses, or quotes break PostgREST `.or()` parsing with HTTP 500 or filter injection.
- **Acceptance Criteria**:
  - Escape PostgREST syntax delimiters (`\`, `"`, `%`, `_`) and quote search patterns safely.
  - Test verifies searching for terms with commas/parentheses (e.g. `reel, test (1).mp4`) succeeds.

---

### Issue 12: Preserve `starting_followers` on Re-Importing Active Pages
- **Priority**: P1 (Data Integrity)
- **Labels**: `database`, `bug`, `p1`
- **Target Files**: `apps/web/src/app/api/tenant/[subdomain]/pages/import/route.ts`
- **Description**: Re-importing an existing active page via Supabase unconditionally overwrites `starting_followers: followers`, resetting historical follower growth (`followersGained`) to 0.
- **Acceptance Criteria**:
  - Query existing active pages before upserting; preserve `starting_followers` if page status is not `'disconnected'`.
  - Add test asserting follower baseline is preserved on active re-import.

---

### Issue 13: Replace Full `media_items` Scan in `media/folders/route.ts`
- **Priority**: P1 (Performance)
- **Labels**: `performance`, `database`, `p1`
- **Target Files**: `apps/web/src/app/api/tenant/[subdomain]/media/folders/route.ts`
- **Description**: `handleListFolders` fetches all `media_items` rows into memory to count items per folder, causing network bloat and truncation at PostgREST's 1,000-row limit.
- **Acceptance Criteria**:
  - Use database-level count `{ count: 'exact', head: true }` or embedded `media_items(count)` aggregation.
  - Tests verify accurate folder counts without loading full row lists.

---

### Issue 14: Add Missing Database Indexes for Nested Folders & Publishing Queue
- **Priority**: P1 (Performance)
- **Labels**: `database`, `performance`, `p1`
- **Target Files**: `supabase/migrations/20261014100000_performance_indexes.sql`
- **Description**: Missing indexes on stale publishing queue recovery and case-insensitive workspace subdomains lead to table scans as data grows.
- **Acceptance Criteria**:
  - Create forward migration adding partial index on `queue_items(status, updated_at) WHERE status = 'publishing'`.
  - Add functional index on `workspaces(LOWER(subdomain))`.

---

### Issue 15: Filter Out Paused and Unhealthy Pages in `claim_due_queue_items`
- **Priority**: P1 (Bug)
- **Labels**: `worker`, `database`, `p1`
- **Target Files**: `supabase/migrations/20261014110000_hardened_claim_and_settle_rpc.sql`, `apps/worker/src/dispatcher.ts`
- **Description**: `claim_due_queue_items` claims due queue items without checking if `facebook_pages.status` is `'active'`, causing the worker to publish posts for paused or checkpointed pages.
- **Acceptance Criteria**:
  - Migration updates `claim_due_queue_items` to join `facebook_pages` and require status to be active (or eligible rate-limit cooldown).
  - Recovers items stuck in `'publishing'` for >10 minutes.
  - Updates `CLAIM_DUE_ITEMS_SQL` in `dispatcher.ts` with the same filter.

---

### Issue 16: Fix Tautological Retry Condition in `apps/worker/src/dispatcher.ts`
- **Priority**: P1 (Bug)
- **Labels**: `worker`, `bug`, `p1`
- **Target Files**: `apps/worker/src/fb-client.ts`, `apps/worker/src/dispatcher.ts`
- **Description**: `canRetry` has `(isRateLimit || !isAuthError)` which is always true when `!isAuthError` is checked, causing permanent 4xx client errors (e.g. Graph API code 100) to be retried repeatedly.
- **Acceptance Criteria**:
  - Add `isPermanentClientError` property to `FacebookGraphError` for 4xx client errors.
  - `canRetry` explicitly excludes permanent client errors.
  - Test confirms code 100 fails immediately with status `'failed'`.

---

### Issue 17: Fix Missing `retry_count` Increment & Check Supabase Errors in Worker
- **Priority**: P1 (Bug)
- **Labels**: `worker`, `bug`, `p1`
- **Target Files**: `apps/worker/src/dispatcher.ts`, `apps/worker/src/settlement.ts`
- **Description**: In `dispatcher.ts` (`recordDispatchOutcome`), the Supabase branch does not increment `retry_count` on retry/fail, and `settleSupabaseOutcome` never inspects `{ error }` on `.update()` and `.insert()`.
- **Acceptance Criteria**:
  - `settleSupabaseOutcome` checks `{ error }` on all Supabase calls and throws if an error is present.
  - `recordDispatchOutcome` increments `retry_count` in the Supabase branch.

---

### Issue 18: Fix 4 Data-Corruption and Security Bugs in `apps/worker/src/insights-sync.ts`
- **Priority**: P1 (Data Integrity)
- **Labels**: `worker`, `security`, `p1`
- **Target Files**: `apps/worker/src/insights-sync.ts`, `apps/worker/tests/insights-sync.test.ts`
- **Description**:
  1. Failed metrics API calls silently return 0 and overwrite valid snapshots.
  2. Tokens are leaked in URL query parameters (`?access_token=`).
  3. `targetDate` is never passed as `since`/`until` to the Graph API.
  4. Video watch time conversion threshold corrupts small millisecond values into giant second values.
- **Acceptance Criteria**:
  - Pass token in `Authorization: Bearer` header.
  - Throw on non-OK Graph API responses.
  - Pass `targetDate` as `since`/`until` on API queries.
  - Convert `page_video_view_time` consistently (`Math.round(ms / 1000)`).
  - Test suite verifies all four fixes.

---

### Issue 19: Bound Concurrency in `syncDailyPageInsights`
- **Priority**: P1 (Performance)
- **Labels**: `worker`, `performance`, `p1`
- **Target Files**: `apps/worker/src/insights-sync.ts`
- **Description**: `syncDailyPageInsights` runs `Promise.all` across all active pages simultaneously. At 5 subrequests per page, syncing >10 pages exceeds Cloudflare Worker subrequest limits.
- **Acceptance Criteria**:
  - Add a concurrency pool (default 5 concurrent pages) to process eligible pages in chunks.
  - Unit tests verify batching behavior.

---

### Issue 20: Use `Authorization: Bearer` Headers in `facebook-insights-client.ts`
- **Priority**: P1 (Security)
- **Labels**: `security`, `facebook`, `p1`
- **Target Files**: `apps/web/src/lib/insights/facebook-insights-client.ts`
- **Description**: `facebook-insights-client.ts` puts access tokens in the URL query string across all 3 Graph API functions, and watch time conversion uses inconsistent thresholds.
- **Acceptance Criteria**:
  - Move access tokens to `Authorization: Bearer` headers.
  - Standardize watch time conversions.
  - Security token-leakage tests pass.

---

### Issue 21: Fix `data.page` Unwrapping in Dedicated Page View
- **Priority**: P2 (UI Bug)
- **Labels**: `ui`, `bug`, `p2`
- **Target Files**: `apps/web/src/app/tenant/[subdomain]/pages/[pageId]/page.tsx`
- **Description**: `GET /api/tenant/[subdomain]/pages/[pageId]` returns `{ page: ... }`, but `fetchPageDetails` calls `setPage(data)` instead of `setPage(data.page ?? data)`, leaving `page.name`, `page.id`, and `page.status` undefined. Similarly, `handleStatusToggle` reads `updated.status` instead of `updated.page?.status`.
- **Acceptance Criteria**:
  - Unwrap `data?.page ?? data` in `fetchPageDetails`.
  - Unwrap `updated?.page?.status ?? updated?.status` in `handleStatusToggle`.
  - Dedicated page UI tests pass.

---

### Issue 22: Fix Caption Mapping (`captionText`), Double Fetch, and Selection in `EnqueueModal`
- **Priority**: P2 (UI Bug)
- **Labels**: `ui`, `bug`, `p2`
- **Target Files**: `apps/web/src/components/pages/dedicated/enqueue-modal.tsx`
- **Description**:
  1. Reads `m.caption` instead of `m.captionText` from `/media` response, dropping saved captions.
  2. `selectedMediaId` in `useEffect` dependency array causes an immediate duplicate fetch on open.
  3. Clicking a different media item does not update the caption textarea if previously filled.
- **Acceptance Criteria**:
  - Map `caption: m.captionText ?? m.caption ?? null`.
  - Remove `selectedMediaId` from the fetch effect dependencies.
  - Update caption on new media selection unless user has dirty-edited the text.

---

### Issue 23: Stop Swallowing R2 `PUT` Upload Failures in `upload-queue-banner.tsx`
- **Priority**: P2 (Bug)
- **Labels**: `ui`, `storage`, `p2`
- **Target Files**: `apps/web/src/components/media/upload-queue-banner.tsx`
- **Description**: When uploading to presigned R2 URLs, `uploadSingleFile` never checks `putRes.ok` and catches/swallows errors, still calling `/media/confirm` and creating database records for failed uploads.
- **Acceptance Criteria**:
  - Check `putRes.ok` and throw if false.
  - Do not swallow errors; record failed files in `failedEntries` for the Retry button.

---

### Issue 24: Fix Uncalled `COMPONENT_STYLES.secondaryButton` Function Spreads
- **Priority**: P2 (UI Bug)
- **Labels**: `ui`, `theme`, `p2`
- **Target Files**: `apps/web/src/components/pages/dedicated/page-header.tsx`, `apps/web/src/components/pages/dedicated/tab-dashboard.tsx`
- **Description**: Spreading `...COMPONENT_STYLES.secondaryButton` without `()` evaluates to `{}` because it is a function, removing all styling from multiple buttons.
- **Acceptance Criteria**:
  - Call `COMPONENT_STYLES.secondaryButton(THEME.default)` with `()` in `page-header.tsx` and `tab-dashboard.tsx`.

---

### Issue 25: Bind `window.fetch` in `WorkspaceLifecycleGuard`
- **Priority**: P2 (UI Bug)
- **Labels**: `ui`, `desktop`, `p2`
- **Target Files**: `apps/web/src/components/workspace/workspace-lifecycle-guard.tsx`
- **Description**: Calling `originalFetch(...args)` without binding `window` throws `TypeError: Illegal invocation` in Safari and macOS Tauri `WKWebView`.
- **Acceptance Criteria**:
  - Bind `originalFetch = window.fetch.bind(window)`.
  - Safely restore original fetch on cleanup.

---

### Issue 26: Reset Avatar Error State on Page Navigation in `DedicatedPageHeader`
- **Priority**: P2 (UI Bug)
- **Labels**: `ui`, `p2`
- **Target Files**: `apps/web/src/components/pages/dedicated/page-header.tsx`
- **Description**: `imageError` is a boolean that never resets when `page.profilePictureUrl` changes, permanently showing fallback initials after one failed image.
- **Acceptance Criteria**:
  - Track `failedAvatarUrl !== page.profilePictureUrl` (matching `page-card.tsx`).

---

### Issue 27: Fix Design System Violations Across Insights, BYOC Settings, and Modals
- **Priority**: P2 (UI / Design)
- **Labels**: `ui`, `theme`, `p2`
- **Target Files**: `apps/web/src/components/pages/dedicated/tab-insights.tsx`, `apps/web/src/components/settings/byoc-settings-view.tsx`, `apps/web/src/components/workspace/create-workspace-modal.tsx`
- **Description**:
  1. Chart grid uses hardcoded dark line `stroke="rgba(255, 255, 255, 0.05)"`, invisible in Light Mode.
  2. Reaction/demographic bars and BYOC status use prohibited `RADII.full` capsule pills (`DESIGN.md` Section 7.3 & 8).
  3. `create-workspace-modal.tsx` submit button references undefined CSS variables `--btn-primary-bg` and `--btn-primary-fg`.
- **Acceptance Criteria**:
  - Use `var(--border-subtle)` on chart grid.
  - Use `RADII.xs` (`4px`) on progress/metric bars.
  - Use unboxed `StatusDot` for BYOC status.
  - Use `COMPONENT_STYLES.primaryButton` on Create Workspace submit button.

---

### Issue 28: Consolidate Duplicate Inline `<style>` Blocks into `globals.css`
- **Priority**: P2 (Performance)
- **Labels**: `ui`, `css`, `p2`
- **Target Files**: `apps/web/src/app/globals.css`, `apps/web/src/components/ui/*`
- **Description**: UI primitives (`button`, `input`, `select`, `checkbox`, `switch`, `skeleton`, `textarea`) each inject duplicate `<style>` tags into the DOM on every component instance.
- **Acceptance Criteria**:
  - Consolidate `.fbu-*` classes and animations into `globals.css`.
  - Remove duplicate inline `<style>` tags from UI primitives.

---

### Issue 29: Align Batch Caption Max Length to 5,000 Characters in `media.ts`
- **Priority**: P2 (Schema)
- **Labels**: `contracts`, `schema`, `p2`
- **Target Files**: `packages/contracts/src/domain/media.ts`
- **Description**: `BatchMediaRequestSchema` caps `captionText` at 2,200 characters, whereas single-item schemas and queue items allow 5,000 characters.
- **Acceptance Criteria**:
  - Update `BatchMediaRequestSchema` to `.max(5000)`.

---

### Issue 30: Purge Deprecated `billing.ts` and `InsufficientFundsError` Dead Code
- **Priority**: P3 (Dead Code)
- **Labels**: `cleanup`, `contracts`, `p3`
- **Target Files**: `packages/contracts/src/domain/billing.ts`, `packages/contracts/tests/billing.test.ts`, `packages/contracts/src/errors/domain-error.ts`
- **Description**: Spec 007 abolished token billing, but empty placeholder `billing.ts`, `billing.test.ts`, and `InsufficientFundsError` remain in the contracts package.
- **Acceptance Criteria**:
  - Remove `billing.ts` and `billing.test.ts`.
  - Remove `InsufficientFundsError` and `INSUFFICIENT_FUNDS` from `domain-error.ts`.
  - Verify build and tests pass.

---

### Issue 31: Harden Tauri v2 Command Handlers in `apps/desktop/src-tauri/`
- **Priority**: P3 (Desktop)
- **Labels**: `desktop`, `rust`, `p3`
- **Target Files**: `apps/desktop/src-tauri/src/main.rs`
- **Description**: Verify desktop window commands and URL opening handlers validate schemes strictly (`http`/`https` only) and keep existing tests passing.
- **Acceptance Criteria**:
  - Validate that `open_external_url` rejects URLs with credentials or unsafe protocols.
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` passes.

---

### Issue 32: Configure `typescript-eslint` in `eslint.config.mjs`
- **Priority**: P3 (Tooling)
- **Labels**: `dx`, `lint`, `p3`
- **Target Files**: `eslint.config.mjs`, `package.json`
- **Description**: ESLint v9 Flat Config only loads `@eslint/js` (`js.configs.recommended`), silently skipping all `.ts` and `.tsx` files during `pnpm lint`.
- **Acceptance Criteria**:
  - Install `typescript-eslint` and configure it across `**/*.{ts,tsx}` files.
  - Enable `@typescript-eslint/no-unused-vars` with standard ignore patterns.
  - `pnpm turbo run lint` checks all TypeScript files.

---

### Issue 33: Untrack `apps/web/tsconfig.tsbuildinfo` from Git
- **Priority**: P3 (Git Hygiene)
- **Labels**: `git`, `cleanup`, `p3`
- **Target Files**: `apps/web/tsconfig.tsbuildinfo`, `.gitignore`
- **Description**: `apps/web/tsconfig.tsbuildinfo` is tracked in Git, polluting commits and cache hashes.
- **Acceptance Criteria**:
  - Untrack with `git rm --cached apps/web/tsconfig.tsbuildinfo`.
  - Ensure `.gitignore` ignores `*.tsbuildinfo`.

---

### Issue 34: Align `@types/node` Across Workspaces and Upgrade Node in `sonar.yml`
- **Priority**: P3 (Dependencies)
- **Labels**: `dependencies`, `ci`, `p3`
- **Target Files**: `package.json`, `.github/workflows/sonar.yml`
- **Description**: Workspaces resolve conflicting `@types/node` versions (`22.20.5` vs `26.6.4`), duplicating dependencies in `pnpm-lock.yaml`, and `sonar.yml` still uses Node 20.
- **Acceptance Criteria**:
  - Add root pnpm override for `@types/node: ^22.13.4`.
  - Upgrade `sonar.yml` to `node-version: 22`.

---

### Issue 35: Restore Real Quality Gates in `sonar-project.properties`
- **Priority**: P3 (Tooling)
- **Labels**: `sonar`, `ci`, `p3`
- **Target Files**: `sonar-project.properties`
- **Description**: Properties file references the deleted `packages/database`, disables coverage tracking globally (`**/*`), and disables cognitive complexity across all files.
- **Acceptance Criteria**:
  - Remove `packages/database/**` references.
  - Scope coverage exclusions strictly to configs, tests, and UI primitives.
  - Remove API routes from copy-paste exclusions.

---

### Issue 36: Add CI Rust Verification & CD Workflows for Worker and Supabase Migrations
- **Priority**: P3 (DevOps)
- **Labels**: `devops`, `ci`, `p3`
- **Target Files**: `.github/workflows/ci.yml`, `.github/workflows/deploy-worker.yml`, `.github/workflows/deploy-supabase.yml`
- **Description**: CI does not verify Rust desktop compilation, and there are no automated GitHub Actions deployment workflows for Cloudflare Worker or Supabase migrations.
- **Acceptance Criteria**:
  - Add `cargo check` and `cargo test` to `ci.yml`.
  - Add workflow for automated `wrangler deploy` on push to main.
  - Add workflow for automated `supabase db push` on push to main.

---

### Issue 37: Organize Loose Test Files & Deduplicate Auth Tests in `apps/web/tests/`
- **Priority**: P3 (Testing)
- **Labels**: `testing`, `cleanup`, `p3`
- **Target Files**: `apps/web/tests/`
- **Description**: Root `apps/web/tests/` has 8 loose test files, and two duplicate forgot-password test files exist (`forgot-password.test.tsx` and `forgot-password-ui.test.tsx`).
- **Acceptance Criteria**:
  - Move root test files into `tests/api/`, `tests/middleware/`, or `tests/unit/`.
  - Merge duplicate forgot-password tests into one file and remove the redundant file.
  - All test suites pass in their new paths.

---

### Issue 38: Renumber Duplicate Specification Directories in `specs/`
- **Priority**: P3 (SpecKit)
- **Labels**: `speckit`, `cleanup`, `p3`
- **Target Files**: `specs/`
- **Description**: Multiple directories share the same prefix number (`025`, `030`, `031`), and `034` is missing.
- **Acceptance Criteria**:
  - Rename directories so each has a unique, sequential 3-digit prefix (`025`, `026`, `030`, `031`, `034`, `040`).
  - Update any internal markdown cross-references.
