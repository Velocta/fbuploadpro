# Load certification — full run (20261022)

Spec 122 T7 / spec 119 §5.2 / D11. Real claimer + consumers + RPCs against
real PostgreSQL (all repo migrations); mock publishers for all six
platforms; in-memory queue shim modelling wrangler.toml delivery.

## Headline

| Metric | Value |
|---|---|
| Seeded items | 1000000 |
| Drain wall-clock | 6425.6 s |
| Blended drain rate | 155.63 items/s |
| Items/day at run concurrency (fast 20 / heavy 10) | 13,446,209 |
| Items/day at wrangler concurrency (fast 20 / heavy 10) | 13,446,209 |
| Claim ticks | 813 |
| Total claimed (incl. re-claims after retry) | 1020180 |
| Enqueued fast / heavy | 612130 / 408050 |
| Settled published | 989949 |
| Settled failed | 10051 |
| Retried then published | 20180 |
| Queue message retries (un-acked) | 0 |
| DLQ arrivals | 0 |
| **Lost items** | **0** |
| **Duplicate publishes (mock ledger)** | **0** |

## Final queue_items census

| Status | Count |
|---|---|
| failed | 10051 |
| published | 989949 |

## Tuning recorded on this branch

- `MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK`: **4 → 1** (claimer.ts).
  Evidence: one unified claim RPC measured at 1.1–1.6 s at a 1M-item
  backlog on the harness DB (three scan passes in the D5-amended RPC;
  cost is independent of the round limit — limit 100 vs 500 measured the
  same). Six registered platforms × 2 lanes × 4 rounds = up to 48
  sequential RPCs ≈ 55–75 s/tick, over the 30 s criterion. At cap 1 a
  tick is ≤ 12 RPCs and claim capacity is still 6,000 items/tick
  (~8.6M/day at the 1-minute cadence), far above consumer drain.
  `CLAIM_ROUND_LIMIT` (500) and `CLAIM_MAX_PER_DESTINATION` (3)
  unchanged. wrangler.toml consumer batch/concurrency unchanged.
- Harness DB sizing (local environment only): shared_buffers 1GB,
  effective_cache_size 3GB, work_mem 64MB, random_page_cost 1.1,
  synchronous_commit=off, max_wal_size 4GB, checkpoint_timeout 15min
  (bulk-run settings for a disposable synthetic DB; an earlier run
  without them saw claim ticks inflate to 50–110 s under checkpoint /
  fsync pressure on this 2-vCPU VM — that run was aborted and is not
  the certification run).

## Claim-tick durations by backlog depth (ms)

| Band | n | p50 | p95 | max |
|---|---|---|---|---|
| ~100% (1M) | 21 | 6773 | 7508 | 7536 |
| ~75% | 42 | 6856 | 8090 | 8335 |
| ~50% | 51 | 4784 | 6335 | 7011 |
| ~25% | 80 | 2696 | 4133 | 4709 |
| ~10% | 619 | 84 | 1433 | 2184 |

All ticks: n=813 p50=205 p95=6736 max=8335.
Criterion: p95 < 30,000 ms at every depth.

Full machine-readable results: `certification-20261022-full.json`.
