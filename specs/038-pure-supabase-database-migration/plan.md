# Plan: Spec 038 - Pure Supabase Database Migration & Legacy pg Eradication

## 1. Architectural Blueprint & Data Flow

```mermaid
flowchart TD
    subgraph WebApp ["Next.js 16 Webapp (apps/web)"]
        AuthContext["User Session Cookie\n(fbup_session / Supabase JWT)"]
        SupaWebClient["Supabase PostgREST Client\n(@/lib/supabase-auth / @supabase/ssr)"]
        WebRoutes["API Route Handlers\n(/api/tenant/.../media, /pages, /publishing)"]
    end

    subgraph EdgeWorker ["Cloudflare Worker (apps/worker)"]
        CronTrigger["Edge Cron Trigger\n(Per-Minute / Daily 0 2 * * *)"]
        SupaWorkerClient["Supabase Admin Client\n(@supabase/supabase-js with SERVICE_ROLE)"]
        Dispatcher["Publishing Dispatcher\n(dispatcher.ts)"]
        Settlement["Outcome Settlement\n(settlement.ts)"]
        InsightsSync["Daily Insights Sync\n(insights-sync.ts)"]
    end

    subgraph SupabaseDB ["Remote Supabase PostgreSQL 17 Substrate"]
        RLS["Row Level Security (RLS)\nActive on all 11 Public Tables"]
        ClaimRPC["claim_due_queue_items()\n(Stored Procedure with FOR UPDATE SKIP LOCKED)"]
        UpsertRPC["upsert_page_insights_snapshot()\n(Compound Uniqueness Upsert)"]
        PublicTables[("11 Public Tables\nusers, workspaces, media_items, queue_items...")]
    end

    subgraph Storage ["Cloudflare R2 Storage"]
        R2Bucket["Media Object Bucket\n(Presigned Direct Uploads & Streaming)"]
    end

    AuthContext --> WebRoutes
    WebRoutes --> SupaWebClient
    SupaWebClient -->|HTTPS PostgREST (auth.uid() Scoped)| RLS
    RLS --> PublicTables

    CronTrigger --> Dispatcher
    Dispatcher --> SupaWorkerClient
    SupaWorkerClient -->|supabase.rpc('claim_due_queue_items')| ClaimRPC
    ClaimRPC --> PublicTables
    Dispatcher --> Settlement
    Settlement --> SupaWorkerClient
    SupaWorkerClient -->|HTTPS PostgREST (service_role)| PublicTables

    CronTrigger --> InsightsSync
    InsightsSync --> SupaWorkerClient
    SupaWorkerClient -->|supabase.from('page_insights_daily_snapshots').upsert()| PublicTables

    WebRoutes -->|Presigned URLs| R2Bucket
    Dispatcher -->|Stream Media| R2Bucket
```

---

## 2. Technical Stack & Implementation Boundary

1. **Database Schema & RPC Migration (`supabase/migrations/20261013140000_pure_supabase_rls_and_rpc.sql`)**:
   - **Row Level Security (RLS)**:
     - Enable RLS on all 11 tables: `users`, `workspaces`, `workspace_byoc_credentials`, `facebook_accounts`, `facebook_pages`, `media_folders`, `media_items`, `page_queue_slots`, `queue_items`, `publish_logs`, `page_insights_daily_snapshots`.
     - Compound tenant policies:
       - `users`: `USING (auth.uid() = id)`
       - `workspaces`: `USING (auth.uid() = owner_id)`
       - Other 9 tables: `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`
   - **PostgreSQL Stored Procedure: `claim_due_queue_items`**:
     - Signature: `claim_due_queue_items(p_limit INT DEFAULT 10)`
     - Locks matching rows (`status = 'queued' AND scheduled_time <= now()`) using `FOR UPDATE SKIP LOCKED`.
     - Updates status to `'publishing'` and `updated_at = now()`.
     - Returns joined columns (queue item fields, external page ID, encrypted access token, media type/url).
   - **PostgreSQL Stored Procedure / Upsert**:
     - Compound unique constraint on `page_insights_daily_snapshots (user_id, fb_page_id, snapshot_date)`.

2. **Schema Type Definitions**:
   - Provide strongly typed `Database` TypeScript definitions in `@fbuploadpro/contracts/src/domain/database.ts` or `apps/web/src/lib/supabase-types.ts` representing the 11 public tables and RPC functions.

3. **Retirement & Removal of `@fbuploadpro/database` & `pg`**:
   - Remove `packages/database` directory and its reference in `pnpm-workspace.yaml`.
   - Remove `"@fbuploadpro/database": "workspace:*"` from `apps/web/package.json` and `apps/worker/package.json`.
   - Remove `pg`, `@types/pg` from the root and all package manifests.
   - Delete `apps/web/src/lib/db.ts` (replaced entirely by `apps/web/src/lib/supabase-auth.ts`).

4. **Edge Worker Modernization (`apps/worker`)**:
   - Refactor `dispatcher.ts` to call `supabase.rpc('claim_due_queue_items', { p_limit: limit })`.
   - Refactor `settlement.ts` to update `queue_items` and insert into `publish_logs` via `supabase.from(...)`.
   - Refactor `insights-sync.ts` to upsert snapshots via `supabase.from('page_insights_daily_snapshots').upsert(...)`.
   - Refactor `index.ts` to initialize `createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)` natively in Cloudflare Workers V8 isolates.

5. **Web Route Handlers (`apps/web/src/app/api/...`)**:
   - Migrate remaining API routes from `db.query(...)` to `supabase.from(...)`:
     - Accounts & Pages (`/api/tenant/[subdomain]/accounts/...`, `/api/tenant/[subdomain]/pages/...`)
     - Media Library (`/api/tenant/[subdomain]/media/...`, `/folders/...`, `/captions/...`, `/confirm/...`)
     - Publishing Queue (`/api/tenant/[subdomain]/publishing/queue/...`, `/logs/...`)

6. **Test Suites Modernization**:
   - Update tests in `apps/web` and `apps/worker` to assert Supabase PostgREST client methods instead of `pg` mock pools.
   - Configure test runners to run deterministically against remote Supabase using environment variables or typed Supabase mock clients.

---

## 3. Verification & Validation Strategy
1. **Lint & Typecheck**: `pnpm turbo run lint typecheck` passes with zero errors and zero references to `pg` or `@fbuploadpro/database`.
2. **Build**: `pnpm turbo run build` passes with zero bundling warnings.
3. **Tests**: `pnpm turbo run test` passes with 100% success rate across `apps/web`, `apps/worker`, and `packages/contracts`.
