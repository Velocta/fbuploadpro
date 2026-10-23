/**
 * Spec 139 retention rig (real PostgreSQL, SQL level).
 *
 * Proves the behaviour of
 * supabase/migrations/20261024120000_retention_cleanup.sql:
 *
 *   - public.cleanup_expired_publish_history(p_cutoff, p_batch_size,
 *     p_dry_run) deletes ONLY expired history:
 *       publish_logs rows older than the cutoff whose parent queue
 *       item is TERMINAL (published / failed / cancelled), and
 *       terminal queue_items whose updated_at is older than the
 *       cutoff. Live rows (queued / publishing) are NEVER deleted, at
 *       any age — and neither are their logs.
 *   - the two supporting indexes exist
 *     (idx_publish_logs_created_at; the partial
 *     idx_queue_items_terminal_updated_at) and the items-selection
 *     shape is planned through the partial index;
 *   - EXECUTE is granted to service_role only (the spec 117 pattern):
 *     PUBLIC / anon / authenticated are denied, proven in the catalog
 *     AND with a live 42501 probe as `authenticated`;
 *   - dry-run returns the full would-delete counts and deletes nothing;
 *   - the batch limit is honoured per call, and repeated calls drain
 *     the backlog exactly (idempotent: a drained run returns 0/0);
 *   - the migration is idempotent (re-applying the file exits clean
 *     and the function keeps working).
 *
 * Fixtures (fixtures.sql, applied by this runner): seven curated queue
 * items + six publish_logs around the 30-day cutoff — see the fixture
 * header for the case table and the expected counts.
 *
 * Usage:
 *   RETENTION_RPC_PG_URL=postgres://postgres@/retentionrig?host=<socket dir>&port=<port> \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/retention-rpc/check.ts
 * (database must already have bootstrap + migrations applied — see
 * README.md; fixtures.sql from this directory is applied by the runner.)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', '..', '..', '..', 'supabase', 'migrations');
const MIGRATION_FILE = '20261024120000_retention_cleanup.sql';

const ITEM_PUBLISHED_OLD = 'c101c101-c101-c101-c101-c101c101c101';
const ITEM_FAILED_OLD = 'c102c102-c102-c102-c102-c102c102c102';
const ITEM_CANCELLED_OLD = 'c103c103-c103-c103-c103-c103c103c103';
const ITEM_PUBLISHED_RECENT = 'c104c104-c104-c104-c104-c104c104c104';
const ITEM_PUBLISHED_EDGE = 'c105c105-c105-c105-c105-c105c105c105';
const ITEM_QUEUED_OLD = 'c106c106-c106-c106-c106-c106c106c106';
const ITEM_PUBLISHING_OLD = 'c107c107-c107-c107-c107-c107c107c107';

const LOG_OLD_ON_OLD_ITEM = 'd101d101-d101-d101-d101-d101d101d101';
const LOG_OLD_ON_RECENT_ITEM = 'd102d102-d102-d102-d102-d102d102d102';
const LOG_YOUNG_ON_RECENT_ITEM = 'd103d103-d103-d103-d103-d103d103d103';
const LOG_OLD_ON_QUEUED_ITEM = 'd104d104-d104-d104-d104-d104d104d104';
const LOG_OLD_ON_PUBLISHING_ITEM = 'd105d105-d105-d105-d105-d105d105d105';
const LOG_YOUNG_ON_OLD_ITEM = 'd106d106-d106-d106-d106-d106d106d106';

let checks = 0;
let failures = 0;

function check(cond: boolean, label: string, detail?: string): void {
  checks += 1;
  if (cond) {
    console.log(`  ok: ${label}`);
  } else {
    failures += 1;
    const suffix = detail ? ' (' + detail + ')' : '';
    console.error(`  FAIL: ${label}${suffix}`);
  }
}

interface CleanupCounts {
  logs: number;
  items: number;
}

async function callCleanup(
  client: PoolClient | Pool,
  batchSize: number,
  dryRun: boolean
): Promise<CleanupCounts> {
  const { rows } = await client.query(
    `SELECT publish_logs_deleted, queue_items_deleted
       FROM public.cleanup_expired_publish_history(now() - INTERVAL '30 days', $1, $2)`,
    [batchSize, dryRun]
  );
  const row = rows[0] as { publish_logs_deleted: string; queue_items_deleted: string };
  return { logs: Number(row.publish_logs_deleted), items: Number(row.queue_items_deleted) };
}

async function reset(client: PoolClient | Pool): Promise<void> {
  await client.query('SELECT public.retention_reset()');
}

async function remainingIds(
  client: PoolClient | Pool,
  table: 'queue_items' | 'publish_logs'
): Promise<string[]> {
  const { rows } = await client.query(`SELECT id FROM public.${table} ORDER BY id`);
  return rows.map((r) => (r as { id: string }).id);
}

async function main(): Promise<void> {
  const url = process.env.RETENTION_RPC_PG_URL;
  if (!url) throw new Error('RETENTION_RPC_PG_URL is required');
  const pool = new Pool({ connectionString: url });
  try {
    const fixtures = readFileSync(join(here, 'fixtures.sql'), 'utf8');
    await pool.query(fixtures);
    console.log('[retention-rpc] fixtures applied');

    // ------------------------------------------------------------------
    console.log('(a) function + ACL posture');
    {
      const { rows } = await pool.query(
        `SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'cleanup_expired_publish_history'`
      );
      check(rows.length === 1, 'cleanup_expired_publish_history exists');

      const sig = 'public.cleanup_expired_publish_history(timestamp with time zone, integer, boolean)';
      for (const role of ['service_role'] as const) {
        const { rows: r } = await pool.query('SELECT has_function_privilege($1, $2, $3) AS ok', [
          role,
          sig,
          'EXECUTE',
        ]);
        check((r[0] as { ok: boolean }).ok === true, `${role} HAS execute`);
      }
      for (const role of ['anon', 'authenticated'] as const) {
        const { rows: r } = await pool.query('SELECT has_function_privilege($1, $2, $3) AS ok', [
          role,
          sig,
          'EXECUTE',
        ]);
        check((r[0] as { ok: boolean }).ok === false, `${role} has NO execute`);
      }

      // Live probe: calling as `authenticated` must meet 42501.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE authenticated');
        let code: string | undefined;
        try {
          await client.query(
            "SELECT * FROM public.cleanup_expired_publish_history(now(), 1, true)"
          );
        } catch (err) {
          code = (err as { code?: string }).code;
        }
        check(code === '42501', 'live call as authenticated is denied (42501)', `got ${code}`);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }

    // ------------------------------------------------------------------
    console.log('(b) indexes');
    {
      const { rows } = await pool.query(
        `SELECT indexname, indexdef FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN ('idx_publish_logs_created_at', 'idx_queue_items_terminal_updated_at')`
      );
      const byName = new Map(rows.map((r) => [(r as { indexname: string }).indexname, (r as { indexdef: string }).indexdef]));
      const logsDef = byName.get('idx_publish_logs_created_at');
      check(typeof logsDef === 'string' && logsDef.includes('(created_at)'), 'idx_publish_logs_created_at on publish_logs (created_at)', logsDef);
      const itemsDef = byName.get('idx_queue_items_terminal_updated_at');
      check(
        typeof itemsDef === 'string' &&
          itemsDef.includes('(updated_at)') &&
          itemsDef.includes('published') &&
          itemsDef.includes('cancelled'),
        'idx_queue_items_terminal_updated_at is a partial index on queue_items (updated_at) over the terminal statuses',
        itemsDef
      );
    }

    // ------------------------------------------------------------------
    console.log('(c) dry-run counts and deletes nothing');
    {
      await reset(pool);
      const counts = await callCleanup(pool, 1000, true);
      check(counts.logs === 2, 'dry-run would delete 2 publish_logs', `got ${counts.logs}`);
      check(counts.items === 3, 'dry-run would delete 3 queue_items', `got ${counts.items}`);
      check((await remainingIds(pool, 'queue_items')).length === 7, 'dry-run left all 7 items in place');
      check((await remainingIds(pool, 'publish_logs')).length === 6, 'dry-run left all 6 logs in place');
    }

    // ------------------------------------------------------------------
    console.log('(d) full run deletes exactly the expired terminal history');
    {
      const counts = await callCleanup(pool, 1000, false);
      check(counts.logs === 2, 'run deleted 2 publish_logs', `got ${counts.logs}`);
      check(counts.items === 3, 'run deleted 3 queue_items', `got ${counts.items}`);

      const items = await remainingIds(pool, 'queue_items');
      check(
        JSON.stringify(items) ===
          JSON.stringify([ITEM_PUBLISHED_RECENT, ITEM_PUBLISHED_EDGE, ITEM_QUEUED_OLD, ITEM_PUBLISHING_OLD].sort()),
        'surviving items: recent + edge terminal, and BOTH live items untouched',
        items.join(',')
      );
      check(!items.includes(ITEM_PUBLISHED_OLD) && !items.includes(ITEM_FAILED_OLD) && !items.includes(ITEM_CANCELLED_OLD), 'all three old terminal items deleted');

      const logs = await remainingIds(pool, 'publish_logs');
      check(
        JSON.stringify(logs) ===
          JSON.stringify([LOG_YOUNG_ON_RECENT_ITEM, LOG_OLD_ON_QUEUED_ITEM, LOG_OLD_ON_PUBLISHING_ITEM].sort()),
        'surviving logs: the young log + BOTH logs of live items untouched',
        logs.join(',')
      );
      check(!logs.includes(LOG_OLD_ON_OLD_ITEM) && !logs.includes(LOG_OLD_ON_RECENT_ITEM), 'old logs of terminal items deleted (incl. the recent item’s old log)');
      check(!logs.includes(LOG_YOUNG_ON_OLD_ITEM), 'young log of a deleted item removed by cascade');
    }

    // ------------------------------------------------------------------
    console.log('(e) idempotency: a drained run returns 0/0');
    {
      const counts = await callCleanup(pool, 1000, false);
      check(counts.logs === 0 && counts.items === 0, 'second run deletes nothing', JSON.stringify(counts));
      check((await remainingIds(pool, 'queue_items')).length === 4, 'item count stable after re-run');
      check((await remainingIds(pool, 'publish_logs')).length === 3, 'log count stable after re-run');
    }

    // ------------------------------------------------------------------
    console.log('(f) batch limit honoured per call; repeated calls drain exactly');
    {
      await reset(pool);
      const seq: CleanupCounts[] = [];
      for (let i = 0; i < 4; i++) seq.push(await callCleanup(pool, 1, false));
      check(seq[0]?.logs === 1 && seq[0]?.items === 1, 'batch=1 call 1 returns (1,1)', JSON.stringify(seq[0]));
      check(seq[1]?.logs === 1 && seq[1]?.items === 1, 'batch=1 call 2 returns (1,1)', JSON.stringify(seq[1]));
      check(seq[2]?.logs === 0 && seq[2]?.items === 1, 'batch=1 call 3 returns (0,1) — logs exhausted first', JSON.stringify(seq[2]));
      check(seq[3]?.logs === 0 && seq[3]?.items === 0, 'batch=1 call 4 returns (0,0) — drained', JSON.stringify(seq[3]));
      const items = await remainingIds(pool, 'queue_items');
      check(items.length === 4 && items.includes(ITEM_QUEUED_OLD) && items.includes(ITEM_PUBLISHING_OLD), 'batch drain ends at the same survivor set as the full run');
      const logs = await remainingIds(pool, 'publish_logs');
      check(logs.length === 3 && logs.includes(LOG_OLD_ON_QUEUED_ITEM) && logs.includes(LOG_OLD_ON_PUBLISHING_ITEM), 'live items’ logs survive the batch drain');
    }

    // ------------------------------------------------------------------
    console.log('(g) EXPLAIN: items-selection shape uses the partial terminal index');
    {
      await reset(pool);
      await pool.query('SELECT public.retention_seed_bulk()');
      const client = await pool.connect();
      try {
        await client.query('SET enable_seqscan = off');
        const { rows } = await client.query(
          `EXPLAIN (FORMAT JSON)
             SELECT qi.id FROM public.queue_items qi
              WHERE qi.status IN ('published', 'failed', 'cancelled')
                AND qi.updated_at < now() - INTERVAL '30 days'
              ORDER BY qi.updated_at
              LIMIT 1000`
        );
        const plan = JSON.stringify(rows);
        check(plan.includes('idx_queue_items_terminal_updated_at'), 'plan uses idx_queue_items_terminal_updated_at', plan.slice(0, 300));
      } finally {
        client.release();
      }
    }

    // ------------------------------------------------------------------
    console.log('(h) migration idempotency');
    {
      const sql = readFileSync(join(migrationsDir, MIGRATION_FILE), 'utf8');
      await pool.query(sql);
      check(true, 're-applying the migration exits clean');
      await reset(pool);
      const counts = await callCleanup(pool, 1000, true);
      check(counts.logs === 2 && counts.items === 3, 'function still correct after re-apply', JSON.stringify(counts));
    }
  } finally {
    await pool.end();
  }

  console.log(`[retention-rpc] ${checks} assertions, ${failures} failures`);
  if (failures > 0) process.exit(1);
}

try {
  await main();
} catch (err) {
  console.error('[retention-rpc] FAILED:', err);
  process.exit(1);
}
