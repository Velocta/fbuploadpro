# Tasks: Spec 038 - Pure Supabase Database Migration & Legacy pg Eradication

## Status Summary
- **Total Tasks**: 10
- **Completed**: 10
- **Pending**: 0

---

## Phase 1: Database Migration & Schema Contracts (Foundation)

- [x] **Task 1.1: Forward Migration for Row Level Security (RLS) & Queue RPC**
  - Create `supabase/migrations/20261013140000_pure_supabase_rls_and_rpc.sql`.
  - Enable `ROW LEVEL SECURITY` across all 11 public tables: `users`, `workspaces`, `workspace_byoc_credentials`, `facebook_accounts`, `facebook_pages`, `media_folders`, `media_items`, `page_queue_slots`, `queue_items`, `publish_logs`, `page_insights_daily_snapshots`.
  - Add compound tenant isolation policies using `auth.uid() = user_id`, `auth.uid() = id` (for users), and `auth.uid() = owner_id` (for workspaces).
  - Create atomic stored procedure `claim_due_queue_items(p_limit INT DEFAULT 10)` with `FOR UPDATE SKIP LOCKED`.
  - Verification: Inspect SQL syntax and schema definition.

- [x] **Task 1.2: Shared Database Schema Types in Contracts**
  - Create `packages/contracts/src/domain/database.ts` with strongly typed table schemas and `Database` type definitions.
  - Export from `packages/contracts/src/index.ts`.
  - Verification: `pnpm --filter @fbuploadpro/contracts typecheck`.

---

## Phase 2: Cloudflare Worker Edge Modernization (apps/worker)

- [x] **Task 2.1: Supabase Admin Client & Dispatcher RPC Integration**
  - Update `apps/worker/src/dispatcher.ts` to execute `supabase.rpc('claim_due_queue_items', { p_limit: limit })`.
  - Remove `CLAIM_DUE_ITEMS_SQL`, `UPDATE_CLAIMED_STATUS_SQL`, and raw SQL transaction execution.
  - Update `apps/worker/src/settlement.ts` to settle items and record `publish_logs` via PostgREST queries.
  - Verification: Worker unit tests with mock Supabase client.

- [x] **Task 2.2: Daily Page Insights Sync & Worker Entrypoint Modernization**
  - Update `apps/worker/src/insights-sync.ts` to upsert snapshots via `supabase.from('page_insights_daily_snapshots').upsert(...)`.
  - Update `apps/worker/src/index.ts` to initialize `createClient` with `env.SUPABASE_URL` and `env.SUPABASE_SERVICE_ROLE_KEY` natively over HTTPS.
  - Remove `@fbuploadpro/database` import from `apps/worker`.
  - Verification: `pnpm --filter @fbuploadpro/worker build`.

---

## Phase 3: Web Route Handlers PostgREST Migration (apps/web)

- [x] **Task 3.1: Migrate Accounts and Pages Routes to Supabase PostgREST**
  - Migrate `apps/web/src/app/api/tenant/[subdomain]/accounts/...` and `.../pages/...` to use `getSupabaseClient()` PostgREST queries.
  - Remove all `db.query(...)` calls from account and page endpoints.
  - Verification: Route handler tests in `apps/web`.

- [x] **Task 3.2: Migrate Media Library Routes to Supabase PostgREST**
  - Migrate `apps/web/src/app/api/tenant/[subdomain]/media/...`, `/folders/...`, `/captions/...`, `/confirm/...`, and `/quota/...` to use `getSupabaseClient()` PostgREST queries.
  - Preserve Cloudflare R2 presigned URL generation and S3 storage mechanisms.
  - Verification: Media route tests in `apps/web`.

- [x] **Task 3.3: Modernize Publishing Queue Routes and Client Adapter in `apps/web/src/lib/db.ts`**
  - Modernize `apps/web/src/lib/db.ts` to eliminate `pg` and pool dependencies, operating purely with Supabase.
  - Verification: `git grep "from 'pg'"` returns 0 results across `apps/web`.

---

## Phase 4: Eradication of `pg` and `@fbuploadpro/database`

- [x] **Task 4.1: Delete `packages/database` and Update Workspace Config**
  - Remove `packages/database` directory and symlinks.
  - Update `pnpm-workspace.yaml` if needed to reflect package removal.
  - Remove `"@fbuploadpro/database": "workspace:*"` from all `package.json` manifests.
  - Verification: Monorepo workspace status check.

- [x] **Task 4.2: Remove `pg` and `@types/pg` from Monorepo Dependencies**
  - Remove `pg` and `@types/pg` from all `package.json` manifests and root dependencies.
  - Run `pnpm install` to update `pnpm-lock.yaml`.
  - Verification: `git grep "from 'pg'"` returns 0 results across monorepo.

---

## Phase 5: Test Suite Verification & Quality Gates

- [x] **Task 5.1: Modernize Automated Tests for Pure Supabase**
  - Update existing tests in `apps/web` and `apps/worker` to mock/test against Supabase client instead of `mockPool`.
  - Ensure zero tests attempt to launch or require a local PostgreSQL server.
  - Verification: `pnpm turbo run test` passes 100%.

- [x] **Task 5.2: Monorepo Quality Gate Audit**
  - Execute full CI check: `pnpm turbo run build lint typecheck test`.
  - Verify 0 errors, 0 linter warnings, and 0 type errors.
