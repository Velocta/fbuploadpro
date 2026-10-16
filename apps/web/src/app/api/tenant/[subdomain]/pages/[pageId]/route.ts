import { type NextRequest, NextResponse } from 'next/server';
import {
  DisconnectPageResponseSchema,
  FacebookPageViewSchema,
  getSessionSecret,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import { globalInsightsCache } from '@/lib/insights/insights-cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const UpdatePageRequestSchema = z.object({
  status: z.enum(['active', 'paused']).optional(),
  timezone: z.string().min(1).max(50).optional(),
});

function formatPageRow(row: any) {
  let parsedTasks: string[] = [];
  if (Array.isArray(row.tasks)) {
    parsedTasks = row.tasks;
  } else if (typeof row.tasks === 'string') {
    try {
      parsedTasks = JSON.parse(row.tasks);
    } catch (_e) {
      parsedTasks = [];
    }
  }

  const startingFollowers = Number(row.starting_followers ?? 0);
  const currentFollowers = Number(row.current_followers ?? 0);
  const followersGained = currentFollowers - startingFollowers;

  return FacebookPageViewSchema.parse({
    id: row.id,
    facebookAccountId: row.facebook_account_id || row.facebookAccountId,
    accountDisplayName: row.account_display_name ?? row.facebook_accounts?.display_name ?? null,
    fbPageId: row.fb_page_id || row.fbPageId,
    pageName: row.page_name || row.pageName,
    profilePictureUrl: row.profile_picture_url ?? null,
    category: row.category ?? null,
    timezone: row.timezone ?? 'UTC',
    startingFollowers,
    currentFollowers,
    followersGained,
    status: row.status,
    tasks: parsedTasks,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

async function authenticateTenantRequest(
  request: NextRequest,
  subdomain: string
): Promise<{ errorResponse?: NextResponse; session?: any }> {
  const secretKey = getSessionSecret();

  const token = request.cookies.get('fbup_session')?.value;
  if (!token) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const verified = await verifySessionToken(token, secretKey);
    if (verified.subdomain !== subdomain && verified.role !== 'admin') {
      return { errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { session: verified };
  } catch (_e) {
    return { errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}

async function fetchActivePageById(
  client: DatabaseClient | SupabaseClient<any> | null | undefined,
  pageId: string,
  userId: string,
  workspaceId: string
) {
  if (client && 'query' in client && typeof client.query === 'function') {
    const rows = (await client.query(
      `SELECT 
        p.id,
        p.facebook_account_id,
        a.display_name AS account_display_name,
        p.fb_page_id,
        p.page_name,
        p.profile_picture_url,
        p.category,
        p.timezone,
        p.starting_followers,
        p.current_followers,
        p.status,
        p.tasks,
        p.created_at,
        p.updated_at
      FROM facebook_pages p
      LEFT JOIN facebook_accounts a ON a.id = p.facebook_account_id
      WHERE p.id = $1 AND p.user_id = $2 AND p.workspace_id = $3
        AND p.status != 'disconnected'`,
      [pageId, userId, workspaceId]
    )) as any[];

    if (!rows || rows.length === 0 || !rows[0]) {
      return null;
    }
    return formatPageRow(rows[0]);
  }

  const supabase = (client && 'from' in client ? client : getSupabaseClient()) as SupabaseClient<any> | null;
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('facebook_pages')
    .select('*, facebook_accounts(display_name)')
    .eq('id', pageId)
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .neq('status', 'disconnected')
    .maybeSingle();

  if (error || !data) return null;
  return formatPageRow(data);
}

interface QueueStatusCounts {
  queued: number;
  publishing: number;
  published: number;
  failed: number;
}

const DEFAULT_QUEUE_STATUS_COUNTS: QueueStatusCounts = {
  queued: 0,
  publishing: 0,
  published: 0,
  failed: 0,
};

async function fetchQueueCountsLegacy(
  client: DatabaseClient,
  pageId: string,
  userId: string
): Promise<QueueStatusCounts | null> {
  try {
    const rows = (await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'queued') AS queued,
         COUNT(*) FILTER (WHERE status = 'publishing') AS publishing,
         COUNT(*) FILTER (WHERE status = 'published') AS published,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed
       FROM queue_items
       WHERE page_id = $1 AND user_id = $2`,
      [pageId, userId]
    )) as any[];
    if (rows && rows[0]) {
      return {
        queued: Number(rows[0].queued ?? 0),
        publishing: Number(rows[0].publishing ?? 0),
        published: Number(rows[0].published ?? 0),
        failed: Number(rows[0].failed ?? 0),
      };
    }
  } catch {
    // fallback
  }
  return null;
}

async function fetchQueueCountsRpc(
  supabase: SupabaseClient<any>,
  pageId: string,
  userId: string
): Promise<QueueStatusCounts | null> {
  try {
    const { data, error } = await supabase.rpc('get_page_queue_status_counts', {
      p_page_id: pageId,
      p_user_id: userId,
    });
    if (!error && data && data.length > 0) {
      return {
        queued: Number(data[0].queued ?? 0),
        publishing: Number(data[0].publishing ?? 0),
        published: Number(data[0].published ?? 0),
        failed: Number(data[0].failed ?? 0),
      };
    }
  } catch {
    // fallback
  }
  return null;
}

async function fetchQueueCountsFallback(
  supabase: SupabaseClient<any>,
  pageId: string,
  userId: string
): Promise<QueueStatusCounts | null> {
  try {
    const { data: rows } = await supabase
      .from('queue_items')
      .select('status')
      .eq('page_id', pageId)
      .eq('user_id', userId);
    if (rows) {
      const counts: QueueStatusCounts = { ...DEFAULT_QUEUE_STATUS_COUNTS };
      for (const row of rows) {
        if (row.status in counts) {
          counts[row.status as keyof QueueStatusCounts]++;
        }
      }
      return counts;
    }
  } catch {
    // return defaults
  }
  return null;
}

async function fetchPageQueueCounts(
  client: DatabaseClient | SupabaseClient<any> | null | undefined,
  pageId: string,
  userId: string
): Promise<QueueStatusCounts> {
  if (!client) return { ...DEFAULT_QUEUE_STATUS_COUNTS };

  if ('query' in client && typeof client.query === 'function') {
    const counts = await fetchQueueCountsLegacy(client, pageId, userId);
    return counts ?? { ...DEFAULT_QUEUE_STATUS_COUNTS };
  }

  const supabase = ('from' in client ? client : getSupabaseClient()) as SupabaseClient<any> | null;
  if (!supabase) return { ...DEFAULT_QUEUE_STATUS_COUNTS };

  const rpcCounts = await fetchQueueCountsRpc(supabase, pageId, userId);
  if (rpcCounts) return rpcCounts;

  const fallbackCounts = await fetchQueueCountsFallback(supabase, pageId, userId);
  return fallbackCounts ?? { ...DEFAULT_QUEUE_STATUS_COUNTS };
}

export async function handleGetPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const auth = await authenticateTenantRequest(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session!;

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const [page, queueCounts] = await Promise.all([
    fetchActivePageById(dbClient, pageId, session.userId, workspaceId),
    fetchPageQueueCounts(dbClient, pageId, session.userId),
  ]);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return NextResponse.json({ page, queueCounts });
}

export async function handleUpdatePage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const auth = await authenticateTenantRequest(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session!;

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const parsed = UpdatePageRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.issues },
      { status: 400 }
    );
  }

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    if (parsed.data.status || parsed.data.timezone) {
      await dbClient.query(
        `UPDATE facebook_pages
         SET status = COALESCE($1, status),
             timezone = COALESCE($2, timezone),
             rate_limited_at = CASE WHEN $1 = 'active' THEN NULL ELSE rate_limited_at END,
             next_allowed_publish_at = CASE WHEN $1 = 'active' THEN NULL ELSE next_allowed_publish_at END,
             updated_at = now()
         WHERE id = $3 AND user_id = $4 AND workspace_id = $5 AND status != 'disconnected'`,
        [parsed.data.status ?? null, parsed.data.timezone ?? null, pageId, session.userId, workspaceId]
      );
    }
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<any> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }
    if (parsed.data.status || parsed.data.timezone) {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (parsed.data.status) {
        updates.status = parsed.data.status;
        if (parsed.data.status === 'active') {
          updates.rate_limited_at = null;
          updates.next_allowed_publish_at = null;
        }
      }
      if (parsed.data.timezone) {
        updates.timezone = parsed.data.timezone;
      }
      await supabase
        .from('facebook_pages')
        .update(updates)
        .eq('id', pageId)
        .eq('user_id', session.userId)
        .eq('workspace_id', workspaceId)
        .neq('status', 'disconnected');
    }
  }

  const page = await fetchActivePageById(dbClient, pageId, session.userId, workspaceId);
  if (!page) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, page });
}

export async function handleDisconnectPage(
  request: NextRequest,
  subdomain: string,
  pageId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const auth = await authenticateTenantRequest(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session!;

  const workspaceId = await resolveTenantWorkspaceId(dbClient, subdomain, session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    const result = (await dbClient.query(
      `UPDATE facebook_pages
       SET status = 'disconnected',
           encrypted_access_token = '',
           updated_at = now()
       WHERE id = $1 AND user_id = $2 AND workspace_id = $3
       RETURNING id, fb_page_id`,
      [pageId, session.userId, workspaceId]
    )) as any[];

    if (!result || result.length === 0 || !result[0]) {
      return NextResponse.json(
        { error: 'Facebook page not found' },
        { status: 404 }
      );
    }

    await dbClient.query(
      `UPDATE queue_items
       SET status = 'skipped',
           updated_at = now()
       WHERE user_id = $1 AND fb_page_id = $2 AND status = 'queued'`,
      [session.userId, pageId]
    );

    globalInsightsCache.deletePageInsights(session.userId, pageId, result[0]?.fb_page_id);
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<any> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    const { data: updated, error } = await supabase
      .from('facebook_pages')
      .update({
        status: 'disconnected',
        encrypted_access_token: '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .select('id, fb_page_id');

    if (error || !updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'Facebook page not found' },
        { status: 404 }
      );
    }

    await supabase
      .from('queue_items')
      .update({ status: 'skipped', updated_at: new Date().toISOString() })
      .eq('user_id', session.userId)
      .eq('fb_page_id', pageId)
      .eq('status', 'queued');

  }

  const responsePayload = DisconnectPageResponseSchema.parse({
    success: true,
    pageId,
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleGetPage(request, subdomain, pageId);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleUpdatePage(request, subdomain, pageId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; pageId: string }> }
): Promise<NextResponse> {
  const { subdomain, pageId } = await context.params;
  return handleDisconnectPage(request, subdomain, pageId);
}
