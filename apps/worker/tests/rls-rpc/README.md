# Spec 117 rls-rpc hardening rig

SQL-level regression rig for the spec 117 RLS / SECURITY DEFINER RPC
hardening migration (`supabase/migrations/20261023120000_rls_rpc_hardening.sql`):
proves, against a **real PostgreSQL** with bootstrap + all repo
migrations applied in filename order, that the five legacy RPC
overloads are service-role-only, `users.role`/`status` cannot be
self-updated, the BYOC policy requires workspace ownership, the legacy
claim honours its 100-row cap, and the unified overloads are unchanged.
Modelled on the spec 138 claim-rpc rig (`apps/worker/tests/claim-rpc/`).

## Layout

| File | Role |
|---|---|
| `db/bootstrap.sql` | Minimal Supabase stub for plain Postgres: `anon` / `authenticated` / `service_role` (BYPASSRLS) roles, `auth` schema, `auth.users`, `auth.uid()` from `request.jwt.claim.sub` — plus Supabase's default-privilege posture (table-level SELECT/INSERT/UPDATE/DELETE to anon + authenticated, ALL to service_role) via `ALTER DEFAULT PRIVILEGES`, because this rig exercises GRANTs/RLS |
| `db/run-migrations.ts` | Applies `bootstrap.sql`, then every file in `supabase/migrations/` in filename order; `RLS_RPC_MIGRATIONS_UNTIL=<file>` stops after that file (builds the pre-hardening DB) |
| `fixtures.sql` | Deterministic two-tenant fixture (`rls117_reset`, `rls117_seed_legacy_items`): users A/B, their workspaces, FB account/page with dummy encrypted tokens, BYOC rows (incl. a planted row — user_id = A, workspace = B's), download jobs, a unified account/destination/queue-item graph |
| `check.ts` | The assertion runner. `RLS_RPC_MODE=hardened` (default) asserts the post-migration state (37 assertions, groups a–f in the spec); `RLS_RPC_MODE=vulnerable` asserts the holes are still open on the pre-hardening DB, proving the rig detects them. Both modes print a `pg_proc.proacl` + `pg_policies` dump (`RLS_RPC_DUMP_FILE=<path>` also writes it to a file) |

Rig code lives outside the worker build's runtime: no file here
matches vitest's `*.test.*` include pattern, so the normal worker suite
never runs the rig; the scripts are run explicitly (below). `pg`,
`@types/pg`, and `tsx` are worker devDependencies shared with the
spec 138 rig.

## Important finding (users mechanism)

The rig demonstrates on real PostgreSQL that plan.md's preferred
mechanism — column-level `REVOKE UPDATE (role, status) … FROM
authenticated` — does **not** deny the update while `authenticated`
holds Supabase's table-level `UPDATE` grant on `public.users`
(PostgreSQL privileges are additive: a column REVOKE removes only a
column-level grant). With only the column REVOKE applied, an
authenticated-context `UPDATE public.users SET role = 'admin'` on the
user's own row still succeeded (`UPDATE 1`). The migration therefore
keeps the column REVOKEs as defense-in-depth **and** enforces with
plan.md's fallback: the `trg_users_guard_role_status` BEFORE UPDATE
trigger (`guard_users_role_status()`), which raises SQLSTATE 42501
when `authenticated`/`anon` changes `role` or `status`. Profile
updates and service-role flows pass; the email-canonicalization and
updated_at triggers are untouched.

## Setup (one-time)

1. **PostgreSQL** via the `pgserver` Python wheel (a system Postgres
   ≥ 13 also works — any plain PG with a reachable socket/URL):
   ```sh
   python3 -m venv ~/pgvenv && ~/pgvenv/bin/pip install pgserver
   # Start get_server('<data dir outside the repo>') and note the URI it
   # prints, e.g. postgres://postgres@/postgres?host=<data dir>
   ```
   The pgserver wheel ships no `pgcrypto` extension, but the migrations
   only need `gen_random_uuid()`, which is core since PG 13. Drop a stub
   into the wheel's extension dir so the first migration's
   `CREATE EXTENSION pgcrypto` succeeds:
   ```sh
   EXT=$(python3 -c "import pgserver, pathlib; print(pathlib.Path(pgserver.__file__).parent / 'pginstall/share/postgresql/extension')")
   printf "default_version = '1.3'\nrelocatable = true\n" > "$EXT/pgcrypto.control"
   printf -- "-- stub: functions used are core PostgreSQL\n" > "$EXT/pgcrypto--1.3.sql"
   ```
   (Postgres refuses to run as root: run the server as an unprivileged
   user, and make sure that user can read the wheel's `pgserver.libs`
   directory — `chmod -R a+rX` on it if the venv is root-owned.)
2. **Create the databases** (example names; the pgserver `createdb`
   binary lives in the wheel's `pginstall/bin/`):
   ```sh
   createdb rls117        # post-hardening DB (all migrations)
   createdb rls117pre     # pre-hardening DB (up to spec 138)
   ```
3. **Apply bootstrap + migrations** to each (from `apps/worker`):
   ```sh
   RLS_RPC_PG_URL='postgres://postgres@/rls117?host=<data dir>&port=<port>' \
     pnpm exec tsx tests/rls-rpc/db/run-migrations.ts
   RLS_RPC_PG_URL='postgres://postgres@/rls117pre?host=<data dir>&port=<port>' \
   RLS_RPC_MIGRATIONS_UNTIL='20261022140000_claim_rpc_grouped_usage.sql' \
     pnpm exec tsx tests/rls-rpc/db/run-migrations.ts
   ```

## Running

```sh
cd apps/worker
# Pre-hardening DB: every hole must show OPEN (37 assertions):
RLS_RPC_MODE=vulnerable RLS_RPC_PG_URL='...rls117pre...' \
  pnpm exec tsx tests/rls-rpc/check.ts
# Post-hardening DB: every hole must show CLOSED (37 assertions):
RLS_RPC_PG_URL='...rls117...' pnpm exec tsx tests/rls-rpc/check.ts
```

## Results (2026-10-23, PostgreSQL 16.2, full migration chain)

- Vulnerable mode on the pre-hardening DB: **37 assertions, 0 failures**
  — all five legacy RPCs executable by authenticated + anon, role/status
  self-update succeeds, foreign-workspace BYOC insert succeeds, planted
  BYOC row visible, claim(100000, 100000) returns all 150 seeded rows.
- Hardened mode on the post-hardening DB: **37 assertions, 0 failures**
  — (a) 15/15 legacy-RPC probes (denied to authenticated + anon with
  SQLSTATE 42501, allowed to service_role), (b) 5/5 users assertions
  (role + status denied, name update + service-role update succeed),
  (c) 4/4 BYOC assertions (foreign insert denied 42501, own insert ok,
  planted row invisible, own rows visible), (d) claim cap returns
  exactly 100 of 150, (e) 6/6 unified-overload regression probes
  unchanged, (f) 6/6 download-jobs policy assertions (all four policies
  `roles={authenticated}`, RLS visibility intact).
- The migration is idempotent: re-applying
  `20261023120000_rls_rpc_hardening.sql` to the hardened DB exits 0.

### ACL dump — before (pre-hardening)

```
claim_due_queue_items(p_limit integer, p_max_per_page integer)  (default: EXECUTE TO PUBLIC)
fail_stuck_download_jobs(p_timeout_minutes integer)  (default: EXECUTE TO PUBLIC)
get_page_queue_status_counts(p_page_id uuid, p_user_id uuid)  (default: EXECUTE TO PUBLIC)
recover_stuck_publishing_items(p_timeout_minutes integer)  (default: EXECUTE TO PUBLIC)
settle_queue_item_outcome(..., p_error_code integer, p_error_subcode integer, ...)  (default: EXECUTE TO PUBLIC)
media_download_jobs policies: roles="{public}" (all four)
workspace_byoc_credentials :: workspace_byoc_user_access :: using=(auth.uid() = user_id) :: with_check=(auth.uid() = user_id)
(unified overloads already: {postgres=X/postgres,service_role=X/postgres})
```

### ACL dump — after (hardened)

```
claim_due_queue_items(p_limit integer, p_max_per_page integer)  {postgres=X/postgres,service_role=X/postgres}
fail_stuck_download_jobs(p_timeout_minutes integer)  {postgres=X/postgres,service_role=X/postgres}
get_page_queue_status_counts(p_page_id uuid, p_user_id uuid)  {postgres=X/postgres,service_role=X/postgres}
recover_stuck_publishing_items(p_timeout_minutes integer)  {postgres=X/postgres,service_role=X/postgres}
settle_queue_item_outcome(..., p_error_code integer, p_error_subcode integer, ...)  {postgres=X/postgres,service_role=X/postgres}
media_download_jobs policies: roles="{authenticated}" (all four)
workspace_byoc_credentials :: workspace_byoc_user_access ::
  using=((auth.uid() = user_id) AND (EXISTS (SELECT 1 FROM workspaces w
    WHERE ((w.id = workspace_byoc_credentials.workspace_id) AND (w.owner_id = auth.uid())))))
  with_check=(same compound expression)
(unified overloads unchanged: {postgres=X/postgres,service_role=X/postgres})
```

The full machine-generated dumps are printed by every `check.ts` run.
