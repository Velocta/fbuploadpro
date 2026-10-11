import { type NextRequest, NextResponse } from 'next/server';
import {
  DisconnectPageResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleDisconnectPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

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
  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = dbClient ?? getDbClient();

  // 3. Soft-delete page record scoped to user_id (status = 'disconnected', wipe encrypted token)
  const result = (await db.query(
    `UPDATE facebook_pages
     SET status = 'disconnected',
         encrypted_access_token = '',
         updated_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING id, fb_page_id`,
    [pageId, session.userId]
  )) as any[];

  if (!result || result.length === 0 || !result[0]) {
    return NextResponse.json(
      { error: 'Facebook page not found' },
      { status: 404 }
    );
  }

  const fbPageId = result[0].fb_page_id || result[0].fbPageId;
  if (fbPageId) {
    await db.query(
      `UPDATE queue_items
       SET status = 'cancelled',
           updated_at = now()
       WHERE user_id = $1 AND fb_page_id = $2 AND status = 'queued'`,
      [session.userId, String(fbPageId)]
    );
  }

  const responsePayload = DisconnectPageResponseSchema.parse({
    success: true,
    pageId,
  });

  return NextResponse.json(responsePayload);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleDisconnectPage(request, subdomain, pageId);
}
