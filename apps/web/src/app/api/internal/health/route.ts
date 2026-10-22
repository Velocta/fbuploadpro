import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import {
  getSessionSecret,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/supabase-auth';
import { createR2S3Client, getR2Config } from '@/lib/storage';

/**
 * Internal health tier (spec 116). Authenticated only — never public.
 *
 * Authorization: either a Bearer token matching INTERNAL_HEALTH_TOKEN, or
 * a signed session cookie whose role is 'admin'. Fails closed otherwise.
 *
 * Expensive / revealing checks live here only: R2 HeadBucket, DB latency,
 * worker heartbeat age, queue backlog, and stored Facebook domain-health
 * aggregates. The Facebook Graph API is NEVER called from any health path.
 */

export const HEARTBEAT_STALE_SECONDS = 180; // ~3 missed 1-minute ticks
export const STUCK_PUBLISHING_MINUTES = 10; // matches the worker recovery threshold
const R2_PROBE_TIMEOUT_MS = 1000;

const PAGE_STATUSES = [
  'active',
  'paused',
  'fb_rate_limited',
  'page_checkpoint',
  'invalid_token',
  'disconnected',
] as const;
const ACCOUNT_STATUSES = ['active', 'disconnected', 'expired'] as const;

export interface InternalHealthPayload {
  status: 'ok' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { ok: boolean; latencyMs: number | null };
    heartbeat: {
      ok: boolean;
      ageSeconds: number | null;
      lastRunAt: string | null;
      lastSuccessAt: string | null;
      lastSkipReason: string | null;
      claimed: number;
      settled: number;
    };
    queue: {
      dueCount: number;
      oldestDueAgeSeconds: number | null;
      stuckPublishingCount: number;
    };
    storage: { ok: boolean };
    facebook: {
      pagesByStatus: Record<string, number>;
      accountsByStatus: Record<string, number>;
    };
  };
}

export interface InternalHealthDeps {
  // Supabase-like client (service role). Typed loosely: the builder chain
  // shape differs per query, as elsewhere in this codebase.
  db?: any;
  checkStorage?: () => Promise<boolean>;
  now?: Date;
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function authorizeInternalRequest(
  request: Request
): Promise<boolean> {
  const internalToken = process.env.INTERNAL_HEALTH_TOKEN;
  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (internalToken && bearer && tokensMatch(bearer, internalToken)) {
    return true;
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = /(?:^|;\s*)fbup_session=([^;]+)/.exec(cookieHeader);
  if (match?.[1]) {
    try {
      const session = await verifySessionToken(
        decodeURIComponent(match[1]),
        getSessionSecret()
      );
      return session.role === 'admin';
    } catch {
      return false;
    }
  }
  return false;
}

async function defaultCheckStorage(): Promise<boolean> {
  const config = getR2Config();
  if (!config) return false;
  try {
    const client = createR2S3Client(config);
    await client.send(new HeadBucketCommand({ Bucket: config.bucketName }), {
      abortSignal: AbortSignal.timeout(R2_PROBE_TIMEOUT_MS),
    });
    return true;
  } catch {
    return false;
  }
}

async function countByStatus(
  db: any,
  table: string,
  statuses: readonly string[]
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    statuses.map(async (status) => {
      try {
        const { count, error } = await db
          .from(table)
          .select('id', { head: true, count: 'exact' })
          .eq('status', status);
        return [status, error ? 0 : (count ?? 0)] as const;
      } catch {
        return [status, 0] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

type HeartbeatCheck = InternalHealthPayload['checks']['heartbeat'];
type QueueCheck = InternalHealthPayload['checks']['queue'];

const EMPTY_HEARTBEAT: HeartbeatCheck = {
  ok: false,
  ageSeconds: null,
  lastRunAt: null,
  lastSuccessAt: null,
  lastSkipReason: null,
  claimed: 0,
  settled: 0,
};

const EMPTY_QUEUE: QueueCheck = {
  dueCount: 0,
  oldestDueAgeSeconds: null,
  stuckPublishingCount: 0,
};

async function checkHeartbeat(db: any, now: Date): Promise<HeartbeatCheck> {
  try {
    const { data, error } = await db
      .from('worker_heartbeats')
      .select(
        'last_run_at, last_success_at, last_claimed_count, last_settled_count, last_skip_reason'
      )
      .eq('worker_name', 'fbuploadpro-worker')
      .maybeSingle();
    if (error || !data) return EMPTY_HEARTBEAT;
    const lastSuccessAt = data.last_success_at as string | null;
    const ageSeconds = lastSuccessAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - new Date(lastSuccessAt).getTime()) / 1000)
        )
      : null;
    return {
      ok: ageSeconds !== null && ageSeconds <= HEARTBEAT_STALE_SECONDS,
      ageSeconds,
      lastRunAt: data.last_run_at ?? null,
      lastSuccessAt,
      lastSkipReason: data.last_skip_reason ?? null,
      claimed: Number(data.last_claimed_count ?? 0),
      settled: Number(data.last_settled_count ?? 0),
    };
  } catch {
    return EMPTY_HEARTBEAT;
  }
}

async function checkQueue(db: any, now: Date): Promise<QueueCheck> {
  try {
    const timestamp = now.toISOString();
    const stuckBefore = new Date(
      now.getTime() - STUCK_PUBLISHING_MINUTES * 60 * 1000
    ).toISOString();
    const dueQuery = await db
      .from('legacy_queue_items')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'queued')
      .lte('scheduled_time', timestamp);
    const stuckQuery = await db
      .from('legacy_queue_items')
      .select('id', { head: true, count: 'exact' })
      .eq('status', 'publishing')
      .lte('updated_at', stuckBefore);
    const { data: oldest } = await db
      .from('legacy_queue_items')
      .select('scheduled_time')
      .eq('status', 'queued')
      .lte('scheduled_time', timestamp)
      .order('scheduled_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    let oldestDueAgeSeconds: number | null = null;
    if (oldest?.scheduled_time) {
      oldestDueAgeSeconds = Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(oldest.scheduled_time).getTime()) / 1000
        )
      );
    }
    return {
      dueCount: dueQuery.error ? 0 : (dueQuery.count ?? 0),
      oldestDueAgeSeconds,
      stuckPublishingCount: stuckQuery.error ? 0 : (stuckQuery.count ?? 0),
    };
  } catch {
    return EMPTY_QUEUE;
  }
}

export async function probeInternalHealth(
  deps?: InternalHealthDeps
): Promise<{ statusCode: number; payload: InternalHealthPayload }> {
  const now = deps?.now ?? new Date();
  const timestamp = now.toISOString();
  const db = deps?.db ?? getSupabaseAdminClient();

  if (!db) {
    return {
      statusCode: 503,
      payload: {
        status: 'unhealthy',
        timestamp,
        checks: {
          database: { ok: false, latencyMs: null },
          heartbeat: EMPTY_HEARTBEAT,
          queue: EMPTY_QUEUE,
          storage: { ok: false },
          facebook: { pagesByStatus: {}, accountsByStatus: {} },
        },
      },
    };
  }

  // Database + latency
  const dbStart = Date.now();
  let dbOk = false;
  try {
    const { error } = await db
      .from('workspaces')
      .select('id', { head: true, count: 'exact' });
    dbOk = !error;
  } catch {
    dbOk = false;
  }
  const latencyMs = dbOk ? Date.now() - dbStart : null;

  const heartbeat = await checkHeartbeat(db, now);
  const queue = await checkQueue(db, now);

  const storageOk = deps?.checkStorage
    ? await deps.checkStorage()
    : await defaultCheckStorage();

  const [pagesByStatus, accountsByStatus] = await Promise.all([
    countByStatus(db, 'facebook_pages', PAGE_STATUSES),
    countByStatus(db, 'facebook_accounts', ACCOUNT_STATUSES),
  ]);

  const unhealthy = !dbOk || !heartbeat.ok || !storageOk;
  let status: InternalHealthPayload['status'] = 'ok';
  if (unhealthy) {
    status = 'unhealthy';
  } else if (queue.stuckPublishingCount > 0) {
    status = 'degraded';
  }

  return {
    statusCode: unhealthy ? 503 : 200,
    payload: {
      status,
      timestamp,
      checks: {
        database: { ok: dbOk, latencyMs },
        heartbeat,
        queue,
        storage: { ok: storageOk },
        facebook: { pagesByStatus, accountsByStatus },
      },
    },
  };
}

export async function GET(request: Request) {
  if (!(await authorizeInternalRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await probeInternalHealth();
  return NextResponse.json(result.payload, {
    status: result.statusCode,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
