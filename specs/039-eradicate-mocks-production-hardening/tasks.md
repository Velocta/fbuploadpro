# Tasks: Spec 039 - Eradicate Mocks & Production Hardening

## Status Summary
- **Total Tasks**: 10
- **Completed**: 10
- **Pending**: 0

---

## Phase 1: Security & Configuration Hardening

- [X] **Task 1.1: Strict Session Secret Enforcement**
  - Implement `getSessionSecret()` in `packages/contracts/src/domain/session.ts` or `apps/web/src/lib/session.ts`.
  - Throw an error if `SESSION_SECRET` is missing when `NODE_ENV === 'production'`.
  - Replace inline fallback session secret strings across all API route handlers and middleware.
  - Verification: Unit tests verifying error thrown in production when secret is missing.

- [X] **Task 1.2: Fail-Fast Cloudflare R2 Storage in Production**
  - Update `getStorageService()` in `apps/web/src/lib/storage.ts` to throw if R2 credentials are missing when `NODE_ENV === 'production'`.
  - Keep `MockStorageProvider` strictly restricted to `test` and local development.
  - Verification: Unit test verifying production throw.

- [X] **Task 1.3: Distributed Upstash Redis Rate Limiting**
  - Update `apps/web/src/lib/rate-limiter.ts` to support Upstash Redis REST API.
  - Require `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in production, throwing if missing.
  - Verification: Rate limiter test suite.

---

## Phase 2: Serverless Supabase Auth & Native OTP Hardening

- [X] **Task 2.1: Eradicate In-Memory Credential & Reset Token Stores**
  - Remove `localPasswordStore`, `localUserStore`, and `localResetTokenStore` from `apps/web/src/lib/supabase-auth.ts`.
  - Update `findUserByEmail` and `resolveUniqueSubdomain` to query Supabase directly via `supabase.from('users')` and `supabase.from('workspaces')`.
  - Verification: `pnpm --filter @fbuploadpro/web test tests/auth/`.

- [X] **Task 2.2: Native Supabase Auth OTP Verification**
  - Update OTP signup and password reset flows to execute strictly via Supabase Auth APIs.
  - Remove fallback in-memory simulation in production.
  - Verification: Auth endpoint test suites.

---

## Phase 3: Route Handlers Migration to Supabase PostgREST

- [X] **Task 3.1: Migrate Accounts Routes to Supabase PostgREST**
  - Update `accounts/route.ts`, `[accountId]/route.ts`, and `pages/discover/route.ts` to use `supabase.from(...)`.
  - Accept optional `supabaseClient?: SupabaseClient<Database>` for test injection.
  - Verification: `tests/api/auth-facebook.test.ts` and `tests/api/multi-account-oauth.test.ts`.

- [X] **Task 3.2: Migrate Pages & Slots Routes to Supabase PostgREST**
  - Update `pages/route.ts`, `[pageId]/route.ts`, `slots/route.ts`, `[slotId]/route.ts`, `import/route.ts`, and `insights/route.ts` to use `supabase.from(...)`.
  - Accept optional `supabaseClient?: SupabaseClient<Database>`.
  - Verification: `tests/api/facebook-pages.test.ts` and `tests/api/queue-slots.test.ts`.

- [X] **Task 3.3: Migrate Media Library Routes to Supabase PostgREST**
  - Update `media/route.ts`, `[mediaId]/route.ts`, `confirm/route.ts`, `folders/route.ts`, `[folderId]/route.ts`, `batch/route.ts`, and `downloader/route.ts` to use `supabase.from(...)`.
  - Accept optional `supabaseClient?: SupabaseClient<Database>`.
  - Verification: `tests/api/media-*.test.ts`.

- [X] **Task 3.4: Migrate Publishing Queue & Logs Routes to Supabase PostgREST**
  - Update `queue/route.ts`, `[itemId]/route.ts`, `publish-now/route.ts`, and `logs/route.ts` to use `supabase.from(...)`.
  - Accept optional `supabaseClient?: SupabaseClient<Database>`.
  - Verification: `tests/api/publishing-*.test.ts`.

- [X] **Task 3.5: Delete `apps/web/src/lib/db.ts`**
  - Delete `apps/web/src/lib/db.ts`.
  - Verify `git grep "getDbClient" apps/web` returns 0 results.
  - Verification: `pnpm --filter @fbuploadpro/web typecheck`.

---

## Phase 4: Full Test Suite Modernization & Quality Gates

- [X] **Task 4.1: Modernize Web Test Suites for Pure Supabase**
  - Refactor test files in `apps/web/tests/api/` to inject mock `SupabaseClient` objects instead of legacy `mockDb`.
  - Verification: All tests in `apps/web` pass (100%).

- [X] **Task 4.2: Full Monorepo Quality Gate Execution**
  - Run `pnpm turbo run build lint typecheck test` across all workspaces.
  - Run `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`.
  - Verify 0 errors, 0 warnings, 100% pass rate.
