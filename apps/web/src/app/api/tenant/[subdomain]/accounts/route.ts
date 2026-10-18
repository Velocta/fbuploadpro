import { type NextRequest, NextResponse } from 'next/server';
import {
  evaluateAccountHealth,
  getSessionSecret,
  ListFacebookAccountsResponseSchema,
  verifySessionToken,
  isSessionAuthorizedForSubdomain,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/supabase-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';

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

function syncExpiredAccountStatus(
  accountId: string,
  userId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): void {
  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    dbClient.query(
      `UPDATE facebook_accounts
       SET status = 'expired', updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    ).catch((err: any) => {
      console.error('[handleListAccounts] Failed to persist expired account status:', err);
    });
    return;
  }

  const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient<any> | null;
  if (!supabase) return;

  supabase
    .from('facebook_accounts')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('user_id', userId)
    .then(({ error }: { error: any }) => {
      if (error) {
        console.error('[handleListAccounts] Failed to persist expired account status via Supabase:', error);
      }
    });
}

async function fetchLegacyAccounts(
  dbClient: DatabaseClient,
  workspaceId: string,
  userId: string
): Promise<Array<Record<string, any>>> {
  return (await dbClient.query(
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
      AND fp.workspace_id = fa.workspace_id
      AND fp.status != 'disconnected'
    WHERE fa.user_id = $1 AND fa.workspace_id = $2
    GROUP BY fa.id
    ORDER BY fa.created_at DESC`,
    [userId, workspaceId]
  )) as Array<Record<string, any>>;
}

async function fetchSupabaseAccounts(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string
): Promise<{ rows?: Array<Record<string, any>>; error?: string }> {
  const { data: accountsData, error } = await supabase
    .from('facebook_accounts')
    .select(`
      id,
      fb_account_id,
      display_name,
      profile_picture_url,
      gender,
      account_link,
      status,
      token_expires_at,
      created_at,
      updated_at,
      facebook_pages (
        id,
        page_name,
        profile_picture_url,
        status,
        workspace_id
      )
    `)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const rows = (accountsData || []).map((acc: any) => {
    const activePages = (acc.facebook_pages || []).filter(
      (p: any) => p.status !== 'disconnected' && p.workspace_id === workspaceId
    );
    return {
      ...acc,
      connected_pages_count: activePages.length,
      connected_pages: activePages.map((p: any) => ({
        id: p.id,
        pageName: p.page_name,
        profilePictureUrl: p.profile_picture_url,
      })),
    };
  });

  return { rows };
}

export async function handleListAccounts(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient<Database>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();

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
  if (!isSessionAuthorizedForSubdomain(session, subdomain)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Resolve workspace ID scoped to user
  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // 4. Query connected accounts with connected page count and linked pages aggregation scoped to workspace
  let rows: Array<Record<string, any>> = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    rows = await fetchLegacyAccounts(dbClient as DatabaseClient, workspaceId, session.userId);
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const res = await fetchSupabaseAccounts(supabase, workspaceId, session.userId);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    rows = res.rows || [];
  }

  const accounts = (rows || []).map((row) => {
    const view = mapAccountRowToView(row);

    if (row.status === 'active' && view.status === 'expired') {
      syncExpiredAccountStatus(view.id, session.userId, dbClient);
    }

    return view;
  });

  accounts.sort((a, b) => {
    const aExpired = a.status === 'expired' ? 1 : 0;
    const bExpired = b.status === 'expired' ? 1 : 0;
    if (aExpired !== bExpired) {
      return bExpired - aExpired;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const parsed = ListFacebookAccountsResponseSchema.safeParse({
    accounts,
    total: accounts.length,
  });
  if (!parsed.success) {
    console.error('[handleListAccounts] Schema validation error:', parsed.error);
    return NextResponse.json(
      { error: 'Failed to format accounts list response' },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed.data);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListAccounts(request, subdomain);
}
