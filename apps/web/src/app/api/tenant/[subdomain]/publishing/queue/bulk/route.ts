import { NextRequest, NextResponse } from 'next/server';
import { extractActiveSession } from '@/lib/route-auth';
import {
  BulkEnqueueRequestSchema,
  BulkEnqueueResponseSchema,
  canAccessTenant,
  type BulkQueueItem,
  type BulkEnqueueItemResult,
} from '@fbuploadpro/contracts';
import { handleEnqueueMedia, type EnqueueMediaPrefetch, type QueueMediaRecord } from '../route';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import { getRouteSupabase, isLegacyClient } from '@/lib/route-auth';
import type { DatabaseClient } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

const SINGLE_QUEUE_PATH = '/publishing/queue';

/**
 * Maximum number of per-item enqueue chains running at once in a bulk
 * request (spec 139 A15). The old loop was fully sequential — up to 150
 * items × several DB round-trips in series, long enough to hit the
 * serverless duration wall. Eight concurrent chains bound the database
 * load while cutting wall time roughly eightfold; per-item results are
 * still written back by index, so ordering is unchanged.
 */
export const BULK_ENQUEUE_CONCURRENCY = 8;

function errorMessageFrom(data: Record<string, unknown>): string {
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  return 'Could not add this post.';
}

type EnqueueBulkItemResult = Pick<BulkEnqueueItemResult, 'ok' | 'itemId' | 'error'>;

/**
 * Enqueues one bulk row through the single-item handler, so validation,
 * tenant/page checks, and storage behavior are identical to adding posts one
 * at a time. A failed row is reported per row — it never fails the whole run.
 */
async function enqueueBulkItem(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  item: BulkQueueItem,
  dbClient?: DatabaseClient | SupabaseClient,
  prefetch?: EnqueueMediaPrefetch
): Promise<EnqueueBulkItemResult> {
  const singleUrl = new URL(request.url);
  singleUrl.pathname = singleUrl.pathname.replace(/\/bulk\/?$/, SINGLE_QUEUE_PATH);

  try {
    const singleRequest = new NextRequest(singleUrl.toString(), {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        pageId,
        mediaId: item.mediaId ?? null,
        postFormat: item.format,
        caption: item.caption,
        linkUrl: item.linkUrl ?? null,
        scheduledTime: item.scheduledTime,
      }),
    });

    const response = await handleEnqueueMedia(singleRequest, subdomain, dbClient, prefetch);
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    if (response.status === 201 && typeof data.id === 'string') {
      return { ok: true, itemId: data.id };
    }
    return { ok: false, error: errorMessageFrom(data) };
  } catch {
    return { ok: false, error: 'Could not add this post. Please try again.' };
  }
}

/**
 * Batches the per-item READS a bulk run shares (spec 139 A15): the target
 * page row once, and every referenced media row in a single `.in()`
 * query, instead of re-querying both for every one of up to 150 items.
 * Only the Supabase path prefetches — a prefetch miss is exactly the
 * per-item query returning no row (per-item "Page not found" / "Media
 * not found" results are unchanged). Returns undefined when there is no
 * Supabase client to prefetch from, in which case per-item calls read
 * live exactly as before.
 */
async function buildEnqueuePrefetch(
  dbClient: DatabaseClient | SupabaseClient | undefined,
  workspaceId: string,
  pageId: string,
  userId: string,
  items: BulkQueueItem[]
): Promise<EnqueueMediaPrefetch | undefined> {
  if (isLegacyClient(dbClient)) return undefined;
  const supabase = getRouteSupabase(dbClient);
  if (!supabase) return undefined;

  const { data: page } = await supabase
    .from('facebook_pages')
    .select('id, timezone')
    .eq('id', pageId)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const mediaIds = [...new Set(items.map((item) => item.mediaId).filter((id): id is string => Boolean(id)))];
  const mediaById = new Map<string, QueueMediaRecord>();
  if (mediaIds.length > 0) {
    const { data: mediaRows } = await supabase
      .from('media_items')
      .select('id, name, media_type, url, thumbnail_url, aspect_ratio, duration_seconds, width, height')
      .eq('user_id', userId)
      .in('id', mediaIds);
    for (const row of (mediaRows ?? []) as QueueMediaRecord[]) {
      mediaById.set(row.id, row);
    }
  }

  return { workspaceId, page: page ?? null, mediaById };
}

/**
 * Runs the per-item enqueue chains through a bounded-concurrency pool.
 * Results are stored by item index, so the response order always matches
 * the request order regardless of completion order, and one item's
 * failure never affects the others (enqueueBulkItem already converts
 * failures into per-item results).
 */
async function enqueueBulkItems(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  items: BulkQueueItem[],
  dbClient?: DatabaseClient | SupabaseClient,
  prefetch?: EnqueueMediaPrefetch
): Promise<EnqueueBulkItemResult[]> {
  const results: EnqueueBulkItemResult[] = new Array(items.length) as EnqueueBulkItemResult[];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await enqueueBulkItem(request, subdomain, pageId, items[index]!, dbClient, prefetch);
    }
  }

  const workerCount = Math.min(BULK_ENQUEUE_CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Bulk-add queue items. Each row is enqueued through the same single-item
 * handler, so validation, tenant/page checks, and storage behavior are
 * identical to adding posts one at a time. Per-item results are collected so
 * partial failures are reportable instead of failing the whole run.
 */
export async function handleBulkEnqueue(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient
): Promise<NextResponse> {


  // 1. Session auth guard
  const session = await extractActiveSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Tenant isolation check
  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Request body validation (150-cap enforced by the schema)
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = BulkEnqueueRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { pageId, items } = parsed.data;

  // 4. Workspace must exist before touching any items
  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // 5. Batch the shared per-item reads once (workspace already resolved
  // above; page + media here), then run the per-item write chains
  // through the bounded-concurrency pool. Results map 1:1 onto the
  // client's rows, in request order.
  const prefetch = await buildEnqueuePrefetch(dbClient, workspaceId, pageId, session.userId, items);
  const results = await enqueueBulkItems(request, subdomain, pageId, items, dbClient, prefetch);

  const validated = BulkEnqueueResponseSchema.parse({ results });
  return NextResponse.json(validated, { status: 200 });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleBulkEnqueue(request, subdomain);
}
