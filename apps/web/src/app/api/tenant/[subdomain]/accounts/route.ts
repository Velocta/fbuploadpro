import { type NextRequest, NextResponse } from 'next/server';
import {
  evaluateAccountHealth,
  getSessionSecret,
  ListFacebookAccountsResponseSchema,
  verifySessionToken,
  isSessionAuthorizedForSubdomain,
  type DatabaseClient,
  type Database,
  type FacebookAccountStatus,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import type { PostgrestError } from '@supabase/supabase-js';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import {
  ACCOUNT_STATUS_TO_WIRE_SQL,
  unifiedAccountStatusToWire,
} from '@/lib/server/facebook-wire';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One social_accounts row as the list mapper consumes it (spec 137
 * §3.7), already translated to the wire account vocabulary by the
 * facebook-wire maps. SQL rows and Supabase rows both land here; date
 * fields arrive as strings from Supabase and may be Date objects from
 * the raw driver, and the mapper tolerates the camelCase aliases the
 * SQL query path produces.
 */
interface AccountRow {
  id: string;
  fb_account_id?: string | null;
  fbAccountId?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  profile_picture_url?: string | null;
  profilePictureUrl?: string | null;
  gender?: string | null;
  account_link?: string | null;
  accountLink?: string | null;
  status?: FacebookAccountStatus | null;
  token_expires_at?: string | Date | null;
  tokenExpiresAt?: string | Date | null;
  connected_pages_count?: number | string | null;
  connectedPagesCount?: number | string | null;
  connected_pages?: unknown;
  connectedPages?: unknown;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  updated_at?: string | Date | null;
  updatedAt?: string | Date | null;
}

function mapAccountRowToView(row: AccountRow) {
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
  workspaceId: string,
  dbClient?: DatabaseClient | SupabaseClient
): void {
  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    dbClient.query(
      `UPDATE social_accounts
       SET status = 'expired', updated_at = now()
       WHERE id = $1 AND workspace_id = $2`,
      [accountId, workspaceId]
    ).catch((err: unknown) => {
      console.error('[handleListAccounts] Failed to persist expired account status:', err);
    });
    return;
  }

  const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient | null;
  if (!supabase) return;

  supabase
    .from('social_accounts')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', accountId)
    .eq('workspace_id', workspaceId)
    .then(({ error }: { error: PostgrestError | null }) => {
      if (error) {
        console.error('[handleListAccounts] Failed to persist expired account status via Supabase:', error);
      }
    });
}

async function fetchSqlAccounts(
  dbClient: DatabaseClient,
  workspaceId: string
): Promise<AccountRow[]> {
  return dbClient.query<AccountRow>(
    `SELECT
      sa.id,
      sa.external_account_id AS fb_account_id,
      sa.display_name,
      sa.avatar_url AS profile_picture_url,
      sa.metadata->>'gender' AS gender,
      sa.metadata->>'account_link' AS account_link,
      ${ACCOUNT_STATUS_TO_WIRE_SQL} AS status,
      sa.token_expires_at,
      sa.created_at,
      sa.updated_at,
      COUNT(d.id)::int AS connected_pages_count,
      COALESCE(
        json_agg(
          json_build_object(
            'id', d.id,
            'pageName', d.name,
            'profilePictureUrl', d.avatar_url
          ) ORDER BY d.name ASC
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::json
      ) AS connected_pages
    FROM social_accounts sa
    LEFT JOIN destinations d
      ON d.account_id = sa.id
      AND d.workspace_id = sa.workspace_id
      AND d.platform = 'facebook'
      AND (d.status != 'disconnected' OR d.metadata->>'fb_status' = 'paused')
    WHERE sa.workspace_id = $1 AND sa.platform = 'facebook'
    GROUP BY sa.id
    ORDER BY sa.created_at DESC`,
    [workspaceId]
  );
}

interface SupabaseAccountJoinRow {
  id: string;
  external_account_id: string;
  display_name: string;
  avatar_url: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
  destinations: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    status: string;
    workspace_id: string;
    metadata: Record<string, unknown> | null;
  }> | null;
}

async function fetchSupabaseAccounts(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<{ rows?: AccountRow[]; error?: string }> {
  const { data: accountsData, error } = await supabase
    .from('social_accounts')
    .select(`
      id,
      external_account_id,
      display_name,
      avatar_url,
      metadata,
      status,
      token_expires_at,
      created_at,
      updated_at,
      destinations (
        id,
        name,
        avatar_url,
        status,
        workspace_id,
        metadata
      )
    `)
    .eq('workspace_id', workspaceId)
    .eq('platform', 'facebook')
    .order('created_at', { ascending: false });

  if (error) {
    return { error: error.message };
  }

  // The contracts Database type resolves this joined select to never[]
  // (its table entries carry no Relationships metadata for supabase-js),
  // so the result is asserted once, here at the boundary, to the row
  // shape the select actually returns.
  const accountRows = (accountsData || []) as unknown as SupabaseAccountJoinRow[];
  const rows: AccountRow[] = accountRows.map((acc) => {
    const activePages = (acc.destinations || []).filter(
      (p) =>
        (p.status !== 'disconnected' || p.metadata?.fb_status === 'paused') &&
        p.workspace_id === workspaceId
    );
    return {
      id: acc.id,
      fb_account_id: acc.external_account_id,
      display_name: acc.display_name,
      profile_picture_url: acc.avatar_url,
      gender: typeof acc.metadata?.gender === 'string' ? acc.metadata.gender : null,
      account_link:
        typeof acc.metadata?.account_link === 'string' ? acc.metadata.account_link : null,
      status: unifiedAccountStatusToWire(acc.status),
      token_expires_at: acc.token_expires_at,
      created_at: acc.created_at,
      updated_at: acc.updated_at,
      connected_pages_count: activePages.length,
      connected_pages: activePages.map((p) => ({
        id: p.id,
        pageName: p.name,
        profilePictureUrl: p.avatar_url,
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
  let rows: AccountRow[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    rows = await fetchSqlAccounts(dbClient as DatabaseClient, workspaceId);
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const res = await fetchSupabaseAccounts(supabase, workspaceId);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    rows = res.rows || [];
  }

  const accounts = (rows || []).map((row) => {
    const view = mapAccountRowToView(row);

    if (row.status === 'active' && view.status === 'expired') {
      syncExpiredAccountStatus(view.id, workspaceId, dbClient);
    }

    return view;
  });

  accounts.sort((a, b) => {
    const aExpired = a.status === 'expired' ? 1 : 0;
    const bExpired = b.status === 'expired' ? 1 : 0;
    if (aExpired !== bExpired) {
      return bExpired - aExpired;
    }
    return new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime();
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
