import { type NextRequest, NextResponse } from 'next/server';
import {
  DisconnectAccountResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleDisconnectAccount(
  request: NextRequest,
  subdomain: string,
  accountId: string,
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

  // 3. Count connected pages prior to cascade deletion
  const countRows = (await db.query(
    'SELECT COUNT(*)::int AS count FROM facebook_pages WHERE facebook_account_id = $1 AND user_id = $2',
    [accountId, session.userId]
  )) as any[];
  const disconnectedPagesCount = Number(countRows?.[0]?.count ?? 0);

  // 4. Delete account record (foreign key ON DELETE CASCADE safely removes linked pages)
  const result = (await db.query(
    'DELETE FROM facebook_accounts WHERE id = $1 AND user_id = $2 RETURNING id',
    [accountId, session.userId]
  )) as any[];

  if (!result || result.length === 0) {
    return NextResponse.json(
      { error: 'Facebook account not found' },
      { status: 404 }
    );
  }

  const responsePayload = DisconnectAccountResponseSchema.parse({
    success: true,
    accountId,
    disconnectedPagesCount,
  });

  return NextResponse.json(responsePayload);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; accountId: string }> }
): Promise<NextResponse> {
  const { subdomain, accountId } = await context.params;
  return handleDisconnectAccount(request, subdomain, accountId);
}
