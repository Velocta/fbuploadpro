# Spec 139 db-hygiene rig

SQL-level regression rig for the spec 139 database-hygiene migration
(`supabase/migrations/20261023193000_db_hygiene.sql`): proves, against a
**real PostgreSQL** with bootstrap + all repo migrations applied in
filename order, that

1. the unified recovery sweep's missing index now exists —
   `idx_queue_items_publishing_claimed` on `public.queue_items
   (platform, claimed_at) WHERE status = 'publishing'` — and that the
   sweep's exact filter shape (`status = 'publishing' AND platform = ?
   AND COALESCE(claimed_at, updated_at) <= cutoff`, the predicate of
   `recover_stuck_publishing_items(platform, INT)`) is planned through
   it; and
2. the five trigger functions (`guard_users_role_status`,
   `set_updated_at`, `check_media_folders_cycle`,
   `prevent_workspace_owner_transfer`, `canonicalize_user_email`) no
   longer carry the PostgreSQL default `EXECUTE TO PUBLIC` — **and
   that every one of their triggers still fires afterwards** (REVOKE
   EXECUTE does not affect trigger firing: the trigger mechanism
   invokes the function as the table owner and never consults the
   function's EXECUTE ACL).

Modelled on the spec 117 rls-rpc rig (`apps/worker/tests/rls-rpc/`).

## Layout

| File | Role |
|---|---|
| `db/bootstrap.sql` | Minimal Supabase stub for plain Postgres: `anon` / `authenticated` / `service_role` (BYPASSRLS) roles, `auth` schema, `auth.users`, `auth.uid()` from `request.jwt.claim.sub` — plus Supabase's default-privilege posture (table-level SELECT/INSERT/UPDATE/DELETE to anon + authenticated, ALL to service_role) via `ALTER DEFAULT PRIVILEGES`. Copied from the rls-rpc rig. |
| `db/run-migrations.ts` | Applies `bootstrap.sql`, then every file in `supabase/migrations/` in filename order; `DB_HYGIENE_MIGRATIONS_UNTIL=<file>` stops after that file (builds the pre-hygiene DB). |
| `fixtures.sql` | Deterministic fixture (`dbhygiene_reset`, `dbhygiene_seed_bulk`): users A/B, workspace A/B, a unified account/destination graph, parent/child media folders, and four curated queue items covering the sweep filter (stale facebook, fresh facebook, stale instagram, stale facebook with `claimed_at NULL`). The bulk seeder adds 8,000 rows so `publishing` is a minority status for the EXPLAIN assertion. |
| `check.ts` | The assertion runner. `DB_HYGIENE_MODE=hardened` (default) asserts the post-migration state (47 assertions, groups a–f in the file header); `DB_HYGIENE_MODE=vulnerable` asserts the findings are still present on the pre-hygiene DB (30 assertions), proving the rig detects them. Both modes run the trigger-firing and recovery-sweep sections — they pin the behaviour the migration must preserve — and print a `pg_proc.proacl` + index summary. |

Rig code lives outside the worker build's runtime: no file here
matches vitest's `*.test.*` include pattern, so the normal worker suite
never runs the rig; the scripts are run explicitly (below). `pg`,
`@types/pg`, and `tsx` are worker devDependencies shared with the
spec 117 / spec 138 rigs.

## Setup (one-time)

1. **PostgreSQL** — any plain PG ≥ 13 with a reachable socket/URL (a
   system Postgres works). On this VM the `pgserver` Python wheel is
   what the rig was run with:
   ```sh
   python3 -m venv ~/pgvenv && ~/pgvenv/bin/pip install pgserver
   ```
   Notes for the wheel route (learned on the spec 117 rig): the server
   refuses to run as root, so run it as an unprivileged user (and make
   sure that user can read the wheel's `pgserver.libs` directory —
   `chmod -R a+rX` on the venv if it is root-owned); the postmaster
   stops when the Python process that started it exits, so keep a
   keeper process alive for the whole rig run; and if the first
   migration's `CREATE EXTENSION pgcrypto` fails, drop the stub from
   the rls-rpc README into the wheel's extension dir (the migrations
   only need `gen_random_uuid()`, core since PG 13).
2. **Create the databases** (example names):
   ```sh
   createdb dbhygiene        # post-hygiene DB (all migrations)
   createdb dbhygienepre     # pre-hygiene DB (up to spec 117)
   ```
3. **Apply bootstrap + migrations** to each (from `apps/worker`):
   ```sh
   DB_HYGIENE_PG_URL='postgres://postgres@/dbhygiene?host=<socket dir>' \
     pnpm exec tsx tests/db-hygiene/db/run-migrations.ts
   DB_HYGIENE_PG_URL='postgres://postgres@/dbhygienepre?host=<socket dir>' \
   DB_HYGIENE_MIGRATIONS_UNTIL='20261023120000_rls_rpc_hardening.sql' \
     pnpm exec tsx tests/db-hygiene/db/run-migrations.ts
   ```

## Running

```sh
cd apps/worker
# Pre-hygiene DB: both findings must show PRESENT (30 assertions):
DB_HYGIENE_MODE=vulnerable DB_HYGIENE_PG_URL='...dbhygienepre...' \
  pnpm exec tsx tests/db-hygiene/check.ts
# Post-hygiene DB: both findings must show FIXED (47 assertions):
DB_HYGIENE_PG_URL='...dbhygiene...' pnpm exec tsx tests/db-hygiene/check.ts
```

## Results (2026-10-23, PostgreSQL 16.2 via the pgserver wheel, full migration chain)

- Vulnerable mode on the pre-hygiene DB (39 migrations, through
  `20261023120000_rls_rpc_hardening.sql`): **30 assertions, 0
  failures** — index absent; all five trigger functions at
  `proacl = (default: EXECUTE TO PUBLIC)`; a direct
  `SELECT public.set_updated_at()` as `authenticated` passes the ACL
  check (and only fails later because trigger functions refuse direct
  invocation). Baseline behaviour pinned: all five triggers fire and
  the sweep recovers exactly the 2 stale facebook rows.
- Hardened mode on the post-hygiene DB (40 migrations, incl.
  `20261023193000_db_hygiene.sql`): **47 assertions, 0 failures** —
  (a) 5/5 index assertions (exists, valid, on `queue_items`, columns
  `(platform, claimed_at)`, predicate `status = 'publishing'`),
  (b) 31/31 ACL assertions (all five functions exist, RETURN TRIGGER,
  PUBLIC + anon + authenticated EXECUTE gone; the direct-call probe as
  `authenticated` now meets 42501), (c) 7/7 trigger-firing assertions
  (guard raises 42501 on a role self-update, `set_updated_at` bumps
  `updated_at`, canonicalize rewrites `normalized_email` on INSERT,
  owner-transfer rejected, folder cycle rejected with 23514),
  (d) 6/6 recovery assertions (returns exactly 2; stale rows re-queued
  with `claimed_at` cleared — including the `claimed_at IS NULL`
  COALESCE-fallback row; fresh facebook and stale instagram rows
  untouched), (e) the EXPLAIN assertion, (f) 2/2 idempotency
  assertions (re-applying the migration exits clean).
- The migration chain itself applies cleanly from scratch in both
  databases (39 / 40 migrations, 19 public tables).

### EXPLAIN evidence (hardened, 8,004 seeded rows, `enable_seqscan = off`)

```
Bitmap Heap Scan on queue_items
  Recheck Cond: ((platform = 'facebook'::platform) AND ((status)::text = 'publishing'::text))
  Filter: (COALESCE(claimed_at, updated_at) <= (now() - '00:10:00'::interval))
  ->  Bitmap Index Scan on idx_queue_items_publishing_claimed
        Index Cond: (platform = 'facebook'::platform)
```

### ACL state — after (hardened)

```
canonicalize_user_email           proacl={postgres=X/postgres}
check_media_folders_cycle         proacl={postgres=X/postgres}
guard_users_role_status           proacl={postgres=X/postgres}
prevent_workspace_owner_transfer  proacl={postgres=X/postgres}
set_updated_at                    proacl={postgres=X/postgres}
index: CREATE INDEX idx_queue_items_publishing_claimed ON public.queue_items
         USING btree (platform, claimed_at)
         WHERE ((status)::text = 'publishing'::text)
```

(Before: all five `proacl=(default: EXECUTE TO PUBLIC)`, index absent.)
