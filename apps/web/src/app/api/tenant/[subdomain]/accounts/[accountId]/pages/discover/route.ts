import { type NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  DiscoverPagesResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleDiscoverPages(
  request: NextRequest,
  subdomain: string,
  accountId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || '';

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

  // 3. Fetch account and composite ownership (user_id, accountId)
  const accounts = (await db.query(
    'SELECT * FROM facebook_accounts WHERE id = $1 AND user_id = $2',
    [accountId, session.userId]
  )) as any[];

  if (!accounts || accounts.length === 0 || !accounts[0]) {
    return NextResponse.json(
      { error: 'Facebook account not found' },
      { status: 404 }
    );
  }

  const account = accounts[0];
  const encryptedToken =
    account.encrypted_access_token || account.encryptedAccessToken;

  let rawToken: string;
  try {
    rawToken = await decryptToken(encryptedToken, encryptionKey);
  } catch (_e) {
    return NextResponse.json(
      { error: 'Failed to decrypt account credentials' },
      { status: 500 }
    );
  }

  // 4. Query Facebook Graph API v26.0 /me/accounts
  const discoverEndpoint =
    'https://graph.facebook.com/v26.0/me/accounts?fields=id,name,category,tasks,access_token,followers_count,picture{url}';

  const graphRes = await fetch(discoverEndpoint, {
    headers: {
      Authorization: `Bearer ${rawToken}`,
    },
  });

  if (!graphRes.ok) {
    return NextResponse.json(
      { error: 'Failed to query Facebook Graph API' },
      { status: graphRes.status }
    );
  }

  const graphData = await graphRes.json();
  const rawItems: any[] = Array.isArray(graphData.data) ? graphData.data : [];

  // 5. Query already imported pages for this user to compute isImported
  const importedRows = (await db.query(
    'SELECT fb_page_id FROM facebook_pages WHERE user_id = $1',
    [session.userId]
  )) as any[];
  const importedPageIds = new Set(
    importedRows.map((r) => r.fb_page_id || r.fbPageId)
  );

  // 6. Strictly filter for authentic Facebook Pages (ignore groups or malformed nodes)
  const discoveredPages = rawItems
    .filter((item) => item.id && item.name && (item.category || item.tasks))
    .map((item) => ({
      fbPageId: String(item.id),
      pageName: String(item.name),
      profilePictureUrl: item.picture?.data?.url ?? null,
      category: item.category ?? null,
      followersCount:
        typeof item.followers_count === 'number'
          ? Math.max(0, item.followers_count)
          : 0,
      tasks: Array.isArray(item.tasks) ? item.tasks : [],
      isImported: importedPageIds.has(String(item.id)),
    }));

  const responsePayload = DiscoverPagesResponseSchema.parse({
    accountId,
    accountDisplayName: account.display_name || account.displayName,
    pages: discoveredPages,
    total: discoveredPages.length,
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; accountId: string }> }
): Promise<NextResponse> {
  const { subdomain, accountId } = await context.params;
  return handleDiscoverPages(request, subdomain, accountId);
}
