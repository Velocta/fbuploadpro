import { type NextRequest, NextResponse } from 'next/server';
import {
  evaluateAccountHealth,
  ListFacebookAccountsResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleListAccounts(
  request: NextRequest,
  subdomain: string,
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

  // 3. Query connected accounts with connected page count aggregation
  const rows = (await db.query(
    `SELECT 
      a.id,
      a.fb_account_id,
      a.display_name,
      a.status,
      a.token_expires_at,
      a.created_at,
      a.updated_at,
      COUNT(p.id)::int AS connected_pages_count
    FROM facebook_accounts a
    LEFT JOIN facebook_pages p ON p.facebook_account_id = a.id AND p.user_id = a.user_id
    WHERE a.user_id = $1
    GROUP BY a.id, a.fb_account_id, a.display_name, a.status, a.token_expires_at, a.created_at, a.updated_at
    ORDER BY a.created_at DESC`,
    [session.userId]
  )) as any[];

  const accounts = (rows || []).map((row) => {
    const rawExpiresAt = row.token_expires_at || row.tokenExpiresAt;
    const tokenExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
    const computedStatus = evaluateAccountHealth({
      status: row.status ?? 'active',
      tokenExpiresAt,
    });

    return {
      id: row.id,
      fbAccountId: row.fb_account_id || row.fbAccountId,
      displayName: row.display_name || row.displayName,
      status: computedStatus,
      tokenExpiresAt,
      connectedPagesCount: Number(
        row.connected_pages_count ?? row.connectedPagesCount ?? 0
      ),
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };
  });

  const responsePayload = ListFacebookAccountsResponseSchema.parse({
    accounts,
    total: accounts.length,
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListAccounts(request, subdomain);
}
