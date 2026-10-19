import { NextRequest, NextResponse } from 'next/server';
import {
  BulkEnqueueRequestSchema,
  BulkEnqueueResponseSchema,
  canAccessTenant,
  getSessionSecret,
  verifySessionToken,
  type BulkQueueItem,
  type BulkEnqueueItemResult,
} from '@fbuploadpro/contracts';
import { handleEnqueueMedia } from '../route';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';

const SINGLE_QUEUE_PATH = '/publishing/queue';

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
  item: BulkQueueItem
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

    const response = await handleEnqueueMedia(singleRequest, subdomain);
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
 * Bulk-add queue items. Each row is enqueued through the same single-item
 * handler, so validation, tenant/page checks, and storage behavior are
 * identical to adding posts one at a time. Per-item results are collected so
 * partial failures are reportable instead of failing the whole run.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  const sessionSecret = getSessionSecret();

  // 1. Session auth guard
  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch (_e) {
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
  const workspaceId = await resolveTenantWorkspaceId(undefined, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // 5. Enqueue each item through the single-item handler. Sequential on purpose:
  // per-item results must map 1:1 onto the client's rows, and 150 parallel
  // writes would needlessly hammer the database.
  const results: EnqueueBulkItemResult[] = [];
  for (const item of items) {
    results.push(await enqueueBulkItem(request, subdomain, pageId, item));
  }

  const validated = BulkEnqueueResponseSchema.parse({ results });
  return NextResponse.json(validated, { status: 200 });
}
