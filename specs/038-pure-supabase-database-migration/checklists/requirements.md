# Requirements & Quality Checklist: Spec 038 Pure Supabase Migration

## 1. Security & Row Level Security (RLS)
- [x] `ROW LEVEL SECURITY` is enabled on all 11 public database tables in `supabase/migrations/`.
- [x] Compound tenant isolation policies (`USING (auth.uid() = user_id)`) are configured for all tenant tables.
- [x] User profile access is strictly scoped to `auth.uid() = id`.
- [x] Workspace access is strictly scoped to `auth.uid() = owner_id`.
- [x] Background workers and admin cron operations authenticate via `SUPABASE_SERVICE_ROLE_KEY` to bypass client RLS safely.
- [x] `SUPABASE_SERVICE_ROLE_KEY` is strictly absent from client-side bundles and public API JSON responses.

## 2. Queue Concurrency & PostgreSQL Stored Procedures
- [x] PostgreSQL stored procedure `claim_due_queue_items` handles `FOR UPDATE SKIP LOCKED` inside the database engine.
- [x] Status transition from `'queued'` to `'publishing'` occurs atomically inside the RPC transaction.
- [x] Worker invokes `supabase.rpc('claim_due_queue_items', ...)` with zero raw SQL execution.

## 3. Package & Dependency Eradication
- [x] `@fbuploadpro/database` package is completely removed from the repository.
- [x] `pnpm-workspace.yaml` does not reference `packages/database`.
- [x] `pg` and `@types/pg` are completely removed from all `package.json` manifests.
- [x] Zero files in the monorepo import from `@fbuploadpro/database` or `pg`.
- [x] `apps/web/src/lib/db.ts` contains zero `pg` connections, pools, or native drivers, operating purely with Supabase.

## 4. Edge Runtime Purity
- [x] `apps/worker` uses `@supabase/supabase-js` communicating strictly over HTTPS.
- [x] Zero Node TCP socket imports or Polyfills in `apps/worker`.
- [x] Worker builds cleanly with `tsc`.

## 5. Quality & Governance Gates
- [x] Automated tests run without requiring any local PostgreSQL daemon or Docker container.
- [x] `pnpm turbo run build lint typecheck test` passes with 100% pass rate and 0 errors.
