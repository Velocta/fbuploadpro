import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  ListFacebookPagesResponseSchema,
  evaluatePageHealth,
  verifySessionToken,
  canAccessTenant,
  type DatabaseClient,
  type Database,
  type DatabaseFacebookPageRow,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One facebook_pages row as the list mapper consumes it (spec 137
 * §3.7): snake_case (SQL/Supabase) and camelCase (legacy) spellings;
 * follower/picture fields stay `unknown` here because the extract*
 * helpers below narrow them with typeof — that narrowing is the type
 * boundary for values the database returns untyped.
 */
interface PageListRow {
  id: string;
  facebook_account_id?: string | null;
  facebookAccountId?: string | null;
  account_display_name?: string | null;
  accountDisplayName?: string | null;
  fb_page_id?: string | null;
  fbPageId?: string | null;
  page_name?: string | null;
  pageName?: string | null;
  profile_picture_url?: unknown;
  profilePictureUrl?: unknown;
  category?: string | null;
  starting_followers?: unknown;
  startingFollowers?: unknown;
  current_followers?: unknown;
  currentFollowers?: unknown;
  followers_count?: unknown;
  followersCount?: unknown;
  status?: DatabaseFacebookPageRow['status'] | null;
  tasks?: unknown;
  rate_limited_at?: string | Date | null;
  rateLimitedAt?: string | Date | null;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  updated_at?: string | Date | null;
  updatedAt?: string | Date | null;
}

function extractCurrentFollowers(row: PageListRow): number {
  if (typeof row.current_followers === 'number') return row.current_followers;
  if (typeof row.currentFollowers === 'number') return row.currentFollowers;
  if (typeof row.followers_count === 'number') return row.followers_count;
  if (typeof row.followersCount === 'number') return row.followersCount;
  return 0;
}

function extractStartingFollowers(row: PageListRow, currentFollowers: number): number {
  if (typeof row.starting_followers === 'number') return row.starting_followers;
  if (typeof row.startingFollowers === 'number') return row.startingFollowers;
  return currentFollowers;
}

function extractPagePictureUrl(row: PageListRow): string | null {
  if (typeof row.profile_picture_url === 'string') return row.profile_picture_url;
  if (typeof row.profilePictureUrl === 'string') return row.profilePictureUrl;
  return null;
}


function parsePageTasks(rawTasks: unknown): string[] {
  if (Array.isArray(rawTasks)) {
    return rawTasks;
  }
  if (typeof rawTasks === 'string') {
    try {
      return JSON.parse(rawTasks);
    } catch (_e) {
      return [];
    }
  }
  return [];
}

async function fetchLegacyPages(
  dbClient: DatabaseClient,
  workspaceId: string,
  userId: string,
  role?: string
): Promise<PageListRow[]> {
  if (role === 'admin') {
    return dbClient.query<PageListRow>(
      `SELECT 
        p.id,
        p.facebook_account_id,
        a.display_name AS account_display_name,
        p.fb_page_id,
        p.page_name,
        p.profile_picture_url,
        p.category,
        p.starting_followers,
        p.current_followers,
        p.status,
        p.tasks,
        p.rate_limited_at,
        p.created_at,
        p.updated_at
      FROM facebook_pages p
      LEFT JOIN facebook_accounts a ON a.id = p.facebook_account_id
      WHERE p.workspace_id = $1
        AND p.status != 'disconnected'
      ORDER BY p.created_at DESC`,
      [workspaceId]
    );
  }

  return dbClient.query<PageListRow>(
    `SELECT 
      p.id,
      p.facebook_account_id,
      a.display_name AS account_display_name,
      p.fb_page_id,
      p.page_name,
      p.profile_picture_url,
      p.category,
      p.starting_followers,
      p.current_followers,
      p.status,
      p.tasks,
      p.rate_limited_at,
      p.created_at,
      p.updated_at
    FROM facebook_pages p
    LEFT JOIN facebook_accounts a ON a.id = p.facebook_account_id
    WHERE p.user_id = $1
      AND p.workspace_id = $2
      AND p.status != 'disconnected'
    ORDER BY p.created_at DESC`,
    [userId, workspaceId]
  );
}

async function fetchSupabasePages(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  role?: string
): Promise<{ rows?: PageListRow[]; error?: string }> {
  let query = supabase
    .from('facebook_pages')
    .select('*, facebook_accounts(display_name)')
    .eq('workspace_id', workspaceId)
    .neq('status', 'disconnected');

  if (role !== 'admin') {
    query = query.eq('user_id', userId);
  }

  const { data: pageData, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return { error: error.message };
  }

  // The contracts Database type resolves this joined select to never[]
  // (no Relationships metadata for supabase-js), so the result is
  // asserted once, here at the boundary, to the shape select('*')
  // actually returns (rate_limited_at is a real column the contracts
  // row type does not model yet).
  const pageRows = (pageData || []) as Array<
    DatabaseFacebookPageRow & {
      facebook_accounts: { display_name: string } | null;
      rate_limited_at?: string | null;
    }
  >;
  const rows = pageRows.map((p) => ({
    ...p,
    account_display_name: p.facebook_accounts?.display_name || '',
  }));

  return { rows };
}

export async function handleListPages(
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
  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Resolve workspace ID scoped to user
  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId, session.role);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // 4. Query imported pages with parent account display name scoped to workspace
  let rows: PageListRow[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    rows = await fetchLegacyPages(dbClient as DatabaseClient, workspaceId, session.userId, session.role);
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const res = await fetchSupabasePages(supabase, workspaceId, session.userId, session.role);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    rows = res.rows || [];
  }

  const pages = (rows || []).map((row) => {
    const updatedAt = row.updated_at || row.updatedAt;
    const rateLimitedAt = row.rate_limited_at || row.rateLimitedAt;
    const effectiveStatus = evaluatePageHealth({
      status: row.status ?? 'active',
      updatedAt: updatedAt ?? null,
      rateLimitedAt: rateLimitedAt ?? null,
    });

    const currentFollowers = extractCurrentFollowers(row);
    const startingFollowers = extractStartingFollowers(row, currentFollowers);
    const followersGained = currentFollowers - startingFollowers;

    return {
      id: row.id,
      facebookAccountId: row.facebook_account_id || row.facebookAccountId,
      accountDisplayName:
        row.account_display_name || row.accountDisplayName || '',
      fbPageId: row.fb_page_id || row.fbPageId,
      pageName: row.page_name || row.pageName,
      profilePictureUrl: extractPagePictureUrl(row),
      category: row.category ?? null,
      startingFollowers,
      currentFollowers,
      followersGained,
      followersCount: currentFollowers,
      status: effectiveStatus,
      tasks: parsePageTasks(row.tasks),
      rateLimitedAt: rateLimitedAt ? new Date(rateLimitedAt) : null,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
    };
  });


  const responsePayload = ListFacebookPagesResponseSchema.parse({
    pages,
    total: pages.length,
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListPages(request, subdomain);
}
