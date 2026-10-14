import { type NextRequest, NextResponse } from 'next/server';
import {
  decryptToken,
  encryptToken,
  getSessionSecret,
  getTokenEncryptionKey,
  ImportPagesRequestSchema,
  ImportPagesResponseSchema,
  verifySessionToken,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleImportPages(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();
  const encryptionKey = getTokenEncryptionKey();

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

  // 4. Verify account ownership scoped to workspace
  let account: any = null;
  let workspaceId = '';

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    const wsRows = (await dbClient.query(
      'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1',
      [subdomain, session.userId]
    )) as Array<{ id: string }>;
    if (!wsRows?.[0]?.id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    workspaceId = wsRows[0].id;

    const accounts = (await dbClient.query(
      'SELECT * FROM facebook_accounts WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [accountId, session.userId, workspaceId]
    )) as any[];

    if (!accounts || accounts.length === 0 || !accounts[0]) {
      return NextResponse.json(
        { error: 'Facebook account not found' },
        { status: 404 }
      );
    }
    account = accounts[0];
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: ws, error: wsErr } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', subdomain)
      .eq('owner_id', session.userId)
      .maybeSingle();

    const wsRecord = ws as { id?: string } | null;
    const resolvedWorkspaceId = wsRecord?.id;

    if (wsErr || !resolvedWorkspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    workspaceId = resolvedWorkspaceId;

    const { data: accData, error: accErr } = await supabase
      .from('facebook_accounts')
      .select('*')
      .eq('id', accountId)
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (accErr || !accData) {
      return NextResponse.json(
        { error: 'Facebook account not found' },
        { status: 404 }
      );
    }
    account = accData;
  }

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
    'id,name,category,tasks,access_token,followers_count,picture{url}'
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

  // Query existing pages before upserting via Supabase to preserve starting_followers for active pages
  const isSupabaseMode =
    !dbClient || !('query' in dbClient) || typeof dbClient.query !== 'function';
  const existingPagesMap = new Map<
    string,
    { status: string; starting_followers: number | null }
  >();

  if (isSupabaseMode && matchedPages.length > 0) {
    const supabase = (
      dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()
    ) as SupabaseClient<any> | null;
    if (supabase) {
      const pageFbIds = matchedPages.map((item) => String(item.id));
      const { data: existingRows } = await supabase
        .from('facebook_pages')
        .select('fb_page_id, status, starting_followers')
        .eq('user_id', session.userId)
        .in('fb_page_id', pageFbIds);

      if (Array.isArray(existingRows)) {
        for (const row of existingRows) {
          if (row?.fb_page_id) {
            existingPagesMap.set(String(row.fb_page_id), {
              status: row.status,
              starting_followers:
                typeof row.starting_followers === 'number'
                  ? row.starting_followers
                  : null,
            });
          }
        }
      }
    }
  }

  const importPromises = matchedPages.map(async (pageItem) => {
    const rawPageToken = pageItem.access_token || rawToken;
    const encryptedPageToken = await encryptToken(rawPageToken, encryptionKey);

    const followers =
      typeof pageItem.followers_count === 'number'
        ? Math.max(0, pageItem.followers_count)
        : 0;
    const tasksJson = JSON.stringify(Array.isArray(pageItem.tasks) ? pageItem.tasks : []);
    const profilePictureUrl = pageItem.picture?.data?.url ?? null;

    if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
      const result = (await dbClient.query(
        `INSERT INTO facebook_pages (
          user_id, workspace_id, facebook_account_id, fb_page_id, page_name, category, tasks, starting_followers, current_followers, encrypted_access_token, profile_picture_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
        ON CONFLICT (workspace_id, fb_page_id) DO UPDATE SET
          facebook_account_id = EXCLUDED.facebook_account_id,
          page_name = EXCLUDED.page_name,
          category = EXCLUDED.category,
          tasks = EXCLUDED.tasks,
          current_followers = EXCLUDED.current_followers,
          starting_followers = CASE
            WHEN facebook_pages.status = 'disconnected' THEN EXCLUDED.starting_followers
            ELSE facebook_pages.starting_followers
          END,
          encrypted_access_token = EXCLUDED.encrypted_access_token,
          profile_picture_url = EXCLUDED.profile_picture_url,
          status = 'active',
          updated_at = now()
        RETURNING id, fb_page_id, page_name`,
        [
          session.userId,
          workspaceId,
          accountId,
          String(pageItem.id),
          String(pageItem.name),
          pageItem.category ?? null,
          tasksJson,
          followers,
          encryptedPageToken,
          profilePictureUrl,
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
    } else {
      const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<any> | null;
      if (!supabase) return null;

      const existingPage = existingPagesMap.get(String(pageItem.id));
      const preserveBaseline =
        existingPage &&
        existingPage.status !== 'disconnected' &&
        existingPage.starting_followers !== null &&
        existingPage.starting_followers !== undefined;
      const startingFollowersToSave = preserveBaseline
        ? existingPage.starting_followers
        : followers;

      const { data: upserted, error: upsertErr } = await supabase
        .from('facebook_pages')
        .upsert(
          {
            user_id: session.userId,
            workspace_id: workspaceId,
            facebook_account_id: accountId,
            fb_page_id: String(pageItem.id),
            page_name: String(pageItem.name),
            category: pageItem.category ?? null,
            tasks: Array.isArray(pageItem.tasks) ? pageItem.tasks : [],
            starting_followers: startingFollowersToSave,
            current_followers: followers,
            encrypted_access_token: encryptedPageToken,
            profile_picture_url: profilePictureUrl,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id,fb_page_id' }
        )
        .select('id, fb_page_id, page_name')
        .single();

      if (upsertErr || !upserted) return null;
      return {
        id: upserted.id,
        fbPageId: upserted.fb_page_id,
        pageName: upserted.page_name,
      };
    }
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
