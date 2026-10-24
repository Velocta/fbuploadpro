import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  ListFacebookPagesResponseSchema,
  evaluatePageHealth,
  verifySessionToken,
  canAccessTenant,
  type DatabaseClient,
  type Database,
  type FacebookPageStatus,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import {
  DESTINATION_STATUS_TO_WIRE_SQL,
  unifiedDestinationStatusToWire,
} from '@/lib/server/facebook-wire';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One destinations row as the list mapper consumes it (spec 137 §3.7),
 * already translated to the wire page vocabulary: snake_case
 * (SQL/Supabase) and camelCase spellings; follower/picture fields stay
 * `unknown` here because the extract* helpers below narrow them with
 * typeof — that narrowing is the type boundary for values the
 * database returns untyped.
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
  status?: FacebookPageStatus | null;
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

async function fetchSqlPages(
  dbClient: DatabaseClient,
  workspaceId: string
): Promise<PageListRow[]> {
  // The unified tables are workspace-scoped (no per-user column): the
  // resolved workspace is the isolation boundary, for admins and
  // members alike — the pre-unification admin/member split collapsed
  // into this single query.
  return dbClient.query<PageListRow>(
    `SELECT
      d.id,
      d.account_id AS facebook_account_id,
      a.display_name AS account_display_name,
      d.external_destination_id AS fb_page_id,
      d.name AS page_name,
      d.avatar_url AS profile_picture_url,
      d.metadata->>'category' AS category,
      (d.metadata->>'starting_followers')::int AS starting_followers,
      (d.metadata->>'current_followers')::int AS current_followers,
      ${DESTINATION_STATUS_TO_WIRE_SQL} AS status,
      d.metadata->'tasks' AS tasks,
      d.metadata->>'rate_limited_at' AS rate_limited_at,
      d.created_at,
      d.updated_at
    FROM destinations d
    LEFT JOIN social_accounts a ON a.id = d.account_id
    WHERE d.workspace_id = $1
      AND d.platform = 'facebook'
      AND (d.status != 'disconnected' OR d.metadata->>'fb_status' = 'paused')
    ORDER BY d.created_at DESC`,
    [workspaceId]
  );
}

interface SupabaseDestinationJoinRow {
  id: string;
  account_id: string;
  external_destination_id: string;
  name: string;
  avatar_url: string | null;
  metadata: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
  social_accounts: { display_name: string } | null;
}

async function fetchSupabasePages(
  supabase: SupabaseClient<Database>,
  workspaceId: string
): Promise<{ rows?: PageListRow[]; error?: string }> {
  const { data: pageData, error } = await supabase
    .from('destinations')
    .select(
      'id, account_id, external_destination_id, name, avatar_url, metadata, status, created_at, updated_at, social_accounts(display_name)'
    )
    .eq('workspace_id', workspaceId)
    .eq('platform', 'facebook')
    .order('created_at', { ascending: false });

  if (error) {
    return { error: error.message };
  }

  // The contracts Database type resolves this joined select to never[]
  // (no Relationships metadata for supabase-js), so the result is
  // asserted once, here at the boundary, to the shape the select
  // actually returns.
  const pageRows = (pageData || []) as unknown as SupabaseDestinationJoinRow[];
  // Disconnected destinations are excluded (a paused page — stored as
  // disconnected + the fb_status marker — stays listed, as before).
  const visibleRows = pageRows.filter(
    (p) => p.status !== 'disconnected' || p.metadata?.fb_status === 'paused'
  );
  const rows: PageListRow[] = visibleRows.map((p) => ({
    id: p.id,
    facebook_account_id: p.account_id,
    account_display_name: p.social_accounts?.display_name || '',
    fb_page_id: p.external_destination_id,
    page_name: p.name,
    profile_picture_url: p.avatar_url,
    category: typeof p.metadata?.category === 'string' ? p.metadata.category : null,
    starting_followers:
      typeof p.metadata?.starting_followers === 'number'
        ? p.metadata.starting_followers
        : null,
    current_followers:
      typeof p.metadata?.current_followers === 'number'
        ? p.metadata.current_followers
        : null,
    status: unifiedDestinationStatusToWire(p.status, p.metadata),
    tasks: p.metadata?.tasks ?? [],
    rate_limited_at:
      typeof p.metadata?.rate_limited_at === 'string'
        ? p.metadata.rate_limited_at
        : null,
    created_at: p.created_at,
    updated_at: p.updated_at,
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
    rows = await fetchSqlPages(dbClient as DatabaseClient, workspaceId);
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseAdminClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const res = await fetchSupabasePages(supabase, workspaceId);
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
