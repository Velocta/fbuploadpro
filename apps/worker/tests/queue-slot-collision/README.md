# Spec 139 A15 follow-up — queue-slot collision rig

SQL-level verification rig for the A15 follow-up flagged by the #703
finisher: *in queue mode (no scheduledTime), each concurrent per-item
chain computes the next vacant slot from current queue state — two
chains could theoretically pick the same slot where the old sequential
loop wouldn't. Verify DB constraint behaviour on slot collision.*

The rig drives the handler's exact algorithm against a **real
PostgreSQL** (bootstrap + all repo migrations in filename order):
snapshot the page's `queued` times → compute with the **real**
`calculateNextVacantSlot` from `apps/web/src/lib/slot-scheduler.ts` →
insert. Concurrency is 8 chains — the bulk pool's cap
(`BULK_ENQUEUE_CONCURRENCY`) — barrier-synchronized so every chain
snapshots the same queue state before any insert lands.

## Verdict (2026-10-24, PostgreSQL 16.2 via the pgserver wheel)

**The collision is REAL, and the database does nothing about it.**

- **Catalogue (both modes):** `legacy_queue_items` has NO unique
  constraint or index covering `scheduled_time` — the only uniqueness
  is the PK and `uq_queue_items_user_id (user_id, id)`. The two
  indexes that do cover (fb_page_id, scheduled_time) —
  `idx_queue_items_user_page`, `idx_queue_items_claim_partitioned` —
  are non-unique. A colliding insert is an ordinary successful insert.
- **Vulnerable mode** (pre-fix DB, 41 migrations): 8 concurrent
  chains, pre-fix sequence → **8 rows landed on 1 distinct
  scheduled_time; every insert committed; zero errors.** Two posts
  double-book one destination slot, silently — the #703 finisher's
  assumption that "failure isolation bounds the impact" does not hold
  for this path: there is no failure to isolate.
- **Hardened mode** (42 migrations, incl.
  `20261024120000_a15_atomic_queue_slot_insert.sql`): 16 assertions,
  0 failures —
  (c) `claim_queue_slot_insert` semantics: first claim of a free slot
  instance returns the row in the old direct-insert shape; a second
  claim of the same instance returns no row and inserts nothing; a
  claim of a different instance succeeds; the function is SECURITY
  DEFINER with EXECUTE granted to service_role only;
  (d) the same 8-chain barrier race claiming through the RPC with the
  fixed handler's recompute-and-retry loop: **8 items on 8 distinct
  slot instances** (32 claim attempts — the race genuinely happened
  and the losers retried onto later slots);
  (e) reorder guard: two queued rows swap `scheduled_time`s via two
  sequential single-row UPDATEs — the spec 134 reorder protocol —
  and both commit. **This is why the fix is an atomic claim RPC and
  not a unique index:** any immediate uniqueness over the time
  dimension rejects the first UPDATE of every reorder permutation.

The route-level regression test (stateful fake store, real handler,
both client paths) lives at
`apps/web/tests/api/publishing-queue-a15.test.ts`; against the
pre-fix handler it fails with all 6 concurrent enqueues on 1 distinct
slot instance.

Residual scope, stated plainly: the fix serializes **enqueue chains
against each other** (the A15 scenario). An explicit-time enqueue or
a reorder PATCH can still place an item on a time another item holds
— both are user-directed placements the product has always allowed,
unchanged by this fix. The recorded batch-RPC follow-up remains the
vehicle for batch claiming; `claim_queue_slot_insert` is its seed
(one call can later claim N slots under the same per-page lock).

## Layout

| File | Role |
|---|---|
| `db/bootstrap.sql` | Minimal Supabase stub for plain Postgres (roles, `auth` schema, `auth.uid()`), copied from the db-hygiene rig. |
| `db/run-migrations.ts` | Applies `bootstrap.sql`, then every file in `supabase/migrations/` in filename order; `QUEUE_SLOT_MIGRATIONS_UNTIL=<file>` stops after that file (builds the pre-fix DB). |
| `fixtures.sql` | One user / workspace / page (UTC), three daily slots (09:00 / 13:00 / 18:00), one media item. `qslot_reset()` re-seeds; `check.ts` calls it before every section. |
| `check.ts` | The assertion runner. `QUEUE_SLOT_MODE=vulnerable` asserts the collision on the pre-fix DB (5 assertions); default `hardened` asserts the fixed behaviour (16 assertions). |

Rig code lives outside the worker build's runtime: no file here
matches vitest's `*.test.*` include pattern, so the normal worker
suite never runs the rig; the scripts are run explicitly (below).
`pg`, `@types/pg`, and `tsx` are worker devDependencies shared with
the spec 117 / 138 / 139 rigs.

## Setup (one-time)

1. **PostgreSQL** — any plain PG ≥ 13 with a reachable socket/URL.
   On this VM the `pgserver` Python wheel is what the rig was run
   with (see the db-hygiene README for the wheel route notes: run as
   an unprivileged user, keep a keeper process alive).
2. **Create the databases**:
   ```sh
   createdb qslot        # post-fix DB (all migrations)
   createdb qslotpre     # pre-fix DB (up to 20261023193000_db_hygiene.sql)
   ```
3. **Apply bootstrap + migrations** to each (from `apps/worker`):
   ```sh
   QUEUE_SLOT_PG_URL='postgres://postgres@/qslot?host=<socket dir>' \
     pnpm exec tsx tests/queue-slot-collision/db/run-migrations.ts
   QUEUE_SLOT_PG_URL='postgres://postgres@/qslotpre?host=<socket dir>' \
   QUEUE_SLOT_MIGRATIONS_UNTIL='20261023193000_db_hygiene.sql' \
     pnpm exec tsx tests/queue-slot-collision/db/run-migrations.ts
   ```

## Running

```sh
cd apps/worker
# Pre-fix DB: the collision must show (5 assertions):
QUEUE_SLOT_MODE=vulnerable QUEUE_SLOT_PG_URL='...qslotpre...' \
  pnpm exec tsx tests/queue-slot-collision/check.ts
# Post-fix DB: no double-assignment (16 assertions):
QUEUE_SLOT_PG_URL='...qslot...' pnpm exec tsx tests/queue-slot-collision/check.ts
```
