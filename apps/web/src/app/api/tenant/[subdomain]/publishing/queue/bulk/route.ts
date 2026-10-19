import { NextRequest, NextResponse } from 'next/server';
import {
  BulkEnqueueRequestSchema,
  BulkEnqueueResponseSchema,
  canAccessTenant,
  getSessionSecret,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { handleEnqueueMedia } from '../route';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';

const SINGLE_QUEUE_PATH = '/publishing/queue';

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

  // 5. Enqueue each item through the single-item handler. The cookie header is
  // forwarded so the inner handler authenticates exactly like a direct call.
  const singleUrl = new URL(request.url);
  singleUrl.pathname = singleUrl.pathname.replace(/\/bulk\/?$/, SINGLE_QUEUE_PATH);

  const results: Array<{ ok: boolean; itemId?: string; error?: string }> = [];

  for (const item of items) {
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
        results.push({ ok: true, itemId: data.id });
      } else {
        const message =
          typeof data.message === 'string'
            ? data.message
            : typeof data.error === 'string'
              ? data.error
              : 'Could not add this post.';
        results.push({ ok: false, error: message });
      }
    } catch (_e) {
      results.push({ ok: false, error: 'Could not add this post. Please try again.' });
    }
  }

  const validated = BulkEnqueueResponseSchema.parse({ results });
  return NextResponse.json(validated, { status: 200 });
}
