import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken, type DatabaseClient } from '@fbuploadpro/contracts';
import { handleEnqueueMedia } from '../../src/app/api/tenant/[subdomain]/publishing/queue/route';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Spec 139 A15 follow-up — queue-slot collision (route level).
 *
 * In queue mode (no scheduledTime) the enqueue handler computes the
 * next vacant slot from a snapshot of the page's queued items. Before
 * the fix it inserted directly: concurrent chains that snapshot the
 * same state all computed the SAME slot instance and all inserted —
 * two posts double-booked one slot, silently (legacy_queue_items has
 * no unique index over the time dimension, by design: it would break
 * the queue reorder's time permutation; proven against real
 * PostgreSQL by apps/worker/tests/queue-slot-collision/).
 *
 * The fix claims the computed slot through claim_queue_slot_insert,
 * which serializes claimants per page and reports the slot occupied;
 * the handler recomputes from a fresh snapshot and retries.
 *
 * These tests drive the REAL handler (both client paths) against a
 * stateful fake store whose reads snapshot at issue time and whose
 * writes land a macrotask later — the interleaving that made the old
 * code collide. Six concurrent queue-mode enqueues must land on six
 * DISTINCT slot instances, every one with a 201.
 */

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

const userId = '11111111-1111-4111-a111-111111111111';
const pageId = '22222222-2222-4222-a222-222222222222';
const workspaceId = 'ws_123';

const SLOT_IDS = [
  '44444444-4444-4444-a444-444444444441',
  '44444444-4444-4444-a444-444444444442',
  '44444444-4444-4444-a444-444444444443',
] as const;
const SLOT_TIMES = ['09:00:00', '13:00:00', '18:00:00'] as const;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

interface FakeRow {
  id: string;
  user_id: string;
  fb_page_id: string;
  slot_id: string | null;
  media_id: string | null;
  post_format: string;
  link_url: string | null;
  scheduled_time: string;
  caption: string;
  first_comment: string | null;
  status: string;
  retry_count: number;
  max_retries: number;
  fb_post_id: null;
  fb_comment_id: null;
  published_at: null;
  created_at: string;
  updated_at: string;
}

interface EnqueueArgs {
  slot_id: string | null;
  media_id: string | null;
  post_format: string;
  link_url: string | null;
  scheduled_time: string;
  caption: string;
  first_comment: string | null;
}

/**
 * In-memory stand-in for the two database behaviours the handler
 * depends on: queued-times reads (snapshot semantics) and inserts —
 * the atomic claim (occupied → no row, mirroring
 * claim_queue_slot_insert) and the legacy direct insert.
 */
class FakeQueueStore {
  rows: FakeRow[] = [];
  claimAttempts = 0;
  directInserts = 0;
  private seq = 0;

  slotRows() {
    return SLOT_IDS.map((id, i) => ({
      id,
      slot_time: SLOT_TIMES[i],
      is_active: true,
      allowed_formats: null,
    }));
  }

  /** Snapshot of queued times, captured synchronously at issue time. */
  snapshotQueuedTimes(): string[] {
    return this.rows
      .filter((r) => r.status === 'queued')
      .map((r) => r.scheduled_time);
  }

  private buildRow(args: EnqueueArgs): FakeRow {
    this.seq += 1;
    return {
      id: `55555555-5555-4555-a555-${String(this.seq).padStart(12, '0')}`,
      user_id: userId,
      fb_page_id: pageId,
      slot_id: args.slot_id,
      media_id: args.media_id,
      post_format: args.post_format,
      link_url: args.link_url,
      scheduled_time: args.scheduled_time,
      caption: args.caption,
      first_comment: args.first_comment,
      status: 'queued',
      retry_count: 0,
      max_retries: 3,
      fb_post_id: null,
      fb_comment_id: null,
      published_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  /** Mirrors claim_queue_slot_insert: occupied instance → null. */
  async claim(args: EnqueueArgs): Promise<FakeRow | null> {
    await tick();
    this.claimAttempts += 1;
    const occupied = this.rows.some(
      (r) => r.status === 'queued' && r.scheduled_time === args.scheduled_time
    );
    if (occupied) return null;
    const row = this.buildRow(args);
    this.rows.push(row);
    return row;
  }

  /** The pre-fix behaviour: an unconditional direct insert. */
  async insertDirect(args: EnqueueArgs): Promise<FakeRow> {
    await tick();
    this.directInserts += 1;
    const row = this.buildRow(args);
    this.rows.push(row);
    return row;
  }
}

// ---------------------------------------------------------------------------
// Supabase-shaped fake client
// ---------------------------------------------------------------------------

class FakeSupabaseBuilder {
  private insertPayload: Record<string, unknown> | null = null;

  constructor(
    private store: FakeQueueStore,
    private table: string
  ) {}

  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  insert(payload: Record<string, unknown>) {
    this.insertPayload = payload;
    return this;
  }

  async maybeSingle() {
    await tick();
    if (this.table === 'workspaces') return { data: { id: workspaceId }, error: null };
    if (this.table === 'facebook_pages') {
      return { data: { id: pageId, timezone: 'UTC' }, error: null };
    }
    return { data: null, error: null };
  }

  async single() {
    if (this.table === 'legacy_queue_items' && this.insertPayload) {
      const p = this.insertPayload;
      const row = await this.store.insertDirect({
        slot_id: (p.slot_id as string | null) ?? null,
        media_id: (p.media_id as string | null) ?? null,
        post_format: p.post_format as string,
        link_url: (p.link_url as string | null) ?? null,
        scheduled_time: p.scheduled_time as string,
        caption: p.caption as string,
        first_comment: (p.first_comment as string | null) ?? null,
      });
      return { data: row, error: null };
    }
    return { data: null, error: null };
  }

  then(
    onFulfilled: (v: { data: unknown; error: null }) => unknown,
    onRejected?: (e: unknown) => unknown
  ) {
    // Capture read snapshots NOW (issue time), resolve a tick later —
    // the interleaving concurrent chains produce in production.
    let result: { data: unknown; error: null } = { data: null, error: null };
    if (this.table === 'page_queue_slots') {
      result = { data: this.store.slotRows(), error: null };
    } else if (this.table === 'legacy_queue_items') {
      const times = this.store.snapshotQueuedTimes();
      result = { data: times.map((t) => ({ scheduled_time: t })), error: null };
    }
    return tick()
      .then(() => result)
      .then(onFulfilled, onRejected);
  }
}

function createFakeSupabase(store: FakeQueueStore) {
  const client = {
    from: (table: string) => new FakeSupabaseBuilder(store, table),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      const row = await store.claim({
        slot_id: (args.p_slot_id as string | null) ?? null,
        media_id: (args.p_media_id as string | null) ?? null,
        post_format: args.p_post_format as string,
        link_url: (args.p_link_url as string | null) ?? null,
        scheduled_time: args.p_scheduled_time as string,
        caption: args.p_caption as string,
        first_comment: (args.p_first_comment as string | null) ?? null,
      });
      return { data: row ? [row] : [], error: null };
    },
  };
  return client as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Legacy SQL-shaped fake client
// ---------------------------------------------------------------------------

function createFakeLegacyDb(store: FakeQueueStore) {
  const db: Partial<DatabaseClient> = {
    query: vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM workspaces')) {
        await tick();
        return [{ id: workspaceId }];
      }
      if (sql.includes('FROM facebook_pages')) {
        await tick();
        return [{ id: pageId, timezone: 'UTC' }];
      }
      if (sql.includes('FROM page_queue_slots')) {
        await tick();
        return store.slotRows();
      }
      if (sql.includes('SELECT scheduled_time FROM legacy_queue_items')) {
        const times = store.snapshotQueuedTimes();
        await tick();
        return times.map((t) => ({ scheduled_time: t }));
      }
      if (sql.includes('claim_queue_slot_insert')) {
        const row = await store.claim({
          slot_id: (params[2] as string | null) ?? null,
          media_id: (params[3] as string | null) ?? null,
          post_format: params[4] as string,
          link_url: (params[5] as string | null) ?? null,
          scheduled_time: params[6] as string,
          caption: params[7] as string,
          first_comment: (params[8] as string | null) ?? null,
        });
        return row ? [row] : [];
      }
      if (sql.includes('INSERT INTO legacy_queue_items')) {
        const row = await store.insertDirect({
          slot_id: (params[2] as string | null) ?? null,
          media_id: (params[3] as string | null) ?? null,
          post_format: params[4] as string,
          link_url: (params[5] as string | null) ?? null,
          scheduled_time: params[6] as string,
          caption: params[7] as string,
          first_comment: (params[8] as string | null) ?? null,
        });
        return [row];
      }
      return [];
    }),
  };
  return db as DatabaseClient;
}

// ---------------------------------------------------------------------------

const CONCURRENT = 6;

describe('Spec 139 A15 follow-up — concurrent queue-mode enqueues never double-book a slot', () => {
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    const token = await signSessionToken(
      {
        userId,
        email: 'alexander@gmail.com',
        name: 'Alex Acme',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;
  });

  function queueModeRequest(caption: string): NextRequest {
    return new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
      method: 'POST',
      headers: { cookie: validSessionCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        pageId,
        mediaId: null,
        postFormat: 'text',
        caption,
      }),
    });
  }

  async function runConcurrentEnqueues(
    client: DatabaseClient | SupabaseClient
  ): Promise<Array<{ status: number; scheduledTime: string | undefined }>> {
    const responses = await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        handleEnqueueMedia(queueModeRequest(`Post ${i}`), 'acme', client)
      )
    );
    return Promise.all(
      responses.map(
        async (res): Promise<{ status: number; scheduledTime: string | undefined }> => {
          const json = (await res.json()) as { scheduledTime?: string };
          return { status: res.status, scheduledTime: json.scheduledTime };
        }
      )
    );
  }

  function expectNoDoubleBooking(
    store: FakeQueueStore,
    results: Array<{ status: number; scheduledTime: string | undefined }>
  ) {
    for (const r of results) {
      expect(r.status).toBe(201);
    }
    const times = results.map((r) => r.scheduledTime);
    expect(new Set(times).size).toBe(CONCURRENT);
    expect(store.rows).toHaveLength(CONCURRENT);
    expect(new Set(store.rows.map((r) => r.scheduled_time)).size).toBe(CONCURRENT);
  }

  it('supabase path: 6 concurrent queue-mode enqueues land on 6 distinct slot instances', async () => {
    const store = new FakeQueueStore();
    const results = await runConcurrentEnqueues(createFakeSupabase(store));
    expectNoDoubleBooking(store, results);
    // The race really happened: the first snapshot wave collided on
    // one slot instance, so the claim needed retries — and queue mode
    // never fell back to the unguarded direct insert.
    expect(store.claimAttempts).toBeGreaterThan(CONCURRENT);
    expect(store.directInserts).toBe(0);
  });

  it('legacy SQL path: 6 concurrent queue-mode enqueues land on 6 distinct slot instances', async () => {
    const store = new FakeQueueStore();
    const results = await runConcurrentEnqueues(createFakeLegacyDb(store));
    expectNoDoubleBooking(store, results);
    expect(store.claimAttempts).toBeGreaterThan(CONCURRENT);
    expect(store.directInserts).toBe(0);
  });
});
