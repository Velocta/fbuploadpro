import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  authorizeInternalRequest,
  probeInternalHealth,
  GET,
} from '../../src/app/api/internal/health/route.js';

/**
 * Chainable Supabase-builder mock. Awaiting the builder resolves a head-count
 * style result; .maybeSingle() resolves row-style results.
 */
function createMockDb(options: {
  heartbeat: Record<string, unknown> | null;
  dueCount?: number;
  stuckCount?: number;
  oldestScheduledTime?: string | null;
  pageCounts?: Record<string, number>;
  accountCounts?: Record<string, number>;
}) {
  const makeBuilder = (table: string) => {
    const filters: Record<string, unknown> = {};
    const builder: Record<string, unknown> = {};
    const resolveCount = () => {
      if (table === 'legacy_queue_items') {
        return {
          count: filters.status === 'publishing' ? (options.stuckCount ?? 0) : (options.dueCount ?? 0),
          error: null,
        };
      }
      if (table === 'facebook_pages') {
        return { count: options.pageCounts?.[String(filters.status)] ?? 0, error: null };
      }
      if (table === 'facebook_accounts') {
        return { count: options.accountCounts?.[String(filters.status)] ?? 0, error: null };
      }
      return { count: 0, error: null };
    };
    builder.select = () => builder;
    builder.eq = (_col: string, val: unknown) => {
      filters[_col] = val;
      return builder;
    };
    builder.lte = () => builder;
    builder.order = () => builder;
    builder.limit = () => builder;
    builder.maybeSingle = async () => {
      if (table === 'worker_heartbeats') {
        return { data: options.heartbeat, error: null };
      }
      if (table === 'legacy_queue_items') {
        return {
          data: options.oldestScheduledTime
            ? { scheduled_time: options.oldestScheduledTime }
            : null,
          error: null,
        };
      }
      return { data: null, error: null };
    };
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(resolveCount()).then(resolve, reject);
    return builder;
  };
  return { from: vi.fn((table: string) => makeBuilder(table)) } as unknown as SupabaseClient;
}

const NOW = new Date('2026-10-22T12:00:00.000Z');
const freshHeartbeat = {
  last_run_at: '2026-10-22T11:59:30.000Z',
  last_success_at: '2026-10-22T11:59:30.000Z',
  last_claimed_count: 3,
  last_settled_count: 3,
  last_skip_reason: null,
};

describe('Internal Health Probe (/api/internal/health)', () => {
  it('returns ok when heartbeat is fresh, storage is up, and queue is clear', async () => {
    const db = createMockDb({
      heartbeat: freshHeartbeat,
      pageCounts: { active: 10, paused: 2 },
      accountCounts: { active: 4 },
    });
    const res = await probeInternalHealth({
      db,
      checkStorage: async () => true,
      now: NOW,
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('ok');
    expect(res.payload.checks.database.ok).toBe(true);
    expect(res.payload.checks.heartbeat.ok).toBe(true);
    expect(res.payload.checks.heartbeat.ageSeconds).toBe(30);
    expect(res.payload.checks.heartbeat.claimed).toBe(3);
    expect(res.payload.checks.storage.ok).toBe(true);
    expect(res.payload.checks.facebook.pagesByStatus.active).toBe(10);
    expect(res.payload.checks.facebook.accountsByStatus.active).toBe(4);
  });

  it('flips to unhealthy when the heartbeat is stale (simulated dead worker)', async () => {
    const db = createMockDb({
      heartbeat: {
        ...freshHeartbeat,
        last_run_at: '2026-10-22T11:50:00.000Z',
        last_success_at: '2026-10-22T11:50:00.000Z',
      },
    });
    const res = await probeInternalHealth({
      db,
      checkStorage: async () => true,
      now: NOW,
    });
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.checks.heartbeat.ok).toBe(false);
    expect(res.payload.checks.heartbeat.ageSeconds).toBe(600);
  });

  it('flips to unhealthy when no heartbeat row exists', async () => {
    const db = createMockDb({ heartbeat: null });
    const res = await probeInternalHealth({
      db,
      checkStorage: async () => true,
      now: NOW,
    });
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.checks.heartbeat.ok).toBe(false);
    expect(res.payload.checks.heartbeat.ageSeconds).toBeNull();
  });

  it('reports the skip reason recorded by the worker', async () => {
    const db = createMockDb({
      heartbeat: {
        last_run_at: '2026-10-22T11:59:30.000Z',
        last_success_at: '2026-10-22T11:40:00.000Z',
        last_claimed_count: 0,
        last_settled_count: 0,
        last_skip_reason: 'missing_token_encryption_key',
      },
    });
    const res = await probeInternalHealth({
      db,
      checkStorage: async () => true,
      now: NOW,
    });
    expect(res.payload.checks.heartbeat.lastSkipReason).toBe(
      'missing_token_encryption_key'
    );
    expect(res.payload.status).toBe('unhealthy');
  });

  it('returns degraded when items are stuck in publishing beyond the recovery threshold', async () => {
    const db = createMockDb({
      heartbeat: freshHeartbeat,
      stuckCount: 2,
      dueCount: 5,
      oldestScheduledTime: '2026-10-22T11:55:00.000Z',
    });
    const res = await probeInternalHealth({
      db,
      checkStorage: async () => true,
      now: NOW,
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('degraded');
    expect(res.payload.checks.queue.stuckPublishingCount).toBe(2);
    expect(res.payload.checks.queue.dueCount).toBe(5);
    expect(res.payload.checks.queue.oldestDueAgeSeconds).toBe(300);
  });

  it('flips to unhealthy when storage is down', async () => {
    const db = createMockDb({ heartbeat: freshHeartbeat });
    const res = await probeInternalHealth({
      db,
      checkStorage: async () => false,
      now: NOW,
    });
    expect(res.statusCode).toBe(503);
    expect(res.payload.checks.storage.ok).toBe(false);
  });
});

describe('Internal Health Authorization', () => {
  const SECRET = 'internal-test-session-secret-at-least-32-chars';
  const savedEnv = { ...process.env };

  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
    process.env.INTERNAL_HEALTH_TOKEN = 'internal-health-token-value';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('rejects requests with no credentials', async () => {
    const req = new Request('https://app.example.com/api/internal/health');
    expect(await authorizeInternalRequest(req)).toBe(false);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('rejects a wrong bearer token', async () => {
    const req = new Request('https://app.example.com/api/internal/health', {
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(await authorizeInternalRequest(req)).toBe(false);
  });

  it('accepts the internal bearer token', async () => {
    const req = new Request('https://app.example.com/api/internal/health', {
      headers: { authorization: 'Bearer internal-health-token-value' },
    });
    expect(await authorizeInternalRequest(req)).toBe(true);
  });

  it('accepts an admin session and rejects a non-admin session', async () => {
    const adminToken = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'adminregularuser@gmail.com',
        name: null,
        subdomain: 'adminws',
        role: 'admin',
        status: 'active',
      },
      SECRET
    );
    const adminReq = new Request('https://app.example.com/api/internal/health', {
      headers: { cookie: `fbup_session=${adminToken}` },
    });
    expect(await authorizeInternalRequest(adminReq)).toBe(true);

    const userToken = await signSessionToken(
      {
        userId: '22222222-2222-4222-a222-222222222222',
        email: 'regularuser@gmail.com',
        name: null,
        subdomain: 'userws',
        role: 'user',
        status: 'active',
      },
      SECRET
    );
    const userReq = new Request('https://app.example.com/api/internal/health', {
      headers: { cookie: `fbup_session=${userToken}` },
    });
    expect(await authorizeInternalRequest(userReq)).toBe(false);
  });
});
