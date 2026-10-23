# Spec 122 load-proof harness

Certifies the D11 claim (spec 119 §5.2): the real claim → queue → publish →
settle pipeline drains a simulated 1M posts/day with zero lost items, zero
duplicate publishes, and claim-tick p95 < 30 s — against a real PostgreSQL
database with **all repo migrations applied** and mock publishers for all
six platforms. No real platform is contacted; no Facebook account is used.

## Layout

| File | Role |
|---|---|
| `db/bootstrap.sql` | Minimal Supabase stub for plain Postgres: `anon` / `authenticated` / `service_role` roles, `auth` schema, `auth.users`, `auth.uid()` |
| `db/run-migrations.ts` | Applies `bootstrap.sql`, then every file in `supabase/migrations/` in filename order |
| `pg-adapter.ts` | `pg`-backed adapter implementing both pipeline DB interfaces (`ClaimerDbClient`, `ConsumerDbClient`) against the real RPCs |
| `seed.ts` | Deterministic seed (md5-derived ids): 10 workspaces, per-platform accounts/destinations, ≥1M `queue_items` (see the D5-cap sizing in its header) |
| `mocks.ts` | Mock `Publisher` for all six platforms: documented per-lane latency profile + idempotency ledger + deterministic outcome mix (~97% published / ~1% failed / ~2% retry-then-published) |
| `queue-shim.ts` | In-memory Cloudflare Queues shim: `sendBatch` producer for the claimer; delivers Cloudflare-shaped `MessageBatch`es to the real `handleQueueBatch`, with wrangler.toml batch/concurrency/retry/DLQ semantics |
| `certify.ts` | Drain runner: repeated real `runClaimTick`s interleaved with live consumers until the backlog drains; samples tick durations at 100/75/50/25/10% backlog depths; writes `results/certification-<YYYYMMDD>-<label>.md` + `.json` |
| `results/` | Certification outputs committed with the PR |

Harness code lives **outside** the worker build: `apps/worker/tsconfig.json`
includes only `src/**` and `tests/**`, the harness has its own
`load-harness/tsconfig.json` (so lint's type-aware project service can parse
it), and no harness file matches vitest's `*.test.*` include pattern — the
normal worker suite never runs the harness. `pg`, `@types/pg`, and `tsx`
are devDependencies used only here.

## Reproducing a run

1. **PostgreSQL** (one-time). The certification run documented in `results/`
   used the `pgserver` Python wheel (a system Postgres also works — any
   plain PG ≥ 13 with a reachable socket/URL):
   ```sh
   python3 -m venv ~/pgvenv && ~/pgvenv/bin/pip install pgserver
   # Run as a non-root user if your shell is root (pgserver refuses/chowns
   # as root): start get_server('<data dir outside the repo>') and note the
   # URI it prints, e.g. postgres://postgres@/postgres?host=<data dir>
   ```
   The pgserver wheel ships no `pgcrypto` extension, but the migrations
   only need `gen_random_uuid()`, which is core since PG 13 (verified by
   grepping all migrations for other pgcrypto functions: none). Drop a stub
   into the wheel's extension dir so migration 1's `CREATE EXTENSION
   pgcrypto` succeeds:
   ```sh
   EXT=$(python3 -c "import pgserver, pathlib; print(pathlib.Path(pgserver.__file__).parent / 'pginstall/share/postgresql/extension')")
   printf "default_version = '1.3'\nrelocatable = true\n" > "$EXT/pgcrypto.control"
   printf -- "-- stub: functions used are core PostgreSQL\n" > "$EXT/pgcrypto--1.3.sql"
   ```
2. **Create the database** and apply bootstrap + migrations:
   ```sh
   createdb loadharness   # via the pgserver binaries or any psql
   cd apps/worker
   LOAD_PG_URL='postgres://postgres@/loadharness?host=<pg data dir>' \
     pnpm exec tsx load-harness/db/run-migrations.ts
   ```
3. **Calibration** (~50k items, projects the full-run wall-clock):
   ```sh
   LOAD_PG_URL='...' pnpm exec tsx load-harness/certify.ts --scale 0.05 --label calibration
   ```
4. **Full certification** (1,000,000 items):
   ```sh
   LOAD_PG_URL='...' pnpm load:certify -- --scale 1 --label full
   ```
   `--concurrency-scale N` multiplies the shim's consumer concurrency
   above the wrangler.toml values (fast 20 / heavy 10). If a run uses it,
   the results state the concurrency used and derive the items/day figure
   at the wrangler-configured concurrency from the measured rate.

## What is real vs simulated

Real: claimer (`runClaimTick`), consumers (`handleQueueBatch` /
`handlePublishBatch` / DLQ handler), claim/settle/recovery RPCs, unified
schema, D5 claim caps, token decrypt path (seed tokens are encrypted with
contracts' `encryptToken` under a harness master key).
Simulated: platform publish calls (mock latency profile in `mocks.ts`),
queue transport (in-memory, wrangler-shaped semantics), wall-clock cadence
(ticks run back-to-back with a 200 ms consumer breather instead of 1/min —
per-tick work is unchanged).
