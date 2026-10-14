# FBUploadPro — Architectural & Edge-Case Remediation Plan (`ISSUES.md`)

**Confirmed Platform Rules:**
1. **Email Policy:** Strictly `@gmail.com` / `@googlemail.com` with canonicalization.
2. **Domain / Preview Routing:** Vercel `.vercel.app` and `localhost` fallback behavior remains as currently designed.
3. **Global Media Library:** `media_folders` and `media_items` are global per `user_id` (shared across all workspaces owned by the user), whereas `facebook_accounts`, `facebook_pages`, `page_queue_slots`, `queue_items`, `publish_logs`, and `page_insights_daily_snapshots` are strictly isolated per `workspace_id`.
4. **Magic Link Window:** Reusable within its 15-minute validity window (`exp`); update UI error copy to remove misleading "single-use" wording.
5. **Multi-Workspace Facebook Accounts & Pages:** Legacy `(user_id, fb_account_id)` and `(user_id, fb_page_id)` unique constraints and upserts must be completely replaced with `(workspace_id, fb_account_id)` and `(workspace_id, fb_page_id)` so a user can connect the same Facebook Account and Pages to multiple workspaces independently.

---

## Issue 1: Legacy vs. Multi-Workspace Unique Constraints & Upserts on `facebook_accounts` and `facebook_pages` (P0)

### Problem
* Earlier migrations and upsert queries (e.g., `upsertConnectedFacebookAccount` in `/api/auth/facebook/callback`, `handleImportPages`, and `docs/facebook-graph-api/error-handling.md`) referenced legacy `(user_id, fb_account_id)` or `(user_id, fb_page_id)` conflict targets.
* When a user connects the same Facebook Account or imports the same Facebook Page into **Workspace B** while it is already connected in **Workspace A**, a `(user_id, fb_account_id)` or `(user_id, fb_page_id)` unique constraint either throws a duplicate key error or overwrites `workspace_id`, stealing the account/page from Workspace A.

### Solution
1. **Database Migration (`supabase/migrations/20261015120000_multi_workspace_fb_constraints_and_cooldown.sql`):**
   * Drop any legacy unique constraints/indexes on `facebook_accounts(user_id, fb_account_id)` and `facebook_pages(user_id, fb_page_id)`.
   * Ensure `uq_fb_accounts_workspace_account UNIQUE (workspace_id, fb_account_id)` on `public.facebook_accounts` and `uq_fb_pages_workspace_page UNIQUE (workspace_id, fb_page_id)` on `public.facebook_pages`.
2. **OAuth Callback & Page Import Upserts:**
   * In `apps/web/src/app/api/auth/facebook/callback/route.ts` (`upsertConnectedFacebookAccount` and `refreshConnectedPageTokens`), scope all lookups and `.upsert(..., { onConflict: 'workspace_id,fb_account_id' })` strictly by `(workspace_id, fb_account_id)` and `(user_id, workspace_id)`.
   * In `apps/web/src/app/api/tenant/[subdomain]/pages/import/route.ts` (`handleImportPages`), scope existing page checks and `.upsert(..., { onConflict: 'workspace_id,fb_page_id' })` strictly to `(workspace_id, fb_page_id)`.

---

## Issue 2: Multi-Tab `403 Forbidden` Due to Inconsistent Tenant Auth Guards (P0)

### Problem
* While `canAccessTenant(session, subdomain)` and `isSessionAuthorizedForSubdomain(session, subdomain)` check `session.allowedSubdomains`, several route handlers (`handleConfirmUpload`, `handleCreateUploadUrl`, `handleEnqueueMedia`, `handleImportPages`, `handleGenerateMagicLink`, `handleDiscoverPages`, etc.) manually check `if (session.subdomain !== subdomain && session.role !== 'admin')`.
* If a user has Workspace A open in Tab 1 and switches to Workspace B in Tab 2 (`session.subdomain` becomes `workspace-b`), actions in Tab 1 fail with `403 Forbidden` even though `workspace-a` is in `session.allowedSubdomains`.

### Solution
* Replace all manual `session.subdomain !== subdomain && session.role !== 'admin'` checks across every `/api/tenant/[subdomain]/**` route handler with `canAccessTenant(session, subdomain).allowed` (or the centralized `authenticateTenantRoute` / `isSessionAuthorizedForSubdomain` helper).
* Ensure `validateSessionActive(session)` is invoked in API route authentication so password resets and account suspensions immediately revoke active API sessions.

---

## Issue 3: Swallowed Database Error in `ensureWorkspaceForUser` Issuing Orphaned Sessions (P0)

### Problem
* In `apps/web/src/lib/supabase-auth.ts`, `ensureWorkspaceForUser` attempts to insert a default workspace up to 5 times. If Supabase returns a non-conflict database error (e.g., `50000 Internal server error`), it stops retrying and returns the unpersisted `preferredSubdomain` string anyway.
* The user receives a session cookie for a workspace that does not exist in `public.workspaces`, causing every subsequent dashboard API request to fail with `404 Workspace not found`.

### Solution
* In `ensureWorkspaceForUser`, only retry on `23505` (unique constraint collision) or transient network exceptions. If all retries fail or a fatal non-conflict error occurs and no workspace exists for the user, throw an explicit `Error('Failed to provision workspace')` (unless running in the explicit fallback test store mode when Supabase is unconfigured) so signup/login fails cleanly with a safe 500 error rather than issuing an orphaned session.
* Update the corresponding unit test in `apps/web/tests/security/workspace-ownership-hijack.test.ts` to reflect safe error propagation or verified workspace resolution.

---

## Issue 4: Global Media Library vs. Workspace Isolation Alignment (P0)

### Problem
* Per platform architecture (Principle 26), the Media Library (`media_folders` and `media_items`) is **global per user (`user_id`)**, whereas social accounts, pages, and queues are isolated per `workspace_id`.
* However, `20261014150000_tenant_resources_workspace_isolation.sql` added `workspace_id NOT NULL` to `media_folders` and `media_items`, and some media queries filter by `workspace_id`, hiding a user's uploaded videos/folders when they switch to a second workspace!

### Solution
* Ensure `media_folders` and `media_items` queries across `/api/tenant/[subdomain]/media/**` and `/api/tenant/[subdomain]/pages/[pageId]/queue` scope media asset access by `user_id = session.userId` (global across all of the user's workspaces).
* Make `workspace_id` nullable on `media_folders` and `media_items` (or auto-populate it as metadata only without filtering `GET /media` or `POST /queue` by `workspace_id`), and ensure folder uniqueness is scoped to `(user_id, parent_id, name)` so a user sees their entire Media Library across all of their workspaces.

---

## Issue 5: Admin Cross-Tenant Inspection Fails in `resolveTenantWorkspaceId` (P1)

### Problem
* Middleware and `canAccessTenant()` explicitly allow `session.role === 'admin'` to inspect any tenant subdomain.
* However, `resolveTenantWorkspaceId(client, subdomain, session.userId)` queries `.eq('subdomain', subdomain).eq('owner_id', userId)`. When an admin inspects another user's workspace, `owner_id` does not match the admin's `userId`, returning `null` and causing all tenant API routes to return `404 Workspace not found`.

### Solution
* Update `resolveTenantWorkspaceId(client, subdomain, userId, role?: UserRole)` in `apps/web/src/lib/workspace-Access` / `byoc-resolver.ts` so that when `role === 'admin'`, the `.eq('owner_id', userId)` filter is omitted and the workspace is resolved solely by `.eq('subdomain', subdomain)`.

---

## Issue 6: `'fb_rate_limited'` 3-Day Cooldown Timer Reset Bug & Unawaited `GET` Mutation (P1)

### Problem
* `evaluatePageHealth()` calculates the 3-day cooldown for `'fb_rate_limited'` pages using `page.updatedAt`. Any background task that updates the row (such as `insights-sync.ts` updating `current_followers` and `updated_at = now()`) inadvertently resets the 3-day rate-limit timer.
* Additionally, in `GET /api/tenant/[subdomain]/pages`, `syncRecoveredPageStatus` is called without `await`, risking premature termination in serverless functions.

### Solution
1. **Dedicated Timestamp or Safe `updated_at` Preservation:**
   * Add a nullable `rate_limited_at TIMESTAMPTZ` column to `public.facebook_pages` (defaulting to `updated_at` when transitioning to `'fb_rate_limited'`), OR ensure `savePageSnapshot` in `apps/worker/src/insights-sync.ts` only updates `current_followers` without touching `updated_at` when `status = 'fb_rate_limited'`.
   * Update `evaluatePageHealth` to check `rateLimitedAt ?? updatedAt`.
2. **Await Status Recovery:**
   * `await Promise.all(...)` on `syncRecoveredPageStatus` calls inside `handleListPages` before returning the response, clearing `rate_limited_at = null` when transitioning back to `'active'`.

---

## Issue 7: Graph API `/me/accounts` 25-Page Truncation on OAuth Callback, Discovery & Import (P1)

### Problem
* `fetchGraphPageTokenMap` (in `/api/auth/facebook/callback`), `handleDiscoverPages` (`/pages/discover`), and `handleImportPages` (`/pages/import`) fetch `https://graph.facebook.com/v26.0/me/accounts` without `limit=100` or cursor pagination (`paging.next`).
* Meta defaults to 25 pages per request, preventing users with >25 Facebook Pages from discovering, importing, or refreshing tokens for pages 26+.

### Solution
* Create a shared helper `fetchAllFacebookPages(accessToken: string, fields: string, maxPages = 5)` that sets `limit=100` and follows `paging.next` up to `maxPages` (500 pages max).
* Use this helper in `/api/auth/facebook/callback/route.ts`, `/pages/discover/route.ts`, and `/pages/import/route.ts`.

---

## Issue 8: Direct OAuth Callback CSRF Protection & Token `expires_in` Fallback (P1)

### Problem
* In `GET /api/auth/facebook/callback`, when `statePayload.isMagic` is NOT true (i.e. Direct Browser Connection), the callback does not verify that the browser's `fbup_session` cookie belongs to `statePayload.userId`. An attacker could craft a direct OAuth state link and trick a logged-in victim into linking the victim's Facebook account into the attacker's workspace.
* Also, if Meta returns `expires_in: 0` or omits `expires_in`, `expiresInSeconds` must safely default to 60 days (`5184000` seconds) when `<= 0`.

### Solution
* In `handleFacebookCallback`, when `!statePayload.isMagic` and a session cookie is present (or required for direct flows), verify that `session.userId === statePayload.userId`.
* Ensure `const expiresInSeconds = longTokenData.expires_in && longTokenData.expires_in > 0 ? longTokenData.expires_in : 5184000;`.
* In `apps/web/src/app/connect/facebook/error/page.tsx`, update `getConnectErrorCopy` description from `"This single-use Facebook authorization link has expired..."` to `"This Facebook authorization link has expired or is no longer valid (links are valid for 15 minutes). Please generate a fresh link."`

---

## Issue 9: Subdomain Length Overflow on Auto-Generated Workspaces & `/verify-otp` Middleware Routing (P2)

### Problem
* `generateWorkspaceSubdomain(mainSubdomain)` concatenates `base` + 4 random letters. If `base` is >46 characters, the generated subdomain exceeds `VARCHAR(50)`, causing all 10 insert retries in `POST /api/workspaces` to fail.
* In `apps/web/src/middleware.ts`, `isAuthRoute` checks `/login`, `/signup`, `/forgot-password`, and `/reset-password`, but omits `/verify-otp`.
* In `apps/web/src/lib/auth-redirect.ts`, `sanitizeAuthRedirectUrl` only validates `returnUrl` against the user's primary `subdomain`, dropping deep-link `returnUrl`s pointing to secondary workspaces in `allowedSubdomains`.

### Solution
* Truncate the cleaned base in `generateWorkspaceSubdomain` to `slice(0, 46)` before appending the 4 random characters so it never exceeds 50 characters.
* Add `pathname === '/verify-otp'` to `isAuthRoute` in `apps/web/src/middleware.ts`.
* Extend `sanitizeAuthRedirectUrl` to accept an optional `allowedSubdomains?: string[]` parameter so deep links to any of the user's owned workspaces are preserved on login.

---

## Issue 10: Worker First-Comment Retry Duplicating Published Media & Non-Atomic Settlement (P2)

### Problem
* In `apps/worker/src/dispatcher.ts`, `dispatchItem` publishes the video/photo first and then calls `fbClient.postComment` for `firstComment`. If `postComment` fails with a transient error and wasn't isolated from the main publish try/catch, retrying the queue item would re-upload and duplicate-post the video on Facebook.
* When `settleSupabaseOutcome` updates `queue_items`, `publish_logs`, and `facebook_pages`, ensure errors on `facebook_pages` status transitions (like `'fb_rate_limited'` or `'page_checkpoint'`) set `rate_limited_at` properly.

### Solution
* Wrap `fbClient.postComment` in its own `try / catch` inside `dispatchItem` so that if the main video/photo post succeeded (`publishResult.postId` exists), a failure to post the first comment is logged as a warning in `error_message` / audit details while still settling the queue item as `'published'` (never retrying and duplicating the already-live video).
