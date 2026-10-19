import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  decryptToken,
  DiscoverPagesResponseSchema,
  fetchAllFacebookPages,
  getSessionSecret,
  getTokenEncryptionKey,
  verifySessionToken,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/supabase-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleDiscoverPages(
  request: NextRequest,
  subdomain: string,
  accountId: string,
  dbClient?: DatabaseClient | SupabaseClient<Database>
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
  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Resolve workspace ID scoped to user (supports admin inspection)
  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // 4. Fetch account and composite ownership (user_id, workspace_id, accountId)
  let account: any = null;
  let importedRows: any[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    const accounts = (await dbClient.query(
      'SELECT * FROM facebook_accounts WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [accountId, session.userId, workspaceId]
    )) as Record<string, unknown>[];

    if (!accounts || accounts.length === 0 || !accounts[0]) {
      return NextResponse.json(
        { error: 'Facebook account not found' },
        { status: 404 }
      );
    }
    account = accounts[0];

    importedRows = (await dbClient.query(
      "SELECT fb_page_id FROM facebook_pages WHERE user_id = $1 AND workspace_id = $2 AND status != 'disconnected'",
      [session.userId, workspaceId]
    )) as Record<string, unknown>[];
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

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

    const { data: pageRows } = await supabase
      .from('facebook_pages')
      .select('fb_page_id')
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .neq('status', 'disconnected');

    importedRows = pageRows || [];
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

  // 4. Query Facebook Graph API v26.0 /me/accounts with pagination
  let rawItems: any[] = [];
  try {
    rawItems = await fetchAllFacebookPages(
      rawToken,
      'id,name,category,tasks,access_token,followers_count,picture{url}'
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to query Facebook Graph API' },
      { status: typeof err?.status === 'number' ? err.status : 500 }
    );
  }

  // 5. Query already imported active/linked pages for this user to compute isImported
  const importedPageIds = new Set(
    importedRows.map((r) => r.fb_page_id || r.fbPageId)
  );

  // 6. Strictly filter for authentic Facebook Pages (ignore groups or malformed nodes)
  const discoveredPages = rawItems
    .filter((item) => item.id && item.name && (item.category || item.tasks))
    .map((item) => {
      const followers =
        typeof item.followers_count === 'number'
          ? Math.max(0, item.followers_count)
          : 0;
      return {
        fbPageId: String(item.id),
        pageName: String(item.name),
        profilePictureUrl: item.picture?.data?.url ?? null,
        category: item.category ?? null,
        currentFollowers: followers,
        followersCount: followers,
        tasks: Array.isArray(item.tasks) ? item.tasks : [],
        isImported: importedPageIds.has(String(item.id)),
      };
    });

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
