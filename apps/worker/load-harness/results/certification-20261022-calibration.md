# Load certification — calibration run (20261022)

Spec 122 T7 / spec 119 §5.2 / D11. Real claimer + consumers + RPCs against
real PostgreSQL (all repo migrations); mock publishers for all six
platforms; in-memory queue shim modelling wrangler.toml delivery.

## Headline

| Metric | Value |
|---|---|
| Seeded items | 50000 |
| Drain wall-clock | 474.3 s |
| Blended drain rate | 105.43 items/s |
| Items/day at run concurrency (fast 20 / heavy 10) | 9,109,043 |
| Items/day at wrangler concurrency (fast 20 / heavy 10) | 9,109,043 |
| Claim ticks | 1274 |
| Total claimed (incl. re-claims after retry) | 50975 |
| Enqueued fast / heavy | 30553 / 20422 |
| Settled published | 49451 |
| Settled failed | 549 |
| Retried then published | 975 |
| Queue message retries (un-acked) | 0 |
| DLQ arrivals | 0 |
| **Lost items** | **0** |
| **Duplicate publishes (mock ledger)** | **0** |

## Final queue_items census

| Status | Count |
|---|---|
| failed | 549 |
| published | 49451 |

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
  effective_cache_size 3GB, work_mem 64MB, random_page_cost 1.1.

## Claim-tick durations by backlog depth (ms)

| Band | n | p50 | p95 | max |
|---|---|---|---|---|
| ~100% (1M) | 3 | 9852 | 13738 | 13738 |
| ~75% | 5 | 1373 | 1982 | 1982 |
| ~50% | 12 | 337 | 1085 | 1085 |
| ~25% | 451 | 65 | 176 | 372 |
| ~10% | 803 | 11 | 82 | 254 |

All ticks: n=1274 p50=24 p95=150 max=13738.
Criterion: p95 < 30,000 ms at every depth.

Full machine-readable results: `certification-20261022-calibration.json`.
