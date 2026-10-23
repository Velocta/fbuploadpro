import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken, type DatabaseClient } from '@fbuploadpro/contracts';
import { handleGetPage } from '../../src/app/api/tenant/[subdomain]/pages/[pageId]/route';
import { handleListQueueItems } from '../../src/app/api/tenant/[subdomain]/publishing/queue/route';
import {
  handleBulkEnqueue,
  BULK_ENQUEUE_CONCURRENCY,
} from '../../src/app/api/tenant/[subdomain]/publishing/queue/bulk/route';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Spec 139 A14/A15 — queue performance fixes.
 *
 * A14: the queue-status counts fallback (used when the grouped
 * `get_page_queue_status_counts` RPC is unavailable or errors) must be
 * BOUNDED — one head/count query per status — instead of selecting
 * every queue row and counting in JS.
 *
 * A15: bulk enqueue must batch its shared per-item reads (workspace /
 * page once, media via a single `.in()` query) and run the per-item
 * write chains through a bounded-concurrency pool, preserving per-item
 * failure isolation and the request ordering of results.
 */

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

const userId = '11111111-1111-4111-a111-111111111111';
const pageId = '22222222-2222-4222-a222-222222222222';
const workspaceId = 'ws_123';

interface BuilderRecord {
  table: string;
  selectArgs: unknown[];
  filters: Array<[string, string, unknown]>;
  insertPayload?: Record<string, unknown>;
}

type MockResult = { data?: unknown; count?: number | null; error?: unknown };
type MockMode = 'await' | 'maybeSingle' | 'single';
type MockHandler = (rec: BuilderRecord, mode: MockMode) => MockResult | Promise<MockResult>;

/** Minimal chainable Supabase query-builder mock: records every call. */
class MockBuilder {
  readonly rec: BuilderRecord;

  constructor(
    table: string,
    private handler: MockHandler,
    records: BuilderRecord[]
  ) {
    this.rec = { table, selectArgs: [], filters: [] };
    records.push(this.rec);
  }

  select(...args: unknown[]) {
    this.rec.selectArgs = args;
    return this;
  }
  eq(col: string, val: unknown) {
    this.rec.filters.push(['eq', col, val]);
    return this;
  }
  neq(col: string, val: unknown) {
    this.rec.filters.push(['neq', col, val]);
    return this;
  }
  in(col: string, val: unknown) {
    this.rec.filters.push(['in', col, val]);
    return this;
  }
  order() {
    return this;
  }
  range() {
    return this;
  }
  insert(payload: Record<string, unknown>) {
    this.rec.insertPayload = payload;
    return this;
  }
  maybeSingle() {
    return Promise.resolve(this.handler(this.rec, 'maybeSingle'));
  }
  single() {
    return Promise.resolve(this.handler(this.rec, 'single'));
  }
  then(onFulfilled: (v: MockResult) => unknown, onRejected?: (e: unknown) => unknown) {
    return Promise.resolve(this.handler(this.rec, 'await')).then(onFulfilled, onRejected);
  }
}

function createMockSupabase(handler: MockHandler, rpc: unknown) {
  const records: BuilderRecord[] = [];
  const client = {
    from: (table: string) => new MockBuilder(table, handler, records),
    rpc,
  };
  return { client: client as unknown as SupabaseClient, records };
}

function filterValue(rec: BuilderRecord, method: string, col: string): unknown {
  return rec.filters.find(([m, c]) => m === method && c === col)?.[2];
}

/** Builders that are bounded head/count queries (the A14 fallback shape). */
function headCountBuilders(records: BuilderRecord[], table: string): BuilderRecord[] {
  return records.filter(
    (r) =>
      r.table === table &&
      (r.selectArgs[1] as { head?: boolean; count?: string } | undefined)?.head === true &&
      (r.selectArgs[1] as { count?: string } | undefined)?.count === 'exact'
  );
}

/** The old unbounded pattern: selecting a column for every row and tallying in JS. */
function rowSelectBuilders(records: BuilderRecord[], table: string, column: string): BuilderRecord[] {
  return records.filter((r) => r.table === table && r.selectArgs[0] === column);
}

const pageRow = {
  id: pageId,
  facebook_account_id: '99999999-9999-4999-a999-999999999999',
  account_display_name: 'Alex Acme Account',
  fb_page_id: 'fb_page_999',
  page_name: 'Acme Brand',
  profile_picture_url: null,
  category: 'Brand',
  timezone: 'UTC',
  starting_followers: 100,
  current_followers: 150,
  status: 'active',
  tasks: ['CREATE_CONTENT'],
  created_at: new Date('2026-10-01T12:00:00Z').toISOString(),
  updated_at: new Date('2026-10-01T12:00:00Z').toISOString(),
};

describe('Spec 139 A14/A15 — queue counts fallback + bulk enqueue', () => {
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

  describe('A14 — page route counts fallback (handleGetPage)', () => {
    const COUNTS: Record<string, number> = { queued: 3, publishing: 1, published: 7, failed: 2 };

    function pageHandler(countErrorForStatus?: string): MockHandler {
      return (rec, mode) => {
        if (rec.table === 'workspaces') return { data: { id: workspaceId }, error: null };
        if (rec.table === 'facebook_pages') return { data: pageRow, error: null };
        if (rec.table === 'legacy_queue_items') {
          const status = filterValue(rec, 'eq', 'status') as string;
          if (countErrorForStatus === status) {
            return { data: null, count: null, error: { message: 'count failed' } };
          }
          return { data: null, count: COUNTS[status] ?? 0, error: null };
        }
        void mode;
        return { data: null, error: null };
      };
    }

    it('uses bounded per-status head/count queries when the RPC errors', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc unavailable' } });
      const { client, records } = createMockSupabase(pageHandler(), rpc);

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/pages/${pageId}`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetPage(req, 'acme', pageId, client);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.queueCounts).toEqual({ queued: 3, publishing: 1, published: 7, failed: 2 });

      // RPC was tried first.
      expect(rpc).toHaveBeenCalledWith('get_page_queue_status_counts', {
        p_page_id: pageId,
        p_user_id: userId,
      });

      // Exactly one bounded head/count query per status, scoped to page + user.
      const builders = headCountBuilders(records, 'legacy_queue_items');
      expect(builders).toHaveLength(4);
      expect(builders.map((b) => filterValue(b, 'eq', 'status')).sort()).toEqual(
        ['failed', 'published', 'publishing', 'queued'].sort()
      );
      for (const b of builders) {
        expect(b.selectArgs[0]).toBe('id');
        expect(filterValue(b, 'eq', 'page_id')).toBe(pageId);
        expect(filterValue(b, 'eq', 'user_id')).toBe(userId);
      }
      // The old select-all-rows pattern is gone.
      expect(rowSelectBuilders(records, 'legacy_queue_items', 'status')).toHaveLength(0);
    });

    it('serves the RPC counts without any fallback queries when the RPC succeeds', async () => {
      const rpc = vi
        .fn()
        .mockResolvedValue({ data: [{ queued: 9, publishing: 8, published: 7, failed: 6 }], error: null });
      const { client, records } = createMockSupabase(pageHandler(), rpc);

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/pages/${pageId}`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetPage(req, 'acme', pageId, client);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.queueCounts).toEqual({ queued: 9, publishing: 8, published: 7, failed: 6 });
      expect(records.filter((r) => r.table === 'legacy_queue_items')).toHaveLength(0);
    });

    it('falls back to zero counts when a bounded count query errors', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc unavailable' } });
      const { client } = createMockSupabase(pageHandler('failed'), rpc);

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/pages/${pageId}`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetPage(req, 'acme', pageId, client);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.page.id).toBe(pageId);
      expect(json.queueCounts).toEqual({ queued: 0, publishing: 0, published: 0, failed: 0 });
    });
  });

  describe('A14 — publishing queue list counts fallback (handleListQueueItems)', () => {
    const COUNTS: Record<string, number> = {
      queued: 4,
      published: 5,
      failed: 6,
      skipped: 7,
      cancelled: 8,
    };

    const listHandler: MockHandler = (rec, mode) => {
      if (rec.table === 'workspaces') return { data: { id: workspaceId }, error: null };
      if (rec.table === 'facebook_pages') return { data: [{ id: pageId }], error: null };
      if (rec.table === 'legacy_queue_items') {
        const isHeadCount =
          (rec.selectArgs[1] as { head?: boolean } | undefined)?.head === true;
        if (isHeadCount) {
          const status = filterValue(rec, 'eq', 'status') as string;
          return { data: null, count: COUNTS[status] ?? 0, error: null };
        }
        return { data: [], count: 0, error: null };
      }
      void mode;
      return { data: null, error: null };
    };

    it('uses bounded per-status head/count queries when the RPC errors (page-scoped)', async () => {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc unavailable' } });
      const { client, records } = createMockSupabase(listHandler, rpc);

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/publishing/queue?pageId=${pageId}`,
        { headers: { cookie: validSessionCookie } }
      );
      const res = await handleListQueueItems(req, 'acme', client);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.queuedCount).toBe(4);
      expect(json.publishedCount).toBe(5);
      expect(json.failedCount).toBe(6);
      expect(json.skippedCount).toBe(7);
      expect(json.cancelledCount).toBe(8);

      expect(rpc).toHaveBeenCalledWith('get_page_queue_status_counts', {
        p_page_id: pageId,
        p_user_id: userId,
      });
      const builders = headCountBuilders(records, 'legacy_queue_items');
      expect(builders).toHaveLength(5);
      expect(builders.map((b) => filterValue(b, 'eq', 'status')).sort()).toEqual(
        ['cancelled', 'failed', 'published', 'queued', 'skipped'].sort()
      );
      for (const b of builders) {
        expect(filterValue(b, 'eq', 'fb_page_id')).toBe(pageId);
        expect(filterValue(b, 'eq', 'user_id')).toBe(userId);
      }
      expect(rowSelectBuilders(records, 'legacy_queue_items', 'status')).toHaveLength(0);
    });

    it('uses bounded workspace-scoped counts when no pageId is given (no RPC call)', async () => {
      const rpc = vi.fn();
      const { client, records } = createMockSupabase(listHandler, rpc);

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleListQueueItems(req, 'acme', client);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.queuedCount).toBe(4);
      expect(json.cancelledCount).toBe(8);
      expect(rpc).not.toHaveBeenCalled();
      const builders = headCountBuilders(records, 'legacy_queue_items');
      expect(builders).toHaveLength(5);
      for (const b of builders) {
        expect(filterValue(b, 'in', 'fb_page_id')).toEqual([pageId]);
      }
    });

    it('serves the RPC counts without any fallback queries when the RPC succeeds', async () => {
      const rpc = vi.fn().mockResolvedValue({
        data: [{ queued_count: 11, published_count: 12, failed_count: 13, skipped_count: 14, cancelled_count: 15 }],
        error: null,
      });
      const { client, records } = createMockSupabase(listHandler, rpc);

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/publishing/queue?pageId=${pageId}`,
        { headers: { cookie: validSessionCookie } }
      );
      const res = await handleListQueueItems(req, 'acme', client);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.queuedCount).toBe(11);
      expect(json.publishedCount).toBe(12);
      expect(json.failedCount).toBe(13);
      expect(json.skippedCount).toBe(14);
      expect(json.cancelledCount).toBe(15);
      expect(headCountBuilders(records, 'legacy_queue_items')).toHaveLength(0);
    });
  });

  describe('A15 — bulk enqueue (handleBulkEnqueue)', () => {
    const ITEM_COUNT = 12;
    const FAILED_INDEX = 3;
    const mediaIdFor = (i: number) =>
      `33333333-3333-4333-a333-${String(i).padStart(12, '0')}`;
    const missingMediaId = '33333333-3333-4333-a333-999999999999';
    const itemIdFor = (i: number) =>
      `55555555-5555-4555-a555-${String(i).padStart(12, '0')}`;

    function bulkItems() {
      return Array.from({ length: ITEM_COUNT }, (_, i) => ({
        mediaId: i === FAILED_INDEX ? missingMediaId : mediaIdFor(i),
        format: 'image',
        caption: `Post ${i}`,
        scheduledTime: '2026-10-16T12:00:00.000Z',
      }));
    }

    it('batches reads with one .in() media query, pools writes at bounded concurrency, preserves order + failure isolation', async () => {
      let activeInserts = 0;
      let maxActiveInserts = 0;

      const mediaRows = Array.from({ length: ITEM_COUNT }, (_, i) => ({
        id: mediaIdFor(i),
        name: `photo-${i}.jpg`,
        media_type: 'image',
        url: `https://cdn.example.com/photo-${i}.jpg`,
        thumbnail_url: null,
        aspect_ratio: '1:1',
        duration_seconds: null,
        width: 100,
        height: 100,
      }));

      const handler: MockHandler = async (rec, mode) => {
        if (rec.table === 'workspaces') return { data: { id: workspaceId }, error: null };
        if (rec.table === 'facebook_pages') {
          // Only the one-time prefetch may read the page (maybeSingle).
          expect(mode).toBe('maybeSingle');
          return { data: { id: pageId, timezone: 'UTC' }, error: null };
        }
        if (rec.table === 'media_items') {
          // Only the one-time prefetch may read media (awaited .in() query).
          expect(mode).toBe('await');
          return { data: mediaRows, error: null };
        }
        if (rec.table === 'legacy_queue_items' && rec.insertPayload) {
          const payload = rec.insertPayload;
          const idx = Number(String(payload.caption).replace('Post ', ''));
          activeInserts++;
          maxActiveInserts = Math.max(maxActiveInserts, activeInserts);
          // Earlier items finish LAST: proves results are index-ordered,
          // not completion-ordered.
          await new Promise((r) => setTimeout(r, (ITEM_COUNT - idx) * 4));
          activeInserts--;
          return {
            data: {
              id: itemIdFor(idx),
              user_id: userId,
              fb_page_id: pageId,
              slot_id: null,
              media_id: payload.media_id,
              post_format: 'image',
              link_url: null,
              scheduled_time: payload.scheduled_time,
              caption: payload.caption,
              first_comment: null,
              status: 'queued',
              retry_count: 0,
              max_retries: 3,
              fb_post_id: null,
              fb_comment_id: null,
              published_at: null,
              created_at: new Date('2026-10-16T10:00:00Z').toISOString(),
              updated_at: new Date('2026-10-16T10:00:00Z').toISOString(),
            },
            error: null,
          };
        }
        return { data: null, error: null };
      };

      const { client, records } = createMockSupabase(handler, vi.fn());

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue/bulk', {
        method: 'POST',
        headers: { cookie: validSessionCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ pageId, items: bulkItems() }),
      });

      const res = await handleBulkEnqueue(req, 'acme', client);
      expect(res.status).toBe(200);
      const json = await res.json();

      // Results: one per item, in REQUEST order despite reverse completion
      // order; the missing-media item fails in isolation.
      expect(json.results).toHaveLength(ITEM_COUNT);
      for (let i = 0; i < ITEM_COUNT; i++) {
        if (i === FAILED_INDEX) {
          expect(json.results[i]).toEqual({ ok: false, error: 'Media not found' });
        } else {
          expect(json.results[i]).toEqual({ ok: true, itemId: itemIdFor(i) });
        }
      }

      // Batched reads: workspace resolved once, page read once, media read
      // once via a single .in() over every referenced media id.
      expect(records.filter((r) => r.table === 'workspaces')).toHaveLength(1);
      expect(records.filter((r) => r.table === 'facebook_pages')).toHaveLength(1);
      const mediaBuilders = records.filter((r) => r.table === 'media_items');
      expect(mediaBuilders).toHaveLength(1);
      const inFilter = filterValue(mediaBuilders[0]!, 'in', 'id') as string[];
      expect(inFilter).toHaveLength(ITEM_COUNT); // 11 present + the missing one
      expect(inFilter).toContain(missingMediaId);
      expect(inFilter).toContain(mediaIdFor(0));

      // Bounded concurrency: the pool ran items in parallel but never
      // more than BULK_ENQUEUE_CONCURRENCY chains at once.
      expect(BULK_ENQUEUE_CONCURRENCY).toBe(8);
      expect(maxActiveInserts).toBeGreaterThan(1);
      expect(maxActiveInserts).toBeLessThanOrEqual(BULK_ENQUEUE_CONCURRENCY);
    });

    it('keeps per-item isolation + ordering on the legacy SQL path (no prefetch)', async () => {
      const legacyMediaId = mediaIdFor(0);
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params: unknown[]) => {
          if (sql.includes('FROM workspaces')) {
            return Promise.resolve([{ id: workspaceId }]);
          }
          if (sql.includes('FROM facebook_pages')) {
            return Promise.resolve([{ id: pageId, timezone: 'UTC' }]);
          }
          if (sql.includes('FROM media_items')) {
            if (params[0] === missingMediaId) return Promise.resolve([]);
            return Promise.resolve([
              {
                id: params[0],
                name: 'photo.jpg',
                media_type: 'image',
                url: 'https://cdn.example.com/photo.jpg',
                thumbnail_url: null,
                aspect_ratio: '1:1',
                duration_seconds: null,
                width: 100,
                height: 100,
              },
            ]);
          }
          if (sql.includes('INSERT INTO legacy_queue_items')) {
            const caption = params[7] as string;
            const idx = Number(caption.replace('Post ', ''));
            return Promise.resolve([
              {
                id: itemIdFor(idx),
                user_id: userId,
                fb_page_id: pageId,
                slot_id: null,
                media_id: params[3],
                post_format: 'image',
                link_url: null,
                scheduled_time: new Date('2026-10-16T12:00:00Z'),
                caption,
                first_comment: null,
                status: 'queued',
                retry_count: 0,
                max_retries: 3,
                fb_post_id: null,
                fb_comment_id: null,
                published_at: null,
                created_at: new Date('2026-10-16T10:00:00Z'),
                updated_at: new Date('2026-10-16T10:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const items = [0, 1, 2].map((i) => ({
        mediaId: i === 1 ? missingMediaId : legacyMediaId,
        format: 'image',
        caption: `Post ${i}`,
        scheduledTime: '2026-10-16T12:00:00.000Z',
      }));

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue/bulk', {
        method: 'POST',
        headers: { cookie: validSessionCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ pageId, items }),
      });

      const res = await handleBulkEnqueue(req, 'acme', mockDb as DatabaseClient);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.results).toEqual([
        { ok: true, itemId: itemIdFor(0) },
        { ok: false, error: 'Media not found' },
        { ok: true, itemId: itemIdFor(2) },
      ]);
    });
  });
});
