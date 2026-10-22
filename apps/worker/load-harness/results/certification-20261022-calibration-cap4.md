# Load certification — calibration run (20261022)

Spec 122 T7 / spec 119 §5.2 / D11. Real claimer + consumers + RPCs against
real PostgreSQL (all repo migrations); mock publishers for all six
platforms; in-memory queue shim modelling wrangler.toml delivery.

## Headline

| Metric | Value |
|---|---|
| Seeded items | 50000 |
| Drain wall-clock | 523.7 s |
| Blended drain rate | 95.48 items/s |
| Items/day at run concurrency (fast 20 / heavy 10) | 8,249,628 |
| Items/day at wrangler concurrency (fast 20 / heavy 10) | 8,249,628 |
| Claim ticks | 1445 |
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

## Claim-tick durations by backlog depth (ms)

| Band | n | p50 | p95 | max |
|---|---|---|---|---|
| ~100% (1M) | 1 | 113017 | 113017 | 113017 |
| ~75% | 10 | 802 | 9454 | 9454 |
| ~50% | 134 | 167 | 733 | 1478 |
| ~25% | 511 | 56 | 229 | 936 |
| ~10% | 789 | 11 | 57 | 173 |

All ticks: n=1445 p50=32 p95=226 max=113017.
Criterion: p95 < 30,000 ms at every depth.

Full machine-readable results: `certification-20261022-calibration.json`.
