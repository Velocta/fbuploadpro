/**
 * Spec 139 A15 follow-up — queue-slot collision rig (real PostgreSQL).
 *
 * A15 asked: in queue mode (no scheduledTime), each concurrent enqueue
 * chain computes the next vacant slot from the current queue state —
 * can two chains pick the same slot, and what does the DATABASE do on
 * collision? This rig answers both halves against the real schema
 * (bootstrap + every repo migration, in filename order), driving the
 * handler's exact algorithm: snapshot the page's queued times, compute
 * with the REAL calculateNextVacantSlot from the web app, insert.
 *
 * Two modes:
 *   vulnerable — database built with migrations up to
 *     20261023193000_db_hygiene.sql (pre-fix). Sections:
 *       (a) catalogue: NO unique constraint/index on legacy_queue_items
 *           covers (fb_page_id, scheduled_time) in any form — the only
 *           uniqueness is the PK and (user_id, id);
 *       (b) 8 barrier-synchronized concurrent chains (the bulk pool's
 *           concurrency cap, BULK_ENQUEUE_CONCURRENCY) run the pre-fix
 *           sequence against an empty queue: snapshot → compute →
 *           direct INSERT. Asserts every insert COMMITS and the rows
 *           collide — all 8 land on the one computed slot instance.
 *           The collision is SILENT: no error anywhere.
 *   hardened (default) — all migrations incl.
 *     20261024120000_a15_atomic_queue_slot_insert.sql. Sections:
 *       (a) catalogue unchanged: the fix deliberately adds NO unique
 *           index (see (e) for why);
 *       (c) claim_queue_slot_insert semantics: first claim of a free
 *           slot instance returns the inserted row; a second claim of
 *           the SAME instance returns no row and inserts nothing; a
 *           claim of a different free instance succeeds; EXECUTE is
 *           service_role-only and the function is SECURITY DEFINER;
 *       (d) the same 8-chain barrier race, but claiming through the
 *           RPC with the fixed handler's recompute-and-retry loop:
 *           all 8 succeed on 8 DISTINCT slot instances, and the race
 *           really happened (retry attempts were needed);
 *       (e) reorder guard: two queued rows swap scheduled_times via
 *           two sequential single-row UPDATEs — the spec 134 reorder
 *           protocol (parallel PATCHes permuting times) — and both
 *           succeed. This is why the fix is an atomic claim RPC and
 *           not a unique index: an immediate uniqueness over the time
 *           dimension would reject the first UPDATE of the swap.
 *
 * Usage:
 *   QUEUE_SLOT_PG_URL=postgres://postgres@/qslot?host=<socket dir>&port=<port> \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/queue-slot-collision/check.ts
 *   QUEUE_SLOT_MODE=vulnerable QUEUE_SLOT_PG_URL=...qslotpre... \
 *     pnpm --filter @fbuploadpro/worker exec tsx tests/queue-slot-collision/check.ts
 * (database must already have bootstrap + migrations applied and
 * fixtures.sql loaded — see README.md; the runner re-seeds per section
 * via qslot_reset().)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import { calculateNextVacantSlot } from '../../../web/src/lib/slot-scheduler';

const here = dirname(fileURLToPath(import.meta.url));

const USER_A = '11111111-1111-1111-1111-111111111111';
const PAGE_A = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

/** The bulk pool's bounded concurrency (bulk/route.ts, spec 139 A15). */
const CHAINS = 8;

const mode = process.env.QUEUE_SLOT_MODE === 'vulnerable' ? 'vulnerable' : 'hardened';
const hardened = mode === 'hardened';

let checks = 0;
let failures = 0;

function check(cond: boolean, label: string, detail?: string): void {
  checks += 1;
  if (cond) {
    console.log(`  ok: ${label}`);
  } else {
    failures += 1;
    const suffix = detail ? ` (${detail})` : '';
    console.error(`  FAIL: ${label}${suffix}`);
  }
}

interface SlotRow {
  id: string;
  slot_time: string;
  is_active: boolean;
  allowed_formats: string[] | null;
}

async function reset(pool: Pool): Promise<void> {
  await pool.query(readFileSync(join(here, 'fixtures.sql'), 'utf8'));
}

async function loadSlots(client: PoolClient | Pool): Promise<SlotRow[]> {
  const { rows } = await client.query(
    `SELECT id, slot_time, is_active, allowed_formats
     FROM public.page_queue_slots
     WHERE fb_page_id = $1 AND user_id = $2 AND is_active = true
     ORDER BY slot_time ASC`,
    [PAGE_A, USER_A]
  );
  return rows as SlotRow[];
}

function toSchedulerSlots(slots: SlotRow[]) {
  return slots.map((s) => ({
    id: s.id,
    slotTime: typeof s.slot_time === 'string' ? s.slot_time : String(s.slot_time),
    timezone: 'UTC',
    isActive: Boolean(s.is_active),
    allowedFormats: s.allowed_formats ?? null,
  }));
}

async function readQueuedTimes(client: PoolClient): Promise<Date[]> {
  const { rows } = await client.query(
    `SELECT scheduled_time FROM public.legacy_queue_items
     WHERE fb_page_id = $1 AND user_id = $2 AND status = 'queued'`,
    [PAGE_A, USER_A]
  );
  return rows.map((r: { scheduled_time: string }) => new Date(r.scheduled_time));
}

/** Releases all waiting chains at once once every chain has arrived. */
class Barrier {
  private release!: () => void;
  private readonly gate = new Promise<void>((resolve) => {
    this.release = resolve;
  });
  private arrived = 0;
  constructor(private readonly parties: number) {}
  async wait(): Promise<void> {
    this.arrived += 1;
    if (this.arrived === this.parties) this.release();
    await this.gate;
  }
}

const INSERT_SQL = `INSERT INTO public.legacy_queue_items (
    user_id, fb_page_id, slot_id, media_id, post_format, link_url,
    scheduled_time, caption, first_comment, status, retry_count, max_retries
  ) VALUES ($1, $2, $3, NULL, 'text', NULL, $4, 'rig post', NULL, 'queued', 0, 3)
  RETURNING id, scheduled_time`;

const CLAIM_SQL = `SELECT * FROM public.claim_queue_slot_insert(
    $1, $2, $3, NULL, 'text', NULL, $4, 'rig post', NULL)`;

async function sectionCatalogue(pool: Pool): Promise<void> {
  console.log('(a) catalogue — uniqueness on legacy_queue_items');
  const { rows: indexes } = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = 'legacy_queue_items'`
  );
  for (const ix of indexes) {
    console.log(`    index: ${ix.indexname}: ${ix.indexdef}`);
  }
  const uniqueCoveringTime = indexes.filter(
    (ix: { indexdef: string }) =>
      /UNIQUE/i.test(ix.indexdef) && ix.indexdef.includes('scheduled_time')
  );
  check(
    uniqueCoveringTime.length === 0,
    'no UNIQUE index covers scheduled_time on legacy_queue_items',
    uniqueCoveringTime.map((i: { indexname: string }) => i.indexname).join(',')
  );
  const { rows: constraints } = await pool.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.legacy_queue_items'::regclass AND contype = 'u'`
  );
  for (const c of constraints) {
    console.log(`    unique constraint: ${c.conname}: ${c.def}`);
  }
  check(
    constraints.every((c: { def: string }) => !c.def.includes('scheduled_time')),
    'no UNIQUE constraint covers scheduled_time on legacy_queue_items'
  );
}

async function sectionVulnerableRace(pool: Pool): Promise<void> {
  console.log(`(b) vulnerable race — ${CHAINS} concurrent chains, pre-fix sequence`);
  await reset(pool);
  const slots = toSchedulerSlots(await loadSlots(pool));
  const now = new Date();
  const barrier = new Barrier(CHAINS);
  let insertErrors = 0;

  const chain = async (): Promise<void> => {
    const client = await pool.connect();
    try {
      // The pre-fix handler sequence: snapshot, compute, insert — the
      // snapshot is taken BEFORE the barrier so every chain computes
      // from the same (empty) queue state, exactly the interleaving a
      // busy bulk/single burst produces.
      const snapshot = await readQueuedTimes(client);
      await barrier.wait();
      const computed = calculateNextVacantSlot({
        slots,
        existingScheduledTimes: snapshot,
        now,
        postFormat: 'text',
      });
      if (!computed) throw new Error('no vacant slot computed');
      await client.query(INSERT_SQL, [
        USER_A,
        PAGE_A,
        computed.slotId,
        computed.scheduledTime.toISOString(),
      ]);
    } catch {
      insertErrors += 1;
    } finally {
      client.release();
    }
  };

  await Promise.all(Array.from({ length: CHAINS }, () => chain()));

  const { rows: landed } = await pool.query(
    `SELECT scheduled_time, count(*)::int AS n FROM public.legacy_queue_items
     WHERE fb_page_id = $1 AND status = 'queued'
     GROUP BY scheduled_time ORDER BY n DESC`,
    [PAGE_A]
  );
  const total = landed.reduce((sum: number, r: { n: number }) => sum + r.n, 0);
  console.log(
    `    landed: ${total} rows on ${landed.length} distinct time(s); largest group ${landed[0]?.n ?? 0}`
  );
  check(insertErrors === 0, 'every concurrent insert COMMITTED (no error anywhere)', `${insertErrors} errors`);
  check(total === CHAINS, `all ${CHAINS} items landed`, `${total}`);
  check(
    landed.length < CHAINS,
    'COLLISION: chains double-assigned the same slot instance',
    `${landed.length} distinct times for ${CHAINS} items`
  );
}

async function sectionClaimSemantics(pool: Pool): Promise<void> {
  console.log('(c) claim_queue_slot_insert — semantics + ACL');
  await reset(pool);
  const slots = toSchedulerSlots(await loadSlots(pool));
  const now = new Date();

  const first = calculateNextVacantSlot({
    slots,
    existingScheduledTimes: [],
    now,
    postFormat: 'text',
  });
  if (!first) throw new Error('no vacant slot computed');
  const t1 = first.scheduledTime.toISOString();

  const claim1 = await pool.query(CLAIM_SQL, [USER_A, PAGE_A, first.slotId, t1]);
  check(claim1.rows.length === 1, 'first claim of a free slot instance returns the row');
  check(
    claim1.rows[0]?.status === 'queued' && Number(claim1.rows[0]?.retry_count) === 0,
    'claimed row matches the old direct-insert shape (queued, retry_count 0)'
  );

  const claim2 = await pool.query(CLAIM_SQL, [USER_A, PAGE_A, first.slotId, t1]);
  check(claim2.rows.length === 0, 'second claim of the SAME instance returns no row (occupied signal)');
  const { rows: countAfter } = await pool.query(
    `SELECT count(*)::int AS n FROM public.legacy_queue_items WHERE fb_page_id = $1`,
    [PAGE_A]
  );
  check(countAfter[0]?.n === 1, 'the losing claim inserted nothing', `${countAfter[0]?.n} rows`);

  const second = calculateNextVacantSlot({
    slots,
    existingScheduledTimes: [new Date(t1)],
    now,
    postFormat: 'text',
  });
  if (!second) throw new Error('no second vacant slot computed');
  const claim3 = await pool.query(CLAIM_SQL, [
    USER_A,
    PAGE_A,
    second.slotId,
    second.scheduledTime.toISOString(),
  ]);
  check(claim3.rows.length === 1, 'claim of a different free instance succeeds');

  const { rows: acl } = await pool.query(
    `SELECT prosecdef,
            has_function_privilege('anon', oid, 'EXECUTE') AS anon_exec,
            has_function_privilege('authenticated', oid, 'EXECUTE') AS auth_exec,
            has_function_privilege('service_role', oid, 'EXECUTE') AS svc_exec
     FROM pg_proc
     WHERE proname = 'claim_queue_slot_insert'
       AND pronamespace = 'public'::regnamespace`
  );
  check(acl.length === 1, 'claim_queue_slot_insert exists exactly once');
  check(acl[0]?.prosecdef === true, 'function is SECURITY DEFINER');
  check(acl[0]?.anon_exec === false && acl[0]?.auth_exec === false, 'anon/authenticated cannot execute it');
  check(acl[0]?.svc_exec === true, 'service_role can execute it');
}

async function sectionHardenedRace(pool: Pool): Promise<void> {
  console.log(`(d) hardened race — ${CHAINS} concurrent chains, claim + recompute/retry`);
  await reset(pool);
  const slots = toSchedulerSlots(await loadSlots(pool));
  const now = new Date();
  const barrier = new Barrier(CHAINS);
  let totalAttempts = 0;
  let chainErrors = 0;

  const chain = async (): Promise<void> => {
    const client = await pool.connect();
    try {
      // Mirror the fixed handler: snapshot + compute, claim through the
      // RPC; on the occupied signal, re-snapshot, recompute, retry.
      let snapshot = await readQueuedTimes(client);
      await barrier.wait();
      for (let attempt = 0; attempt < 25; attempt++) {
        totalAttempts += 1;
        const computed = calculateNextVacantSlot({
          slots,
          existingScheduledTimes: snapshot,
          now,
          postFormat: 'text',
        });
        if (!computed) throw new Error('no vacant slot computed');
        const { rows } = await client.query(CLAIM_SQL, [
          USER_A,
          PAGE_A,
          computed.slotId,
          computed.scheduledTime.toISOString(),
        ]);
        if (rows.length === 1) return;
        snapshot = await readQueuedTimes(client);
      }
      throw new Error('claim retries exhausted');
    } catch {
      chainErrors += 1;
    } finally {
      client.release();
    }
  };

  await Promise.all(Array.from({ length: CHAINS }, () => chain()));

  const { rows: landed } = await pool.query(
    `SELECT scheduled_time, count(*)::int AS n FROM public.legacy_queue_items
     WHERE fb_page_id = $1 AND status = 'queued'
     GROUP BY scheduled_time`,
    [PAGE_A]
  );
  const total = landed.reduce((sum: number, r: { n: number }) => sum + r.n, 0);
  console.log(`    landed: ${total} rows on ${landed.length} distinct time(s); ${totalAttempts} claim attempts`);
  check(chainErrors === 0, 'every chain eventually claimed a slot', `${chainErrors} errors`);
  check(total === CHAINS, `all ${CHAINS} items landed`, `${total}`);
  check(
    landed.length === CHAINS && landed.every((r: { n: number }) => r.n === 1),
    'NO double-assignment: every slot instance holds exactly one item'
  );
  check(
    totalAttempts > CHAINS,
    'the race really happened (losers saw the occupied signal and retried)',
    `${totalAttempts} attempts for ${CHAINS} items`
  );
}

async function sectionReorderGuard(pool: Pool): Promise<void> {
  console.log('(e) reorder guard — time permutation via single-row UPDATEs still works');
  await reset(pool);
  const slots = toSchedulerSlots(await loadSlots(pool));
  const now = new Date();
  const first = calculateNextVacantSlot({ slots, existingScheduledTimes: [], now, postFormat: 'text' });
  if (!first) throw new Error('no vacant slot computed');
  const second = calculateNextVacantSlot({
    slots,
    existingScheduledTimes: [first.scheduledTime],
    now,
    postFormat: 'text',
  });
  if (!second) throw new Error('no second vacant slot computed');

  const a = await pool.query(CLAIM_SQL, [USER_A, PAGE_A, first.slotId, first.scheduledTime.toISOString()]);
  const b = await pool.query(CLAIM_SQL, [USER_A, PAGE_A, second.slotId, second.scheduledTime.toISOString()]);
  const idA = a.rows[0]?.id as string;
  const idB = b.rows[0]?.id as string;

  // The spec 134 reorder protocol: times stay attached to positions,
  // content moves — applied as independent single-row UPDATEs (fired
  // in parallel by the client). Each UPDATE targets a time the other
  // row still holds.
  await pool.query(`UPDATE public.legacy_queue_items SET scheduled_time = $2 WHERE id = $1`, [
    idA,
    second.scheduledTime.toISOString(),
  ]);
  await pool.query(`UPDATE public.legacy_queue_items SET scheduled_time = $2 WHERE id = $1`, [
    idB,
    first.scheduledTime.toISOString(),
  ]);
  const { rows } = await pool.query(
    `SELECT id, scheduled_time FROM public.legacy_queue_items WHERE id IN ($1, $2)`,
    [idA, idB]
  );
  const timeOf = (id: string) =>
    new Date(rows.find((r: { id: string }) => r.id === id)?.scheduled_time as string).getTime();
  check(
    timeOf(idA) === second.scheduledTime.getTime() && timeOf(idB) === first.scheduledTime.getTime(),
    'both reorder UPDATEs committed and the times swapped (no uniqueness blocks the permutation)'
  );
}

async function main(): Promise<void> {
  const url = process.env.QUEUE_SLOT_PG_URL;
  if (!url) throw new Error('QUEUE_SLOT_PG_URL is required');
  const pool = new Pool({ connectionString: url, max: CHAINS + 4 });
  try {
    console.log(`queue-slot-collision rig — mode=${mode}`);
    await sectionCatalogue(pool);
    if (hardened) {
      await sectionClaimSemantics(pool);
      await sectionHardenedRace(pool);
      await sectionReorderGuard(pool);
    } else {
      await sectionVulnerableRace(pool);
    }
    console.log(`\n${checks} assertions, ${failures} failures`);
    if (failures > 0) process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
