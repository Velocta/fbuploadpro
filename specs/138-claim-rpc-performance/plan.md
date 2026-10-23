# Plan — Spec 138: Claim RPC Performance (Grouped-Usage Rewrite)

Standing pipeline applies in full: isolated worktree from fresh `main` → strict file ownership → local verify → single push → `gh pr create` → `gh pr checks` to green → verification-gate agent → Shahzeb's merge decision. Never merge without his approval.

## The migration

**One new file, exactly this name**: `supabase/migrations/20261022140000_claim_rpc_grouped_usage.sql` — timestamp `20261022140000` sorts immediately after spec 121's `20261022130000_claim_limits_and_refresh_lease.sql` and after every migration currently on `main`. No existing migration is edited. Contents, in order:

1. **Header comment** in the spec 121 migration's style: purpose, the defect evidence summary (per-(destination × rule) correlated subqueries; `oldest_inflight_at` 5.34 ms × 6,000 evaluations ≈ 32 s; reference to the blocker report), the grouped design in brief, and the parity statement ("semantics unchanged — see spec 138 parity contract").
2. **`CREATE OR REPLACE FUNCTION public.claim_due_queue_items(public.platform, TEXT[], INT, INT)`** — same signature, defaults, `RETURNS TABLE` list, `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` as the spec 121 definition. Body: pass (a) verbatim → usage-snapshot materialisation (spec.md Design: `due_destinations` verbatim → `rules` with the LATERAL override verbatim → grouped `log_usage` → grouped `inflight_usage` → `pg_temp.claim138_rule_usage` temp table, `ON COMMIT DROP`, drop-guarded) → pass (b) reading the snapshot (current `binding`/`release`/`targets`/update, formulas verbatim) → pass (c) with `ranked_due` verbatim and its `rule_usage`/`headroom` derived from the snapshot. `v_limit` clamp unchanged.
3. **ACL re-assertion**, the spec 121 pattern verbatim:
   `REVOKE EXECUTE ON FUNCTION public.claim_due_queue_items(public.platform, TEXT[], INT, INT) FROM PUBLIC, anon, authenticated;`
   `GRANT EXECUTE ON FUNCTION public.claim_due_queue_items(public.platform, TEXT[], INT, INT) TO service_role;`
4. **Autovacuum statement** (separate statement, own comment block citing the churn evidence — `n_dead_tup` 38,399, `autovacuum_count` 0 at the ~200k default threshold):
   `ALTER TABLE public.queue_items SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01);`
5. **No index statements** — per spec.md's index decision, the tested composite index is not warranted for the new grouped shape (existing `idx_queue_items_destination_id_status` and `idx_publish_logs_destination_result_created` already lead with the grouped passes' access columns, and the composite was disproven against the old shape). The **single authorised contingency**: if the `EXPLAIN (ANALYZE, BUFFERS)` evidence (Test plan §4) shows the grouped in-flight pass not using a destination-leading index, add `CREATE INDEX idx_queue_items_destination_status_claimed ON public.queue_items (destination_id, status, claimed_at);` as a separate statement in this same migration, with before/after plans in the PR. No other index change is in scope.

**Diff-size note**: `git-workflow.md` asks for atomic PRs under ~150–200 lines; a `CREATE OR REPLACE` of this function is inherently a full-body replacement (the spec 121 migration that created the current body has the same property). The PR is atomic in the sense that matters — one function, one mechanism, no unrelated change — and the PR body states this explicitly rather than splitting the function across PRs (which would leave a half-rewritten RPC on `main`).

## Approach

1. **Read first**: repo `.agents/AGENTS.md` + `.agents/rules/` (migration-via-PR rule, MCP prohibition, branch/commit rules, spec-traceability); spec 138 package in full; spec 121 spec Scope 8 + the full `20261022130000` migration; the blocker report `~/workspace/spec122-certification-blocker-2026-10-22.md`; spec 122 spec/plan (D11 criterion + T7 shape). Confirm the worktree base (Sequencing).
2. **Write the static migration test first** (Test plan §1) so the shape constraints are executable before the SQL exists.
3. **Write the migration**: transcribe the current function body as the starting point and change *only* the usage computation — pass (a), the `due_destinations` CTE, the LATERAL override, every formula, the `targets`/update mechanics, `ranked_due`, and the return query are carried over textually, not re-typed from memory. Diff the new body against the spec 121 body and account for every changed line in the PR (each change must map to "correlated subquery → snapshot read" or the snapshot construction itself).
4. **Build the parity + scale rig** (Test plan §2–§3) and run it against a local pgserver Postgres with all migrations applied: first against the *pre-fix* function (migration withheld) to confirm the parity suite documents current behaviour and the scale test **fails** at the old timings, then with the fix applied — parity green, scale green. This before/after is the core evidence; record both runs in the PR.
5. **Planner evidence** (Test plan §4) on the scale seed.
6. **Local gates, push, PR, CI** (below), then the verification gate, then Shahzeb's merge decision.
7. **Post-merge**: verify the Supabase check-run on `main` for the migration (`.agents/AGENTS.md` gate), then hand off to the certification re-run (protocol below) on the spec 122 branch.

## Test plan

### §1 Static migration test (CI, no database)
- NEW: `apps/web/tests/security/claim-rpc-performance-migration.test.ts`, following the precedent of `claim-limits-migration.test.ts` / `unified-schema-migration.test.ts` in the same directory (read the migration file from `supabase/migrations/`, assert by pattern). Asserts: the file is named `20261022140000_claim_rpc_grouped_usage.sql` and sorts after `20261022130000`; exactly one `CREATE OR REPLACE FUNCTION public.claim_due_queue_items` with the unchanged signature/defaults/`SECURITY DEFINER`; the ACL revoke/grant pair present; the autovacuum `ALTER TABLE … SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.01)` present; **no** `DROP TABLE/FUNCTION/COLUMN`, no changes to `destination_claim_limits` (no `INSERT INTO public.destination_claim_limits`, no seed values), no other `CREATE OR REPLACE FUNCTION`; the grouped shape is present (`GROUP BY` grouped passes over `publish_logs` and in-flight `queue_items`, temp-table materialisation) and the four correlated-subquery patterns of the old body (per-destination `SELECT COUNT(*)`/`SELECT MIN(` subqueries inside the rule-usage CTEs) are absent.

### §2 Behaviour-parity suite (real Postgres, SQL level)
- **Home**: `apps/worker/tests/claim-rpc/` — a self-contained rig in the spec 122 load-harness pattern (real pgserver Postgres, `LOAD_PG_URL`-style connection env `CLAIM_RPC_PG_URL`, bootstrap + all repo migrations applied in filename order via a minimal runner modelled on `load-harness/db/run-migrations.ts` from the spec 122 branch). Files: `fixtures.sql` (deterministic tenant/destination/log/item fixtures), `parity.ts` (runner + assertions), `README.md` (how to run, incl. the pgserver + pgcrypto-stub setup copied from the load-harness README). Named so the default vitest include (`*.test.*`) does **not** pick them up — same convention as the load harness — and run explicitly in the local gates.
- **Method**: each case seeds a small exact fixture, calls the RPC once via SQL with fixed arguments, and asserts the returned rows, the flipped rows' state, and the deferred rows' exact `scheduled_time`. Expected values are computed from the documented current semantics (spec.md parity contract), **not** captured from the new implementation; the suite is also run once against the pre-fix function (§Approach 4) and must pass there too — that is what makes it a parity suite rather than a new-behaviour suite.
- **Cases** (all required):
  1. **At-cap deferral to exact window end**: destination at the `published` cap (success logs inside 24 h = cap) → 0 claimed; its due items' `scheduled_time` = oldest in-window success log + 24 h exactly (when that exceeds the floor).
  2. **Floor**: oldest counted event recent enough that window end < `now() + 1 minute` → `release_at` = `now() + 1 minute` exactly.
  3. **Multi-rule binding (MAX release)**: destination binding on both instagram rules (`calls`/1 h and `published`/24 h) with different per-rule window ends → deferred to the **later** of the two.
  4. **Oldest-event LEAST semantics**: (i) oldest log earlier than oldest in-flight → release derives from the log; (ii) oldest in-flight earlier → derives from the in-flight item's `COALESCE(claimed_at, updated_at)`; (iii) one side NULL (no logs / no in-flight) → derives from the other; (iv) in-flight item claimed **outside** every window still counts and can be the oldest event (no window filter on in-flight).
  5. **Metadata override caps**: override lowering a cap makes an under-default-cap destination at-cap (deferred, release computed against the override cap's rule window); override raising a cap lets an at-default-cap destination claim; override with non-matching metric or `window_seconds` is ignored; malformed entries (non-numeric `cap`, `cap` ≤ 0, `claim_limits` not an array) are ignored.
  6. **Headroom-bounded claiming**: destination under cap on all rules but with smallest headroom (e.g. 2) < `p_max_per_destination` (3) → claims exactly 2; headroom = 0 case is the at-cap case (deferred, not claimed).
  7. **Calls vs published distinction**: failed/other-result logs inside 1 h count toward `calls` but not `published` — a destination at the `calls` cap via failures only is deferred by the 1 h rule; the same rows do not move the `published` count; success rows count toward both.
  8. **In-flight counting**: `publishing` items (not yet in `publish_logs`) count toward both metrics — destination with logs + in-flight summing to cap is at-cap.
  9. **`rate_limited` recovery**: destination `rate_limited` with `next_allowed_publish_at` in the past + due item → status `active`, cooldown cleared, items claimable in the same call; with cooldown in the future → untouched, nothing claimed or deferred by this call.
  10. **No-rule platform**: facebook-shaped call (no `destination_claim_limits` rows) claims as the pre-fix RPC does — no deferral, no headroom bound beyond `p_max_per_destination`.
  11. **Lane filtering**: with a lane-kind set, deferral reschedules only that lane's due items for an at-cap destination and claims only that lane's kinds; the other lane's items keep their `scheduled_time`.
  12. **Selection invariants**: global `p_limit` clamp at 1000, per-destination rank order (`scheduled_time`, then `id`), and deferred items are not re-claimed within the same call.

### §3 Scale regression test (real Postgres)
- **Home**: `apps/worker/tests/claim-rpc/scale.ts` (same rig as §2; seed + timing + assertions).
- **Seed shape** (modelled on the certification seed + the blocker report's isolated setup): platform instagram with its 2 seeded rules; **5,000 destinations** (accounts active, destinations active), of which **3,000 are due** (due `queued` items, fast-lane kinds); **~6,000 items in `publishing`** spread over the due destinations; **~21,867 `publish_logs` rows** across the due destinations inside the windows (mix of `success` and other results); remaining destinations idle (no due items) so the due-set bounding is also exercised. Deterministic ids (md5-derived, harness pattern).
- **Assertion**: one call `claim_due_queue_items('instagram', <fast-lane kind set>, 500, 3)` completes in **< 5 s** wall-clock on the harness pgserver, and the claimed/deferred outcome counts match the fixture's precomputed expectation. **Bound rationale**: the old implementation measured **54.5 s** for the equivalent isolated instagram-fast call (32.4 s for pass (b) alone) — the bound is breached by the old code by ~11× (an order of magnitude), while the grouped shape's components measured standalone (ranked selection 0.13 s; logs index-only scans 0.09 ms) leave >10× headroom under the bound for pgserver variance. The test prints the measured duration either way; a pass at 4.9 s is a pass, but the PR records the actual number.

### §4 Planner evidence
- On the §3 seed (post-fix), capture `EXPLAIN (ANALYZE, BUFFERS)` for the two grouped passes (run the snapshot CTEs standalone with the same parameters) and attach to the PR: expected — in-flight pass via `idx_queue_items_destination_id_status` (or an equivalent destination-leading plan) as one grouped scan, logs pass via `idx_publish_logs_destination_result_created`, no loop of 6,000 index scans. If the in-flight plan contradicts this, invoke the §Migration contingency index and re-capture.

## Sequencing / merge order

1. **138 builds from `origin/main`**: worktree `~/workspace/wt-138`, branch `fix/138-claim-rpc-performance`, based on the `origin/main` tip recorded in the task brief as **`0000514`** — the builder re-checks the tip at T1; if `main` has moved (e.g. PR #655's merge), branch from the then-current tip and record the actual base in the PR (138 touches no contracts code, so #655's parity test does not interact).
2. **138 PR merges first.** Spec 122's PR does not exist yet (deliberately unopened); nothing else is waiting on this RPC.
3. **Then spec 122 proceeds**: its combined branch (`feat/122-facebook-publisher-port-load-proof`) updates from the new `main` (clean expected — disjoint files: 138 = one migration + tests; 122 = worker port + load harness), the certification re-run below executes, and **spec 122's PR body notes the dependency**: "Certification runs against `claim_due_queue_items` as rewritten by spec 138 (PR #…, merged); the original T7 failure and root cause are recorded in `~/workspace/spec122-certification-blocker-2026-10-22.md`."

## Certification re-run protocol (spec 122 T7, against the fixed RPC)

Executed on the updated spec 122 combined branch after 138 merges (hand-off in tasks.md; owned by the 122 builder, gated by this spec's Acceptance):

1. **Drop and recreate the harness DB**: drop `loadharness122` on the running pgserver entirely and recreate it empty — the old DB carries diagnostic artifacts (`claim_test_b` / `claim_test_c` functions, the test index `idx_qi_dest_status_claimed`, ~15k leftover `publishing` rows) that would persist through the seed's TRUNCATE and contaminate the run.
2. **Apply all migrations** in filename order (bootstrap + `supabase/migrations/`, via `apps/worker/load-harness/db/run-migrations.ts` with `LOAD_PG_URL` pointing at the fresh DB) — this is what brings in `20261022140000_claim_rpc_grouped_usage.sql`; confirm the applied list in the runner output includes it.
3. **Full-scale run**: `pnpm load:certify -- --scale 1 --label full` at concurrency-scale **1.0** (wrangler-configured consumer concurrency: fast 20 / heavy 10) — 1,000,000 seeded items, no concurrency scaling.
4. **Pass criteria (spec 122 D11 / T7, all required)**: p95 claim tick **< 30 s at every depth band** (100 / 75 / 50 / 25 / 10 % backlog); **0 lost** items; **0 duplicates** on the mocks' idempotency ledger; drain of the simulated 24 h completes in **≤ 24 h wall-clock**.
5. **Record**: the results file (`results/certification-<date>-full.md` + `.json`) is committed on the 122 branch and attached to spec 122's PR, which cites the measured numbers only — never a rounded-up figure. If any criterion fails, stop: no 122 PR, and the failure evidence goes back to Shahzeb (a second blocker report), not into tuning inside 122.

## File-ownership sketch (verify exact paths in repo before coding)

- NEW: `supabase/migrations/20261022140000_claim_rpc_grouped_usage.sql` — the only production change.
- NEW: `apps/web/tests/security/claim-rpc-performance-migration.test.ts` — static test (§1).
- NEW: `apps/worker/tests/claim-rpc/` (`fixtures.sql`, `parity.ts`, `scale.ts`, `README.md`, minimal migration runner if the harness's cannot be imported from this branch) — parity + scale rig (§2–§3).
- INCLUDE: `specs/138-claim-rpc-performance/` (this package) in the PR, per repo doc-sync rules.
- Do NOT touch: `apps/worker/src/**`, `packages/contracts/**`, any existing migration, `destination_claim_limits` contents, any other RPC, `apps/web/**` beyond the one new test file, spec 121/122 files (122's update is its own branch's work).

## Local verification gates

- [ ] Parity suite passes against the **pre-fix** function (documents current behaviour) and against the fixed function; scale test fails pre-fix (old timing recorded) and passes post-fix (< 5 s)
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` evidence for both grouped passes captured (§4); contingency index invoked only if the evidence demands it
- [ ] `pnpm --filter @fbuploadpro/contracts build` (baseline sanity — contracts untouched), worker build + lint + typecheck + test green (baseline unchanged: no worker source edits), web tests for `apps/web/tests/security/` green incl. the new static test
- [ ] `bash .github/scripts/regression-guardrails.sh` passes
- [ ] `git diff --stat` — only owned files; no secrets; no edits to existing migrations

## PR + CI process

- Branch `fix/138-claim-rpc-performance` from fresh `main` (see Sequencing for the base-commit note).
- Single push after local green; `gh pr create` titled `fix(138): claim RPC grouped-usage rewrite (D5 deferral/headroom performance)` with: the line-by-line body-diff accounting (§Approach 3), parity-suite results (pre- and post-fix), scale-test result with measured duration, `EXPLAIN` evidence, the index decision + whether the contingency was invoked, the diff-size note, and the merge-order note (this PR merges before spec 122's PR).
- Monitor `gh pr checks <number>` until green; fix locally, re-verify, re-push. Never check CI via the browser.
- Verification-gate agent reviews before Shahzeb's merge decision (parity contract §1–§8 is its checklist). Never merge without his explicit approval.
- Post-merge: verify the Supabase check-run on `main` applied the migration cleanly (`.agents/AGENTS.md` gate), then trigger the certification hand-off (tasks.md T13).
