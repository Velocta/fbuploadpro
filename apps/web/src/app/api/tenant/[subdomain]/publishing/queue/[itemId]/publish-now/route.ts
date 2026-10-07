import { type NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handlePublishNow(
  request: NextRequest,
  subdomain: string,
  itemId: string,
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

  // 3. Check existing item
  const existingRows = (await db.query(
    `SELECT id, user_id, status FROM queue_items WHERE id = $1 AND user_id = $2`,
    [itemId, session.userId]
  )) as any[];

  if (!existingRows || existingRows.length === 0) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  }

  const existing = existingRows[0];
  if (existing.status === 'published') {
    return NextResponse.json(
      { error: 'ALREADY_PUBLISHED', message: 'Item has already been published' },
      { status: 400 }
    );
  }

  // 4. Update scheduled_time to now() and status to 'queued'
  await db.query(
    `UPDATE queue_items
     SET scheduled_time = now(),
         status = 'queued',
         updated_at = now()
     WHERE id = $1 AND user_id = $2`,
    [itemId, session.userId]
  );

  return NextResponse.json(
    {
      success: true,
      message: 'Item dispatched for immediate publishing',
    },
    { status: 200 }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; itemId: string }> }
): Promise<NextResponse> {
  const { subdomain, itemId } = await context.params;
  return handlePublishNow(request, subdomain, itemId);
}
