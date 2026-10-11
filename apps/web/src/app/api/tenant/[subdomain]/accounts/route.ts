import { type NextRequest, NextResponse } from 'next/server';
import {
  evaluateAccountHealth,
  ListFacebookAccountsResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

function mapAccountRowToView(row: Record<string, any>) {
  const rawExpiresAt = row.token_expires_at || row.tokenExpiresAt;
  const tokenExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
  const computedStatus = evaluateAccountHealth({
    status: row.status ?? 'active',
    tokenExpiresAt,
  });
  const rawConnectedPages = row.connected_pages ?? row.connectedPages;

  return {
    id: row.id,
    fbAccountId: row.fb_account_id || row.fbAccountId,
    displayName: row.display_name || row.displayName,
    profilePictureUrl:
      row.profile_picture_url ?? row.profilePictureUrl ?? null,
    gender: row.gender ?? null,
    accountLink: row.account_link ?? row.accountLink ?? null,
    status: computedStatus,
    tokenExpiresAt,
    connectedPagesCount: Number(
      row.connected_pages_count ?? row.connectedPagesCount ?? 0
    ),
    connectedPages: Array.isArray(rawConnectedPages) ? rawConnectedPages : [],
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

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

  // 3. Query connected accounts with connected page count and linked pages aggregation
  const rows = (await db.query(
    `SELECT
      fa.id,
      fa.fb_account_id,
      fa.display_name,
      fa.profile_picture_url,
      fa.gender,
      fa.account_link,
      fa.status,
      fa.token_expires_at,
      fa.created_at,
      fa.updated_at,
      COUNT(fp.id)::int AS connected_pages_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', fp.id,
            'pageName', fp.page_name,
            'profilePictureUrl', fp.profile_picture_url
          ) ORDER BY fp.page_name ASC
        ) FILTER (WHERE fp.id IS NOT NULL),
        '[]'::json
      ) AS connected_pages
    FROM facebook_accounts fa
    LEFT JOIN facebook_pages fp
      ON fp.facebook_account_id = fa.id
      AND fp.user_id = fa.user_id
      AND fp.status != 'disconnected'
    WHERE fa.user_id = $1
    GROUP BY fa.id
    ORDER BY fa.created_at DESC`,
    [session.userId]
  )) as Array<Record<string, any>>;

  const accounts = (rows || []).map(mapAccountRowToView);

  accounts.sort((a, b) => {
    const aExpired = a.status === 'expired' ? 1 : 0;
    const bExpired = b.status === 'expired' ? 1 : 0;
    if (aExpired !== bExpired) {
      return bExpired - aExpired;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
