import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  ListFacebookPagesResponseSchema,
  evaluatePageHealth,
  verifySessionToken,
  canAccessTenant,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { SupabaseClient } from '@supabase/supabase-js';

function extractCurrentFollowers(row: any): number {
  if (typeof row.current_followers === 'number') return row.current_followers;
  if (typeof row.currentFollowers === 'number') return row.currentFollowers;
  if (typeof row.followers_count === 'number') return row.followers_count;
  if (typeof row.followersCount === 'number') return row.followersCount;
  return 0;
}

function extractStartingFollowers(row: any, currentFollowers: number): number {
  if (typeof row.starting_followers === 'number') return row.starting_followers;
  if (typeof row.startingFollowers === 'number') return row.startingFollowers;
  return currentFollowers;
}

function extractPagePictureUrl(row: any): string | null {
  if (typeof row.profile_picture_url === 'string') return row.profile_picture_url;
  if (typeof row.profilePictureUrl === 'string') return row.profilePictureUrl;
  return null;
}

async function syncRecoveredPageStatus(
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<void> {
  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    try {
      await dbClient.query(
        `UPDATE facebook_pages
         SET status = 'active', rate_limited_at = NULL, updated_at = now()
         WHERE id = $1`,
        [pageId]
      );
    } catch (err: any) {
      console.error('[handleListPages] Failed to persist recovered page status:', err);
    }
    return;
  }

  const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<any> | null;
  if (!supabase) return;

  const { error } = await supabase
    .from('facebook_pages')
    .update({ status: 'active', rate_limited_at: null, updated_at: new Date().toISOString() })
    .eq('id', pageId);

  if (error) {
    console.error('[handleListPages] Failed to persist recovered page status via Supabase:', error);
  }
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
): Promise<any[]> {
  if (role === 'admin') {
    return (await dbClient.query(
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
    )) as any[];
  }

  return (await dbClient.query(
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
  )) as any[];
}

async function fetchSupabasePages(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  role?: string
): Promise<{ rows?: any[]; error?: string }> {
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

  const rows = (pageData || []).map((p: any) => ({
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
  let rows: any[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    rows = await fetchLegacyPages(dbClient as DatabaseClient, workspaceId, session.userId, session.role);
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const res = await fetchSupabasePages(supabase, workspaceId, session.userId, session.role);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }
    rows = res.rows || [];
  }

  const recoveryPromises: Promise<void>[] = [];

  const pages = (rows || []).map((row) => {
    const updatedAt = row.updated_at || row.updatedAt;
    const rateLimitedAt = row.rate_limited_at || row.rateLimitedAt;
    const effectiveStatus = evaluatePageHealth({
      status: row.status ?? 'active',
      updatedAt,
      rateLimitedAt,
    });

    const currentFollowers = extractCurrentFollowers(row);
    const startingFollowers = extractStartingFollowers(row, currentFollowers);
    const followersGained = currentFollowers - startingFollowers;

    if (row.status === 'fb_rate_limited' && effectiveStatus === 'active') {
      recoveryPromises.push(syncRecoveredPageStatus(row.id, dbClient));
    }

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

  if (recoveryPromises.length > 0) {
    await Promise.all(recoveryPromises);
  }

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
