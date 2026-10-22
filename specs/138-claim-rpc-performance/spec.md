# Spec 138: Claim RPC Performance — D5 Deferral/Headroom Grouped-Usage Rewrite

**Feature Branch**: `fix/138-claim-rpc-performance`
**Created**: 2026-10-22 · **Status**: DRAFT — commissioned by Shahzeb 2026-10-22 ("Do them as well", approving the claim-RPC fix alongside PR #655) after the spec 122 full-scale certification exposed the defect below. Implementation starts after Shahzeb approves this package.
**Sources**: `~/workspace/spec122-certification-blocker-2026-10-22.md` (measured evidence, root-cause bisection — the defect report this spec fixes); spec 121 Scope 8 / D5 (the limits mechanism being made fast, semantics unchanged); spec 122 D11 (the certification criterion this defect blocks); migration `supabase/migrations/20261022130000_claim_limits_and_refresh_lease.sql` (the function being replaced).
**Depends on**: 121 (merged — the D5 claim RPC as it exists today). **Blocks**: 122 (its PR does not open until this fix merges and the T7 certification re-run passes against the fixed RPC — see plan.md merge order).

## Problem

`claim_due_queue_items(public.platform, TEXT[], INT, INT)` — the unified claim RPC created by spec 120 and amended with D5 per-destination posting limits by spec 121's migration `20261022130000_claim_limits_and_refresh_lease.sql` — does not scale to the D11 target (1M posts/day). Platforms with rows in `destination_claim_limits` (instagram, threads, x) pay a cost per claim call that grows with **(due destinations × cap rules × in-flight rows)**; at full certification scale the claim tick breaches spec 122's D11 criterion (p95 claim tick < 30 s) from tick 3 onward and a full 1M-item drain is not completable in reasonable time. Platforms with no cap rules are unaffected. This is a query-shape defect in the RPC body only — the D5 semantics are correct and are **not** being redesigned.

### Measured evidence (from the blocker report; pgserver Postgres, DB `loadharness122`, all migrations applied, 1,000,000 seeded items)

- Full-scale claim ticks grew monotonically with backlog depth: **13.5 s → 23.9 s → 38.4 s → 64.9 s → …** at concurrency-scale 1.0; **14.1 s → 44.2 s → 79.7 s → 109.8 s** at concurrency-scale 0.25. Named-config tuning (consumer concurrency, claim-round cap already 1) does not fix it — the cost is per claim *call*, not per round or per consumer.
- Isolated per-call timings (idle DB, `publish_logs` = 21,867 rows, ~15k items in `publishing`):
  - facebook / youtube / tiktok (**no** cap rules): **0.36–0.77 s** per claim call.
  - threads fast (1 rule, 1,000 destinations): 6.3 s. x fast (1 rule, 2,000 destinations): 11.4 s.
  - instagram fast (2 rules, 5,000 destinations): **54.5 s**; instagram heavy: 41.8 s; a later `EXPLAIN ANALYZE` of the same call: 65.7 s, 98.8M buffer hits.
- Root cause, bisected with stripped function copies: pass (c) (ranked selection + headroom) standalone is **0.13 s**; pass (b) (D5 deferral) alone is **32.4 s** of the ~54–66 s. Inside pass (b), each of the 4 usage values (`log_count`, `inflight_count`, `oldest_log_at`, `oldest_inflight_at`) is a **correlated subquery evaluated per (due destination × cap rule)**. The killer is `oldest_inflight_at` (`MIN(COALESCE(claimed_at, updated_at))` over `queue_items` filtered by destination + `status='publishing'`): its plan is an index scan on `idx_queue_items_status_scheduled_time` at **5.34 ms × 6,000 loops ≈ 32 s** for instagram alone (3,000 due destinations × 2 rules = 6,000 evaluations), scanning the whole in-flight index range per evaluation and heap-filtering by destination. `inflight_count` has the same shape. Pass (c) repeats the same correlated pattern for its `counted_total`.
- The cost grows with in-flight rows and with dead index entries from claim/settle churn: `autovacuum` never fired on `queue_items` during the runs (`n_dead_tup` 38,399 vs the ~200k trigger threshold for a 1M-row table at the default 0.2 scale factor; `autovacuum_count` = 0). A standalone `oldest_inflight_at` subquery at 15,133 in-flight rows measured 27–33 ms per evaluation.
- A composite index `(destination_id, status, claimed_at)` on the disposable DB did **not** fix it (pass (b) still 32.6 s; the planner still picks the status-leading index, and even forced onto the composite index a single evaluation measured 3.6 ms amid churned entries). **The query shape is the problem, not the index set.**
- Why spec 121/122 calibration missed it: at 5% scale instagram had 1 item per destination, so due-destination counts (the cost multiplier) collapsed after the first ticks and in-flight counts stayed in the hundreds. At full scale instagram has 20 items/destination and ~6,000 items in flight, exposing the full cost from tick 1.

## Goal

Rewrite the D5 usage computation inside `claim_due_queue_items` so per-destination usage is computed **once per claim call** with grouped aggregation — one grouped pass over `publish_logs`, one grouped pass over in-flight `queue_items`, over due destinations only — replacing every per-(destination × rule) correlated subquery in **both** pass (b) (deferral) and pass (c) (headroom). Behaviour is identical in every observable respect (parity contract below). Success is measured by the spec 122 certification re-run passing D11 against the fixed RPC.

## Scope

### In scope
1. **One new forward migration** (plan.md names it) that `CREATE OR REPLACE`s `claim_due_queue_items` with the grouped-usage body, re-asserts its ACLs exactly as the spec 121 migration does, adjusts the `queue_items` autovacuum storage parameters (Scope 3), and changes nothing else.
2. **The grouped-usage redesign** of passes (b) and (c) — design below. Pass (a) (`rate_limited` auto-recovery), the ranked selection, the `FOR UPDATE SKIP LOCKED` mechanics, and the return query are not rewritten; pass (c) changes only in where its per-rule `counted_total` comes from.
3. **Regression tests** (plan.md test plan): SQL-level behaviour-parity tests against a real Postgres proving the parity contract case by case, a static migration-shape test in CI, and a scale regression test that the old implementation would breach by an order of magnitude.
4. **Certification hand-off**: the fixed RPC is what the spec 122 T7 re-run certifies (protocol in plan.md). This spec's PR carries the parity + scale evidence; the 1M certification result itself lands in spec 122's PR.

### Out of scope (non-goals)
- **No worker changes** (`apps/worker/src` untouched — the RPC signature and call shape are unchanged, so the claimer cannot tell the difference). No contracts changes. No web changes except the one static test file in plan.md.
- **No other RPC changes**: `settle_queue_item_outcome`, `recover_stuck_publishing_items`, and every other function are untouched.
- **No cap changes**: `destination_claim_limits` seed values, the contracts parity values, and `destinations.metadata` override *meaning* are unchanged. No platform gains or loses a cap rule.
- No schema changes to any table (columns, constraints, RLS). No changes to the refresh-lease columns or `worker_heartbeats` from the spec 121 migration.
- No tuning of claimer config (round cap, batch size, consumer concurrency) — spec 122 already tuned what is tunable there; this spec fixes the per-call cost.
- No production data operations: the migration is delivered by PR and applied by the Supabase GitHub integration on merge, per repo rules. Never via Supabase MCP `apply_migration` / `execute_sql` (`.agents/AGENTS.md` prohibition).

## Design — grouped one-pass usage computation

### The shape (both passes read one per-call usage snapshot)

At the top of the D5 section of the function body (after pass (a), which is byte-for-byte the current statement), the function materialises the usage snapshot **once for this call** into a transaction-local temp table, and passes (b) and (c) both read from it. Materialising once is exact, not an approximation: pass (b)'s deferral updates only `scheduled_time` / `updated_at` of `queued` rows — it never inserts into `publish_logs` and never changes the `publishing` set — so the usage values pass (c) needs are the same values pass (b) computed, over a destination set that is a subset (post-deferral survivors) of the same due-destination set. The current code recomputes them per pass with identical inputs and gets identical results; the snapshot preserves that by construction.

Temp-table mechanics (prescribed; deviations need verification-gate sign-off recorded in the PR):
- `DROP TABLE IF EXISTS pg_temp.claim138_rule_usage;` then `CREATE TEMP TABLE pg_temp.claim138_rule_usage (…) ON COMMIT DROP AS …` — the drop-guard makes repeated calls inside one transaction safe; `ON COMMIT DROP` matches the worker/harness one-call-per-transaction usage and leaves nothing behind. Referenced as `pg_temp.…` because the function sets `search_path = public`.
- One row per **(due destination × applicable rule)**, with columns: `destination_id`, `metric`, `window_seconds`, `cap` (override-resolved), `log_count`, `inflight_count`, `oldest_log_at`, `oldest_inflight_at`. Pass (b) and pass (c) then derive their existing expressions from these columns with the existing formulas (parity contract) — no formula is re-derived or "simplified".

### The four CTEs that build the snapshot

1. **`due_destinations`** — the current pass (b) `due_destinations` CTE, verbatim (same joins, same filters: due `queued` items for `p_platform` + lane-kind set, active account, destination active or expired-`rate_limited`, cooldown passed, media presence rule). This set — and only this set — bounds every grouped pass below.
2. **`rules`** — due destinations × the platform's rows in `destination_claim_limits` (`lr.platform = p_platform`), with the cap resolved per (destination × rule) by the **current `LEFT JOIN LATERAL` jsonb override subquery, verbatim** (same `jsonb_typeof` guard, same metric + `window_seconds` match, same `^[0-9]+$` / `> 0` guards on `cap`, same `LIMIT 1`). The LATERAL is evaluated once per (destination × rule) against the destination row's own `metadata` — it touches no table beyond the row already in hand, was never part of the measured cost, and keeping it verbatim keeps override resolution exactly equivalent per destination × rule by construction.
3. **`log_usage`** — ONE grouped pass over `publish_logs`, grouped by (destination, rule):
   ```sql
   SELECT r.destination_id, r.metric, r.window_seconds,
          COUNT(*) AS log_count, MIN(pl.created_at) AS oldest_log_at
   FROM rules r
   INNER JOIN public.publish_logs pl
     ON pl.destination_id = r.destination_id
    AND pl.created_at > now() - make_interval(secs => r.window_seconds)
    AND (r.metric = 'calls' OR pl.result = 'success')
   GROUP BY r.destination_id, r.metric, r.window_seconds
   ```
   **Why the join-to-rules shape (chosen) over per-destination aggregates (rejected):** the counted set is defined per rule — the window length and the metric filter (`result = 'success'` only for `published`; all results for `calls`) are properties of the rule row, so the window predicate and metric filter are per-row join predicates and the grouped result is the counted set *by definition*, for any rule set a future migration inserts. A per-destination aggregate (one count/min per destination) cannot be split into per-window, per-metric values after the fact without re-scanning, and a pivoted conditional aggregate would have to hardcode today's windows/metrics into the SQL — breaking the spec 121 guarantee that later specs add caps by inserting rows with no RPC change. The join shape costs at most (#rules for the platform) index probes per log row — bounded and small (2 today) — versus the current (#due destinations × #rules) full subquery evaluations. The existing `idx_publish_logs_destination_result_created (destination_id, result, created_at)` (spec 121) serves this pass.
4. **`inflight_usage`** — ONE grouped pass over in-flight `queue_items`, grouped by destination only:
   ```sql
   SELECT q.destination_id,
          COUNT(*) AS inflight_count,
          MIN(COALESCE(q.claimed_at, q.updated_at)) AS oldest_inflight_at
   FROM public.queue_items q
   INNER JOIN due_destinations dd ON dd.destination_id = q.destination_id
   WHERE q.status = 'publishing'
   GROUP BY q.destination_id
   ```
   Per-destination (not per-rule) is exact because the current subqueries are rule-independent: in-flight rows are counted into **every** rule's total for the destination, with **no window filter** (an in-flight item counts however old its claim is — the grouped pass must not gain a window predicate). Joining to `due_destinations` keeps the scan to due destinations' in-flight rows; a destination belongs to exactly one platform, so restricting to this call's due set loses nothing the current per-destination subqueries would have seen. The existing `idx_queue_items_destination_id_status (destination_id, status)` (spec 120) leads with `destination_id` and serves this pass.

The snapshot is `rules LEFT JOIN log_usage ON (destination_id, metric, window_seconds) LEFT JOIN inflight_usage ON (destination_id)`, with `COALESCE(log_count, 0)`, `COALESCE(inflight_count, 0)`, and the two `oldest_*` columns left NULL when absent — exactly the values the current correlated subqueries produce for a (destination × rule) with no matching rows (`COUNT` → 0, `MIN` → NULL).

### What passes (b) and (c) become

- **Pass (b)**: `binding` reads the snapshot: rows where `log_count + inflight_count >= cap`, computing `release_at` with the current formula verbatim — `GREATEST(COALESCE(LEAST(oldest_log_at, oldest_inflight_at), oldest_log_at, oldest_inflight_at, now()) + make_interval(secs => window_seconds), now() + INTERVAL '1 minute')` — then `release` = `MAX(release_at)` per destination, then the current `targets` selection (`FOR UPDATE OF qi SKIP LOCKED`, same filters incl. lane-kind set) and the one-update-per-destination reschedule, unchanged.
- **Pass (c)**: `ranked_due` is the current CTE verbatim. Its `rule_usage` CTE is replaced by a read of the snapshot restricted to `ranked_due`'s distinct destinations, `counted_total = log_count + inflight_count`; `headroom` = `MIN(cap - counted_total)` per destination; `candidate_ids` bound `LEAST(GREATEST(1, p_max_per_destination), COALESCE(h.headroom, GREATEST(1, p_max_per_destination)))`, the `LIMIT v_limit` clamp (`LEAST(GREATEST(1, COALESCE(p_limit, 500)), 1000)`), and the final select/ordering are unchanged.

### Index decision — no new index in this migration

The composite `(destination_id, status, claimed_at)` index is **not** added, for three evidence-tied reasons: (1) it was tested against the old shape and did not fix it — the planner rejected it, and forced use still measured 3.6 ms per evaluation amid churned entries; adding it would be repeating a disproven fix. (2) The new grouped in-flight pass is served by the existing destination-leading `idx_queue_items_destination_id_status`, and the grouped logs pass by the existing `idx_publish_logs_destination_result_created` — the new shape's access patterns are already the leading columns of indexes that exist. (3) `queue_items` is the highest-churn table in the system (every claim/settle/recovery writes it at 1M/day design volume); a fourth index on it taxes every write to serve a read pattern the evidence does not show needing it. **Planner attention is by evidence, not by preemptive index**: the PR must attach `EXPLAIN (ANALYZE, BUFFERS)` for both grouped passes on certification-shaped data (scale-test seed) showing the destination-leading indexes in use and no per-destination loop over the in-flight set. **Contingency (only this one)**: if that evidence instead shows the grouped in-flight pass falling back to the status-leading index or a sequential scan, the builder may add `idx_queue_items_destination_status_claimed (destination_id, status, claimed_at)` as a separate statement in the same migration, with before/after `EXPLAIN` output in the PR — and no other index change is authorised by this spec.

### Autovacuum threshold for `queue_items`

The same migration sets, as a separate statement: `ALTER TABLE public.queue_items SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);` Justification is the churn evidence: at the default 0.2 scale factor a 1M-row `queue_items` accumulates ~200k dead tuples before autovacuum fires; the certification runs reached `n_dead_tup` 38,399 with `autovacuum_count` = 0, and dead entries measurably inflate every index scan on this table. At 0.02 the trigger is ~20k dead tuples — the observed 38,399 would have fired it. This is a storage-parameter change only: no data rewrite, no behaviour change, reversible by `RESET`, and it is not a substitute for the grouped rewrite (the old shape would still be O(destinations × rules) scans, just over a cleaner index).

## Behaviour-parity contract (inviolable)

Any observable difference from the current RPC on identical database state is a defect in this spec's implementation, however fast it is. Specifically:

1. **Identical claim selection**: for the same inputs (`p_platform`, `p_lane_kind_set`, `p_limit`, `p_max_per_destination`) and database state, the function returns the same rows, in the same order, with the same column values (including the `p_limit` clamp to [1, 1000] and `v_limit` behaviour), and flips the same rows to `publishing` with `claimed_at` set.
2. **Identical deferral**: the same destinations are judged at-cap (`log_count + inflight_count >= cap` for any rule, counts defined exactly as today — `published` counts `publish_logs` rows with `result = 'success'` inside the rolling window, `calls` counts all `publish_logs` rows inside the window, and **all** in-flight `publishing` items are added to both metrics' counts with no window filter); the same due items are rescheduled, once per destination per call, before claim selection, inside the same transaction.
3. **Identical `release_at` computation**: per binding rule, the oldest counted event is `COALESCE(LEAST(oldest_log_at, oldest_inflight_at), oldest_log_at, oldest_inflight_at, now())` — the `LEAST` over the two oldest timestamps with the current NULL fallbacks preserved exactly — plus that rule's window, floored at `now() + INTERVAL '1 minute'`; the destination's `release_at` is the **MAX across its binding rules**. Window cutoffs use the function's `now()` (transaction timestamp), as today.
4. **Identical headroom bounding in pass (c)**: per-destination rank bound is `LEAST(GREATEST(1, p_max_per_destination), COALESCE(headroom, GREATEST(1, p_max_per_destination)))` where headroom is `MIN(cap - counted_total)` across the destination's rules and `counted_total` is the same per-rule count as in (2); destinations with no rule rows are unbounded by D5, exactly as today.
5. **Pass (a) untouched**: `rate_limited` auto-recovery is the current statement, byte-for-byte — a destination evaluated by the call (due queued item for this platform) whose `next_allowed_publish_at` has passed is restored to `active` with the cooldown cleared, in the claim transaction.
6. **Per-lane filtering untouched**: the lane-kind-set predicate (`p_lane_kind_set IS NULL OR cardinality = 0 OR qi.kind = ANY (p_lane_kind_set)`) applies identically in due-destination selection, deferral targets, and claim selection.
7. **Signature, return shape, ACLs unchanged**: `claim_due_queue_items(public.platform, TEXT[], INT, INT)` with the same defaults (500 / 3), the same `RETURNS TABLE` column list and types, `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`, and the same ACL re-assertion as the spec 121 migration (`REVOKE EXECUTE … FROM PUBLIC, anon, authenticated; GRANT EXECUTE … TO service_role`).
8. **Config meaning unchanged**: `destination_claim_limits` (table, RLS posture, seed rows) is not modified; `destinations.metadata` `claim_limits` overrides resolve per destination × rule exactly as the current LATERAL does — an element replaces a seeded rule's cap only when metric AND `window_seconds` match and `cap` is a positive integer string, first match wins (`LIMIT 1`), invalid/absent shapes mean "no override".

## Applicable repo rules (read in full before building)

- `.agents/AGENTS.md`: migrations are versioned forward files in `supabase/migrations/YYYYMMDDHHmmss_<name>.sql` delivered via PR and applied by the Supabase GitHub integration on merge — never Supabase MCP `apply_migration`/`execute_sql`; after a migration PR merges, verify the Supabase check-run on `main` (plan.md carries this step).
- `.agents/rules/git-workflow.md`: branch `<type>/<spec-id>-<short-desc>`; conventional commits; human merge gate; documentation/spec sync in the same PR.
- `.agents/rules/coding-standards.md`: spec-first traceability (every change maps to a task in tasks.md), strict scope boundaries (adjacent improvements are notes, not code), zero stubs/placeholders.
- Specs 121/122 plan conventions (standing pipeline): isolated worktree from fresh `main`, strict file ownership, local gates green before the single push, `gh pr checks` to green, verification-gate agent before Shahzeb's merge decision, never merge without his approval. (Where `.agents/` text and the standing pipeline differ on local-vs-CI checks, the specs 121/122 convention — local gates first — governs, as it did for those specs.)

## Acceptance

- [ ] One new migration replaces `claim_due_queue_items` with the grouped-usage body; the function contains **zero** correlated per-(destination × rule) subqueries against `publish_logs` / `queue_items` in passes (b) and (c) (grep/`EXPLAIN` evidence in PR), and the per-call usage snapshot is computed once and read by both passes
- [ ] Parity contract §1–§8 holds, proven by the SQL-level parity suite (plan.md) passing against a real Postgres with all migrations applied — every case in the suite green, including exact `release_at` values, override resolution, and the calls-vs-published distinction
- [ ] Scale regression test passes: a single instagram-shaped claim call on the prescribed seed completes **< 5 s** (old implementation measured 54.5 s on the equivalent isolated call — an order of magnitude breach) with claim/deferral outcomes matching the fixture's expected counts
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` evidence for both grouped passes attached to the PR, showing destination-leading index use and no per-destination in-flight loop; the contingency index, if invoked, is the only index change and carries before/after plans
- [ ] The migration changes nothing else: no other function, no table schema, no config-table rows, no cap values (diff-scoped; the static migration test in CI asserts the shape, signature, ACL lines, and the autovacuum statement)
- [ ] Autovacuum storage parameters for `queue_items` set as specced (0.02 / 0.01), as a separate statement in the same migration
- [ ] Local verify green before push (worker test baseline unchanged and green — no worker source changes; web security migration tests incl. the new static test green; `bash .github/scripts/regression-guardrails.sh` passes); CI green via `gh pr checks`
- [ ] PR presented for Shahzeb's merge approval with parity results, scale result, and `EXPLAIN` evidence — never merge without it; **this PR merges before spec 122's PR**, and spec 122's PR body records the dependency
- [ ] After merge: Supabase check-run on `main` verified for the migration (repo rule), and the spec 122 certification re-run (plan.md protocol) passes D11 — p95 claim tick < 30 s at every depth band, 0 lost, 0 duplicates, drain ≤ 24 h wall-clock for the simulated 24 h

## Risks / notes

- **Parity is the risk, not speed.** The grouped shape is straightforwardly fast enough (the bisection showed pass (c)'s ranking at 0.13 s and the logs subqueries at 0.09 ms standalone); the failure mode to guard against is a silent semantic drift — a window predicate applied to in-flight rows, a `MIN` taken over the wrong grouped set, an override resolved once per destination instead of per rule. The parity suite is therefore written against the *documented current semantics* case by case, and any case the builder cannot make pass is a stop-and-raise, not a judgement call.
- **Temp-table-in-function is the one new mechanism.** It is session/transaction-local, invisible to other callers, and the function's callers (claimer, harness adapter) each call within their own transaction. If the builder hits a concrete obstacle (e.g. a caller invoking the RPC twice in one transaction in a way the drop-guard does not cover), the fallback shape — the same grouped CTEs computed independently inside pass (b) and pass (c), still zero correlated subqueries — preserves the performance fix and the parity contract, but the substitution must be flagged in the PR and cleared by the verification gate; it is not a silent builder choice.
- **The certification DB is dirty.** The blocker report records diagnostic artifacts (`claim_test_b` / `claim_test_c` functions, the test composite index, ~15k leftover `publishing` items) in `loadharness122`. The re-run protocol (plan.md) drops and recreates it — reusing it would contaminate both timing and correctness results.
- **This fix unblocks more than spec 122.** The defect would have hit production instagram/threads/x claiming at specs 124/127 launch; facebook/youtube/tiktok are unaffected today only because they have no cap rows — the first future cap row inserted for any platform (the spec 121 extension path) would have imported the defect. The grouped shape removes that landmine generically, because it never branches on platform or rule count.

## Open blockers for Shahzeb

- None. The fix direction, the certification criterion (D11), and the merge order (138 before 122) were decided by Shahzeb 2026-10-22. Per-PR merge approval is still his, per Acceptance.
