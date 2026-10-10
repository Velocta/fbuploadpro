import { type NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  encryptToken,
  ImportPagesRequestSchema,
  ImportPagesResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleImportPages(
  request: NextRequest,
  subdomain: string,
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

  // 3. Parse request body
  let bodyJson: unknown;
  try {
    bodyJson = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = ImportPagesRequestSchema.safeParse(bodyJson);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid request payload', details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const { accountId, selectedPageIds } = parseResult.data;
  const db = dbClient ?? getDbClient();

  // 4. Verify account ownership
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

  // 5. Query Facebook Graph API v26.0 /me/accounts
  const graphUrl = new URL('https://graph.facebook.com/v26.0/me/accounts');
  graphUrl.searchParams.set(
    'fields',
    'id,name,category,tasks,access_token,followers_count'
  );

  const graphRes = await fetch(graphUrl.toString(), {
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

  const selectedSet = new Set(selectedPageIds);
  const matchedPages = rawItems.filter((item) => selectedSet.has(String(item.id)));

  const importPromises = matchedPages.map(async (pageItem) => {
    const rawPageToken = pageItem.access_token || rawToken;
    const encryptedPageToken = await encryptToken(rawPageToken, encryptionKey);

    const followers =
      typeof pageItem.followers_count === 'number'
        ? Math.max(0, pageItem.followers_count)
        : 0;
    const tasksJson = JSON.stringify(Array.isArray(pageItem.tasks) ? pageItem.tasks : []);

    const result = (await db.query(
      `INSERT INTO facebook_pages (
        user_id, facebook_account_id, fb_page_id, page_name, category, tasks, followers_count, encrypted_access_token
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, fb_page_id) DO UPDATE SET
        facebook_account_id = EXCLUDED.facebook_account_id,
        page_name = EXCLUDED.page_name,
        category = EXCLUDED.category,
        tasks = EXCLUDED.tasks,
        followers_count = EXCLUDED.followers_count,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        status = 'active',
        updated_at = now()
      RETURNING id, fb_page_id, page_name`,
      [
        session.userId,
        accountId,
        String(pageItem.id),
        String(pageItem.name),
        pageItem.category ?? null,
        tasksJson,
        followers,
        encryptedPageToken,
      ]
    )) as any[];

    if (result && result.length > 0 && result[0]) {
      const row = result[0];
      return {
        id: row.id,
        fbPageId: row.fb_page_id || row.fbPageId,
        pageName: row.page_name || row.pageName,
      };
    }
    return null;
  });

  const resolved = await Promise.all(importPromises);
  const importedList = resolved.filter(
    (item): item is { id: string; fbPageId: string; pageName: string } => item !== null
  );

  const responsePayload = ImportPagesResponseSchema.parse({
    success: true,
    importedCount: importedList.length,
    pages: importedList,
  });

  return NextResponse.json(responsePayload);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleImportPages(request, subdomain);
}
