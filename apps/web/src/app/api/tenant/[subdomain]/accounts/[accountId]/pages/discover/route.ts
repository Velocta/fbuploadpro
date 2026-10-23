import { type NextRequest, NextResponse } from 'next/server';
import { extractActiveSession } from '@/lib/route-auth';
import {
  canAccessTenant,
  decryptToken,
  DiscoverPagesResponseSchema,
  fetchAllFacebookPages,
  getTokenEncryptionKey,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleDiscoverPages(
  request: NextRequest,
  subdomain: string,
  accountId: string,
  dbClient?: DatabaseClient | SupabaseClient<Database>
): Promise<NextResponse> {
  const encryptionKey = getTokenEncryptionKey();

  // 1. Session auth guard
  const session = await extractActiveSession(request);
  if (!session) {
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
  // Row shapes as consumed below (spec 137 §3.7): the account fields this
  // handler reads, in both the snake_case (SQL/Supabase) and camelCase
  // (legacy) spellings, and the imported-page id rows.
  interface AccountLookupRow {
    encrypted_access_token?: string | null;
    encryptedAccessToken?: string | null;
    display_name?: string | null;
    displayName?: string | null;
  }
  interface ImportedPageIdRow {
    fb_page_id: string;
    fbPageId?: string;
  }
  let account: AccountLookupRow | null = null;
  let importedRows: ImportedPageIdRow[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    const accounts = await dbClient.query<AccountLookupRow>(
      'SELECT * FROM facebook_accounts WHERE id = $1 AND user_id = $2 AND workspace_id = $3',
      [accountId, session.userId, workspaceId]
    );

    if (!accounts || accounts.length === 0 || !accounts[0]) {
      return NextResponse.json(
        { error: 'Facebook account not found' },
        { status: 404 }
      );
    }
    account = accounts[0];

    importedRows = await dbClient.query<ImportedPageIdRow>(
      "SELECT fb_page_id FROM facebook_pages WHERE user_id = $1 AND workspace_id = $2 AND status != 'disconnected'",
      [session.userId, workspaceId]
    );
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
  if (!encryptedToken) {
    return NextResponse.json(
      { error: 'Failed to decrypt account credentials' },
      { status: 500 }
    );
  }

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
  let rawItems: Awaited<ReturnType<typeof fetchAllFacebookPages>> = [];
  try {
    rawItems = await fetchAllFacebookPages(
      rawToken,
      'id,name,category,tasks,access_token,followers_count,picture{url}'
    );
  } catch (err: unknown) {
    const status =
      err !== null &&
      typeof err === 'object' &&
      'status' in err &&
      typeof err.status === 'number'
        ? err.status
        : 500;
    return NextResponse.json(
      { error: 'Failed to query Facebook Graph API' },
      { status }
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
