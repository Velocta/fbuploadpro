/**
 * Spec 122 load-proof certification runner (T7, spec 119 §5.2 / D11).
 *
 * Drives the REAL pipeline — runClaimTick (claimer.ts) → QueueShim →
 * handleQueueBatch (consumers.ts) → mock publishers → settle RPC — against
 * a real PostgreSQL database with all repo migrations applied, until the
 * seeded backlog drains, then writes the certification results file.
 *
 * Usage:
 *   LOAD_PG_URL=postgres://postgres@/loadharness?host=/path/to/pgsocket \
 *     pnpm --filter @fbuploadpro/worker exec tsx load-harness/certify.ts \
 *       --scale 0.05            # calibration (~50k items)
 *       --scale 1               # full 1,000,000-item certification
 *       --concurrency-scale 1   # 1 = wrangler.toml concurrency (default)
 *       --label full            # results file label
 *
 * Claim ticks are sampled at backlog depths of ~100% / 75% / 50% / 25% /
 * 10% remaining: the first tick whose pre-tick remaining count falls in
 * each band contributes its duration sample set for that band.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublisherRegistry, type Platform } from '@fbuploadpro/contracts';
import { runClaimTick, CLAIM_ROUND_LIMIT, CLAIM_MAX_PER_DESTINATION, MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK } from '../src/claimer.js';
import { PgPipelineDb } from './pg-adapter.js';
import { IdempotencyLedger, MockPublisher, FAST_LATENCY_MS, HEAVY_LATENCY_MS } from './mocks.js';
import { QueueShim, WRANGLER_CONFIG, type ShimConfig } from './queue-shim.js';
import { seed, scaledPlan, HARNESS_MASTER_KEY } from './seed.js';

const PLATFORMS: Platform[] = ['facebook', 'instagram', 'threads', 'youtube', 'x', 'tiktok'];
const here = dirname(fileURLToPath(import.meta.url));

interface TickSample {
  remainingBefore: number;
  durationMs: number;
  claimed: number;
}

function arg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? (process.argv[idx + 1] ?? fallback) : fallback;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? 0;
}

function stats(samples: number[]): { n: number; p50: number; p95: number; max: number } {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

async function remaining(db: PgPipelineDb): Promise<number> {
  const res = await db.pool.query(
    "SELECT count(*)::int AS n FROM public.queue_items WHERE status IN ('queued', 'publishing')"
  );
  return (res.rows[0] as { n: number }).n;
}

async function census(db: PgPipelineDb): Promise<Array<{ status: string; n: number }>> {
  const res = await db.pool.query(
    'SELECT status, count(*)::int AS n FROM public.queue_items GROUP BY status ORDER BY status'
  );
  return res.rows as Array<{ status: string; n: number }>;
}

async function perPlatformCounts(
  db: PgPipelineDb
): Promise<Array<{ platform: string; status: string; n: number }>> {
  const res = await db.pool.query(
    'SELECT platform::text AS platform, status, count(*)::int AS n FROM public.queue_items GROUP BY platform, status ORDER BY platform, status'
  );
  return res.rows as Array<{ platform: string; status: string; n: number }>;
}

async function main(): Promise<void> {
  const scale = Number(arg('scale', '1'));
  const concurrencyScale = Number(arg('concurrency-scale', '1'));
  const label = arg('label', scale >= 1 ? 'full' : 'calibration');
  const url = process.env.LOAD_PG_URL;
  if (!url) throw new Error('LOAD_PG_URL is required');

  const plan = scaledPlan(scale);
  const totalPlanned = plan.reduce((s, p) => s + p.items, 0);

  const config: ShimConfig = {
    fast: {
      ...WRANGLER_CONFIG.fast,
      concurrency: Math.round(WRANGLER_CONFIG.fast.concurrency * concurrencyScale),
    },
    heavy: {
      ...WRANGLER_CONFIG.heavy,
      concurrency: Math.round(WRANGLER_CONFIG.heavy.concurrency * concurrencyScale),
    },
    dlqConcurrency: WRANGLER_CONFIG.dlqConcurrency,
    dlqBatchSize: WRANGLER_CONFIG.dlqBatchSize,
  };

  console.log(`[certify] scale=${scale} items=${totalPlanned} concurrency fast=${config.fast.concurrency} heavy=${config.heavy.concurrency}`);
  const db = new PgPipelineDb(url);
  // Production topology: the claimer is a separate scheduled invocation
  // with its own DB connections — it does not share a connection pool
  // with the queue consumers. Mirror that here: a dedicated small pool
  // for claim ticks (a shared pool let 30 consumer workers queue ahead
  // of claim RPCs and inflated tick durations several-fold).
  const claimerDb = new PgPipelineDb(url, 4);

  const seedStart = Date.now();
  const { totalItems } = await seed(db.pool, plan);
  const seedSeconds = (Date.now() - seedStart) / 1000;
  console.log(`[certify] seeded ${totalItems} items in ${seedSeconds.toFixed(1)}s`);

  // A production backlog accumulates on a maintained table; a just-seeded
  // one still owes autovacuum/analyze work that would distort the first
  // ticks (observed: a 5-minute first claim on the cold table vs 1.1 s
  // warm). Settle the table before the drain starts.
  const vacuumStart = Date.now();
  await db.pool.query('VACUUM ANALYZE public.queue_items');
  await db.pool.query('VACUUM ANALYZE public.destinations');
  await db.pool.query('VACUUM ANALYZE public.social_accounts');
  await db.pool.query('VACUUM ANALYZE public.publish_logs');
  console.log(
    `[certify] post-seed VACUUM ANALYZE done in ${((Date.now() - vacuumStart) / 1000).toFixed(1)}s`
  );

  const ledger = new IdempotencyLedger();
  const registry = createPublisherRegistry();
  for (const platform of PLATFORMS) {
    registry.register(new MockPublisher(platform, ledger));
  }

  const shim = new QueueShim(config, { db, registry, masterKey: HARNESS_MASTER_KEY, env: {} });
  shim.start();

  // Tick sampling bands by fraction of the seeded backlog remaining.
  const bands: Array<{ name: string; maxFrac: number; minFrac: number; samples: number[] }> = [
    { name: '~100% (1M)', maxFrac: 1.01, minFrac: 0.9, samples: [] },
    { name: '~75%', maxFrac: 0.9, minFrac: 0.65, samples: [] },
    { name: '~50%', maxFrac: 0.65, minFrac: 0.4, samples: [] },
    { name: '~25%', maxFrac: 0.4, minFrac: 0.18, samples: [] },
    { name: '~10%', maxFrac: 0.18, minFrac: 0.0, samples: [] },
  ];
  const allTickSamples: TickSample[] = [];

  const drainStart = Date.now();
  // Throughput-curve snapshots: settled count sampled every ~15 s.
  const snapshots: Array<{ elapsedSeconds: number; settled: number; remaining: number }> = [];
  let lastSnapshotAt = 0;
  let totalClaimed = 0;
  let ticks = 0;
  // Non-recovery minutes for most ticks; every ~5th tick exercises the
  // recovery sweep cadence too (minute % 5 === 0), like production.
  let tickMinute = 1;

  for (;;) {
    const remainingBefore = await remaining(db);
    if (remainingBefore === 0 && shim.pending() === 0) break;
    if (ticks > 100_000) throw new Error('drain did not converge (tick cap)');

    const elapsedNow = (Date.now() - drainStart) / 1000;
    if (elapsedNow - lastSnapshotAt >= 15) {
      lastSnapshotAt = elapsedNow;
      snapshots.push({
        elapsedSeconds: Math.round(elapsedNow),
        settled: totalItems - remainingBefore,
        remaining: remainingBefore,
      });
    }

    // Pace claiming: only tick when the queues hold less than ~20k
    // undelivered messages (production queues absorb the burst the same
    // way; this keeps tick samples spread across the whole drain).
    if (remainingBefore > 0 && shim.pending() < 20_000) {
      const now = new Date();
      now.setMinutes(tickMinute % 60, 0, 0);
      tickMinute += 1;
      const t0 = Date.now();
      const result = await runClaimTick({
        db: claimerDb,
        registry,
        queues: { fast: shim.fastProducer, heavy: shim.heavyProducer },
        env: {},
        now,
      });
      const durationMs = Date.now() - t0;
      ticks += 1;
      totalClaimed += result.claimed;
      allTickSamples.push({ remainingBefore, durationMs, claimed: result.claimed });
      const frac = remainingBefore / totalItems;
      for (const band of bands) {
        if (frac <= band.maxFrac && frac > band.minFrac) band.samples.push(durationMs);
      }
      if (ticks % 10 === 0 || result.claimed > 0) {
        console.log(
          `[certify] tick ${ticks}: remaining=${remainingBefore} claimed=${result.claimed} tickMs=${durationMs} shimPending=${shim.pending()}`
        );
      }
    }

    // Let consumers work briefly between ticks (production cadence is 1
    // tick/minute; the harness compresses the wait, it does not change
    // per-tick work).
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  // Wait for in-flight batches to finish settling.
  for (let i = 0; i < 600 && shim.pending() > 0; i++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await shim.stop();
  const drainSeconds = (Date.now() - drainStart) / 1000;

  const finalCensus = await census(db);
  const perPlatform = await perPlatformCounts(db);
  const logsRes = await db.pool.query(
    'SELECT result, count(*)::int AS n FROM public.publish_logs GROUP BY result ORDER BY result'
  );
  const censusTotal = finalCensus.reduce((s, r) => s + r.n, 0);
  const publishedCount = finalCensus.find((r) => r.status === 'published')?.n ?? 0;
  const failedCount = finalCensus.find((r) => r.status === 'failed')?.n ?? 0;
  const lost = totalItems - censusTotal;
  const accountedTerminal = publishedCount + failedCount;
  const duplicates = ledger.duplicates();

  // Derived capacity at the WRANGLER-configured concurrency: the shim's
  // worker-seconds are not directly observable per lane, so derive from the
  // run itself when concurrencyScale === 1 (direct measurement), else scale
  // the blended rate by the concurrency ratio of the bottleneck-preserving
  // worker counts and state the method in the results file.
  const blendedRate = totalItems / drainSeconds;
  const itemsPerDayAtRunConcurrency = blendedRate * 86_400;
  const itemsPerDayAtWranglerConcurrency =
    concurrencyScale === 1 ? itemsPerDayAtRunConcurrency : blendedRate * 86_400 * (1 / concurrencyScale);

  const tickStatsAll = stats(allTickSamples.map((s) => s.durationMs));
  const results = {
    spec: '122 load-proof harness (spec 119 §5.2 / D11)',
    label,
    generatedAt: new Date().toISOString(),
    scale,
    seedPlan: plan,
    seeded: totalItems,
    seedSeconds: Number(seedSeconds.toFixed(2)),
    drainSeconds: Number(drainSeconds.toFixed(2)),
    ticks,
    totalClaimed,
    enqueuedFast: shim.enqueuedFast,
    enqueuedHeavy: shim.enqueuedHeavy,
    deliveredBatches: shim.deliveredBatches,
    messageRetries: shim.messageRetries,
    dlqArrivals: shim.dlqArrivals,
    finalCensus,
    perPlatform,
    publishLogsByResult: logsRes.rows,
    settledPublished: publishedCount,
    settledFailed: failedCount,
    retriedThenPublished: ledger.retriedThenPublished(),
    mockLedger: {
      itemsSeen: ledger.size,
      totalAttempts: ledger.totalAttempts(),
      totalSuccesses: ledger.totalSuccesses(),
    },
    lost,
    accountedTerminal,
    duplicates: duplicates.length,
    duplicateItems: duplicates.slice(0, 20),
    blendedItemsPerSecond: Number(blendedRate.toFixed(2)),
    itemsPerDayAtRunConcurrency: Math.round(itemsPerDayAtRunConcurrency),
    concurrencyUsed: { fast: config.fast.concurrency, heavy: config.heavy.concurrency },
    wranglerConcurrency: {
      fast: WRANGLER_CONFIG.fast.concurrency,
      heavy: WRANGLER_CONFIG.heavy.concurrency,
    },
    itemsPerDayAtWranglerConcurrency: Math.round(itemsPerDayAtWranglerConcurrency),
    claimTick: {
      all: tickStatsAll,
      bands: bands.map((b) => ({ band: b.name, ...stats(b.samples) })),
      claimerConstants: {
        CLAIM_ROUND_LIMIT,
        CLAIM_MAX_PER_DESTINATION,
        MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK,
      },
    },
    mockLatencyMs: { fast: FAST_LATENCY_MS, heavy: HEAVY_LATENCY_MS },
    throughputSnapshots: snapshots,
    successesByPlatformLane: Object.fromEntries(ledger.successesByPlatformLane),
    tuning: {
      claimerConstants: {
        CLAIM_ROUND_LIMIT,
        CLAIM_MAX_PER_DESTINATION,
        MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK,
        note: 'MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK tuned 4 → 1 on this branch (see claimer.ts comment + results md). CLAIM_ROUND_LIMIT and CLAIM_MAX_PER_DESTINATION unchanged from main.',
      },
      harnessDbConfig:
        'pgserver PostgreSQL, ALTER SYSTEM: shared_buffers=1GB, effective_cache_size=3GB, work_mem=64MB, random_page_cost=1.1, synchronous_commit=off, max_wal_size=4GB, checkpoint_timeout=15min, checkpoint_completion_target=0.9. synchronous_commit/checkpoint settings are bulk-run settings for a disposable synthetic database (durability is irrelevant — the seed is reproducible); they are NOT production recommendations. Adapter sessions SET work_mem=64MB.',
      pacing: 'Claim ticks run only while shim pending < 20,000 messages.',
    },
  };

  const resultsDir = join(here, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const base = `certification-${stamp}-${label}`;
  writeFileSync(join(resultsDir, `${base}.json`), JSON.stringify(results, null, 2));

  const bandRows = results.claimTick.bands
    .map((b) => `| ${b.band} | ${b.n} | ${b.p50} | ${b.p95} | ${b.max} |`)
    .join('\n');
  const censusRows = finalCensus.map((r) => `| ${r.status} | ${r.n} |`).join('\n');
  const md = `# Load certification — ${label} run (${stamp})

Spec 122 T7 / spec 119 §5.2 / D11. Real claimer + consumers + RPCs against
real PostgreSQL (all repo migrations); mock publishers for all six
platforms; in-memory queue shim modelling wrangler.toml delivery.

## Headline

| Metric | Value |
|---|---|
| Seeded items | ${totalItems} |
| Drain wall-clock | ${drainSeconds.toFixed(1)} s |
| Blended drain rate | ${blendedRate.toFixed(2)} items/s |
| Items/day at run concurrency (fast ${config.fast.concurrency} / heavy ${config.heavy.concurrency}) | ${Math.round(itemsPerDayAtRunConcurrency).toLocaleString('en-US')} |
| Items/day at wrangler concurrency (fast 20 / heavy 10) | ${Math.round(itemsPerDayAtWranglerConcurrency).toLocaleString('en-US')} |
| Claim ticks | ${ticks} |
| Total claimed (incl. re-claims after retry) | ${totalClaimed} |
| Enqueued fast / heavy | ${shim.enqueuedFast} / ${shim.enqueuedHeavy} |
| Settled published | ${publishedCount} |
| Settled failed | ${failedCount} |
| Retried then published | ${ledger.retriedThenPublished()} |
| Queue message retries (un-acked) | ${shim.messageRetries} |
| DLQ arrivals | ${shim.dlqArrivals} |
| **Lost items** | **${lost}** |
| **Duplicate publishes (mock ledger)** | **${duplicates.length}** |

## Final queue_items census

| Status | Count |
|---|---|
${censusRows}

## Tuning recorded on this branch

- \`MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK\`: **4 → 1** (claimer.ts).
  Evidence: one unified claim RPC measured at 1.1–1.6 s at a 1M-item
  backlog on the harness DB (three scan passes in the D5-amended RPC;
  cost is independent of the round limit — limit 100 vs 500 measured the
  same). Six registered platforms × 2 lanes × 4 rounds = up to 48
  sequential RPCs ≈ 55–75 s/tick, over the 30 s criterion. At cap 1 a
  tick is ≤ 12 RPCs and claim capacity is still 6,000 items/tick
  (~8.6M/day at the 1-minute cadence), far above consumer drain.
  \`CLAIM_ROUND_LIMIT\` (500) and \`CLAIM_MAX_PER_DESTINATION\` (3)
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
${bandRows}

All ticks: n=${tickStatsAll.n} p50=${tickStatsAll.p50} p95=${tickStatsAll.p95} max=${tickStatsAll.max}.
Criterion: p95 < 30,000 ms at every depth.

Full machine-readable results: \`${base}.json\`.
`;
  writeFileSync(join(resultsDir, `${base}.md`), md);
  console.log(`[certify] done. drained=${totalItems} in ${drainSeconds.toFixed(1)}s lost=${lost} duplicates=${duplicates.length}`);
  console.log(`[certify] results: load-harness/results/${base}.md (+ .json)`);
  await claimerDb.end();
  await db.end();
}

main().catch((err: unknown) => {
  console.error('[certify] FAILED:', err);
  process.exit(1);
});
