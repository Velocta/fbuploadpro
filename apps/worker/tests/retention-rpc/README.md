# Spec 139 retention rig

SQL-level regression rig for the 30-day retention cleanup
(`supabase/migrations/20261024120000_retention_cleanup.sql`): proves,
against a **real PostgreSQL** with bootstrap + all repo migrations
applied in filename order, that
`public.cleanup_expired_publish_history(p_cutoff, p_batch_size, p_dry_run)`

1. deletes **only** expired history — `publish_logs` rows older than
   the cutoff whose parent queue item is terminal (published / failed /
   cancelled), and terminal `queue_items` whose `updated_at` is older
   than the cutoff — and **never** touches live rows (queued /
   publishing) or their logs, at any age;
2. is backed by the two indexes the migration adds
   (`idx_publish_logs_created_at`; the partial
   `idx_queue_items_terminal_updated_at`), with the items-selection
   shape planned through the partial index;
3. is executable by `service_role` only (PUBLIC / anon / authenticated
   denied — catalog check plus a live 42501 probe);
4. honours the per-call batch limit, drains exactly across repeated
   calls, is idempotent, supports a count-only dry-run, and the
   migration re-applies cleanly.

Modelled on the spec 139 db-hygiene rig (`apps/worker/tests/db-hygiene/`).

## Layout

| File | Role |
|---|---|
| `db/bootstrap.sql` | Minimal Supabase stub for plain Postgres: `anon` / `authenticated` / `service_role` (BYPASSRLS) roles, `auth` schema, `auth.users`, `auth.uid()` — plus Supabase's default-privilege posture via `ALTER DEFAULT PRIVILEGES`. Copied from the db-hygiene rig. |
| `db/run-migrations.ts` | Applies `bootstrap.sql`, then every file in `supabase/migrations/` in filename order. |
| `fixtures.sql` | Deterministic fixtures (`retention_reset`, `retention_seed_bulk`): one workspace graph, seven curated queue items and six publish_logs around the 30-day cutoff (old/recent/edge terminal, old queued, old publishing). The bulk seeder adds 2,000 old published rows for the EXPLAIN assertion. |
| `check.ts` | The assertion runner (groups a–h in the file header). Prints a pass/fail line per assertion and exits non-zero on any failure. |

Rig code lives outside the worker build's runtime: no file here
matches vitest's `*.test.*` include pattern, so the normal worker suite
never runs the rig; the scripts are run explicitly (below). `pg`,
`@types/pg`, and `tsx` are worker devDependencies shared with the
spec 117 / 138 / 139 rigs.

## Setup (one-time)

1. **PostgreSQL** — any plain PG ≥ 13 with a reachable socket/URL. On
   this VM the `pgserver` Python wheel is what the rigs run with:
   ```sh
   python3 -m venv ~/pgvenv && ~/pgvenv/bin/pip install pgserver
   ```
   (The server refuses to run as root — run it as an unprivileged
   user and keep a keeper process alive for the whole rig run; see
   the db-hygiene README for the wheel's quirks.)
2. **Create the database**:
   ```sh
   createdb retentionrig
   ```
3. **Apply bootstrap + migrations** (from `apps/worker`):
   ```sh
   RETENTION_RPC_PG_URL='postgres://postgres@/retentionrig?host=<socket dir>' \
     pnpm exec tsx tests/retention-rpc/db/run-migrations.ts
   ```

## Running

```sh
cd apps/worker
RETENTION_RPC_PG_URL='postgres://postgres@/retentionrig?host=<socket dir>' \
  pnpm exec tsx tests/retention-rpc/check.ts
```

## Results (2026-10-24, PostgreSQL 16.2 via the pgserver wheel, full migration chain)

- **30 assertions, 0 failures** — (a) 5/5 function + ACL assertions
  (exists; service_role EXECUTE only; anon/authenticated denied in the
  catalog and by a live 42501 probe), (b) 2/2 index assertions,
  (c) 4/4 dry-run assertions (counts 2 logs / 3 items, nothing deleted),
  (d) 7/7 full-run assertions (exactly the expired terminal history
  deleted; recent + edge terminal rows kept; BOTH live items and their
  old logs untouched; the young log of a deleted item removed by
  cascade), (e) 3/3 idempotency assertions (second run 0/0, counts
  stable), (f) 6/6 batch assertions (batch=1 sequence (1,1), (1,1),
  (0,1), (0,0), ending at the same survivor set), (g) the EXPLAIN
  assertion (items-selection shape planned through
  `idx_queue_items_terminal_updated_at` at 2,007 seeded rows,
  `enable_seqscan=off`), (h) 2/2 migration-idempotency assertions.
- The migration chain itself applies cleanly from scratch (42
  migrations, 19 public tables).
