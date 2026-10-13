# Spec 038: Pure Supabase Database Migration & Legacy pg Eradication

## 1. Executive Summary & Vision
This specification governs the platform-wide migration to a **Pure Supabase PostgREST & RPC Database Substrate**, completely abolishing legacy `pg` (`node-postgres`), TCP connection poolers, and local database dependencies:
1. **Zero TCP & Pure HTTPS PostgREST Protocol**: All database read/write operations across `apps/web` and `apps/worker` execute strictly via `@supabase/supabase-js` over HTTPS. The `pg` dependency and `@fbuploadpro/database` package are retired and removed from the monorepo.
2. **Mandatory Row Level Security (RLS) & Compound Tenant Isolation**: Enforce RLS across all 11 public database tables (`users`, `workspaces`, `workspace_byoc_credentials`, `facebook_accounts`, `facebook_pages`, `media_folders`, `media_items`, `page_queue_slots`, `queue_items`, `publish_logs`, `page_insights_daily_snapshots`). Enforce `auth.uid() = user_id` compound tenant isolation for authenticated operations, with `service_role` bypassing RLS for background workers.
3. **Atomic Queue Concurrency via PostgreSQL RPC Function**: Encapsulate high-throughput publishing queue claiming (`FOR UPDATE SKIP LOCKED`) inside a dedicated PostgreSQL stored procedure `claim_due_queue_items` in a versioned forward migration, invoked atomically via `supabase.rpc('claim_due_queue_items', ...)`.
4. **Strict Prohibition of Local Databases**: The monorepo strictly prohibits local PostgreSQL instances and Docker database containers. Automated test suites verify data operations against the remote Supabase project using configured environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
5. **Direct Supabase Schema Typing**: Generate and maintain TypeScript database types (`Database`) directly from the live Supabase schema, providing compile-time type safety across all PostgREST queries without manual type assertions.

---

## 2. User Stories & Acceptance Criteria

### User Story 1 (P1): Row Level Security (RLS) Enforcement & Queue RPC Migration
As a security auditor and platform operator,  
I want Row Level Security enabled across all 11 database tables and atomic queue locking encapsulated in a PostgreSQL stored procedure,  
So that tenant boundaries are enforced at the database engine level and background workers can claim publishing jobs atomically over HTTPS without raw TCP transactions.

- **Scenario 1.1: Forward Migration Deployment for RLS**
  - **Given** the remote Supabase database with 11 public tables currently having RLS disabled,
  - **When** the versioned migration `supabase/migrations/20261013140000_pure_supabase_rls_and_rpc.sql` is applied,
  - **Then** `ROW LEVEL SECURITY` is enabled on `users`, `workspaces`, `workspace_byoc_credentials`, `facebook_accounts`, `facebook_pages`, `media_folders`, `media_items`, `page_queue_slots`, `queue_items`, `publish_logs`, and `page_insights_daily_snapshots`.

- **Scenario 1.2: Compound Tenant Isolation Policies**
  - **Given** an authenticated user session with JWT `auth.uid()`,
  - **When** executing PostgREST queries with the authenticated client,
  - **Then** users can only read, insert, update, or delete rows where:
    - `id = auth.uid()` for `users`,
    - `owner_id = auth.uid()` for `workspaces`,
    - `user_id = auth.uid()` for all other tenant tables (`facebook_accounts`, `facebook_pages`, `media_folders`, `media_items`, `page_queue_slots`, `queue_items`, `publish_logs`, `page_insights_daily_snapshots`, `workspace_byoc_credentials`).

- **Scenario 1.3: Atomic Queue Claiming RPC Function**
  - **Given** due posts in `queue_items` with `status = 'queued'` and `scheduled_time <= now()`,
  - **When** `apps/worker` invokes `supabase.rpc('claim_due_queue_items', { p_limit: 10 })`,
  - **Then** the function locks matching rows using `FOR UPDATE SKIP LOCKED`, transitions their status to `'publishing'`, sets `updated_at = now()`, and returns the joined queue items, external Facebook page credentials, and media URLs atomically.

---

### User Story 2 (P2): Retirement and Removal of `@fbuploadpro/database` & `pg`
As a developer and platform maintainer,  
I want `@fbuploadpro/database` and all `pg` dependencies completely eradicated from `package.json`, pnpm workspaces, and imports,  
So that no TCP connection pooler logic exists and both `apps/web` and `apps/worker` use `@supabase/supabase-js` directly.

- **Scenario 2.1: Package Retirement & Workspace Cleanliness**
  - **Given** the monorepo packages,
  - **When** `@fbuploadpro/database` is retired,
  - **Then** `packages/database` is removed from workspace dependencies, `pg` and `@types/pg` are removed from all `package.json` manifests, and no code imports from `@fbuploadpro/database`.

- **Scenario 2.2: Shared Supabase Schema Types**
  - **Given** TypeScript type checking across the monorepo,
  - **When** components and routes query Supabase tables,
  - **Then** they import typed schema definitions from `@fbuploadpro/contracts` or `@/lib/supabase-types` generated from Supabase schema.

---

### User Story 3 (P3): Cloudflare Worker Pure HTTPS Supabase Integration
As an edge infrastructure engineer,  
I want `apps/worker` to execute dispatch cycles, queue settlement, and daily insights sync purely via `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY`,  
So that the Cloudflare Worker executes cleanly in V8 isolates without TCP socket errors, connection timeouts, or socket shims.

- **Scenario 3.1: V8 Isolate Native Dispatch Cycle**
  - **Given** a Cloudflare Worker cron trigger,
  - **When** `handleScheduled` runs in `apps/worker`,
  - **Then** it initializes `@supabase/supabase-js` using `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` over HTTPS `fetch()`.
  - **And** it claims due posts via `supabase.rpc('claim_due_queue_items')`, dispatches to Facebook Graph API v26.0, and settles outcomes via PostgREST updates.

- **Scenario 3.2: Daily Page Insights Snapshot Sync via PostgREST Upsert**
  - **Given** scheduled daily insights sync (`0 2 * * *`),
  - **When** syncing daily metrics for connected pages,
  - **Then** the worker upserts daily snapshots into `page_insights_daily_snapshots` using `supabase.from('page_insights_daily_snapshots').upsert(...)` with compound uniqueness on `(user_id, fb_page_id, snapshot_date)`.

---

### User Story 4 (P4): Web Application PostgREST Transition & Legacy DB Purge
As a backend engineer,  
I want remaining API routes in `apps/web` (`/api/tenant/.../media`, `/api/tenant/.../pages`, `/api/tenant/.../publishing`) to query Supabase directly via PostgREST,  
So that `apps/web/src/lib/db.ts` and all raw SQL strings are completely removed.

- **Scenario 4.1: Direct PostgREST Query Replacement**
  - **Given** incoming API requests for media, pages, slots, and publishing queues,
  - **When** the route handlers execute,
  - **Then** they query Supabase tables using `supabase.from(...)` methods instead of `db.query(...)`.

- **Scenario 4.2: Health Check Pure Supabase Verification**
  - **Given** a `GET /api/health` request,
  - **When** verifying database connectivity,
  - **Then** it executes a lightweight Supabase PostgREST query (e.g. `supabase.from('users').select('id', { head: true, count: 'exact' })`) with a 2000ms timeout budget, returning `{ status: 'ok', database: 'connected' }` without any raw SQL `SELECT 1`.

---

## 3. Edge Cases & Constraints
1. **Remote-Only Testing Mandate**: All test executions (Vitest) must run with remote Supabase environment variables or isolated test mock clients. Local PostgreSQL servers or Docker daemons must never be started or required.
2. **Service Role Key Security**: `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser clients or emitted in public API responses. It is strictly reserved for server-side Next.js route handlers and Cloudflare Worker execution.
3. **Storage Decoupling**: Cloudflare R2 remains the exclusive object storage provider for media files (videos, photos, thumbnails) under `IStorageService`. Only the database substrate is migrated to pure Supabase.
