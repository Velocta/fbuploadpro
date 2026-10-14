import { type NextRequest, NextResponse } from 'next/server';
import {
  DisconnectAccountResponseSchema,
  getSessionSecret,
  verifySessionToken,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handleDisconnectAccount(
  request: NextRequest,
  subdomain: string,
  accountId: string,
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
  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let disconnectedPagesCount = 0;

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
    const wsRows = (await dbClient.query(
      'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1',
      [subdomain, session.userId]
    )) as Array<{ id: string }>;
    const workspaceId = wsRows?.[0]?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // 3. Count connected pages prior to cascade deletion
    const countRows = (await dbClient.query(
      'SELECT COUNT(*)::int AS count FROM facebook_pages WHERE facebook_account_id = $1 AND user_id = $2 AND workspace_id = $3',
      [accountId, session.userId, workspaceId]
    )) as any[];
    disconnectedPagesCount = Number(countRows?.[0]?.count ?? 0);

    // 4. Delete account record (foreign key ON DELETE CASCADE safely removes linked pages)
    const result = (await dbClient.query(
      'DELETE FROM facebook_accounts WHERE id = $1 AND user_id = $2 AND workspace_id = $3 RETURNING id',
      [accountId, session.userId, workspaceId]
    )) as any[];

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Facebook account not found' },
        { status: 404 }
      );
    }
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
    const workspaceId = wsRecord?.id;

    if (wsErr || !workspaceId) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const { count } = await supabase
      .from('facebook_pages')
      .select('id', { count: 'exact', head: true })
      .eq('facebook_account_id', accountId)
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId);
    disconnectedPagesCount = count ?? 0;

    const { data: deleted, error: deleteErr } = await supabase
      .from('facebook_accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', session.userId)
      .eq('workspace_id', workspaceId)
      .select('id');

    if (deleteErr || !deleted || deleted.length === 0) {
      return NextResponse.json(
        { error: 'Facebook account not found' },
        { status: 404 }
      );
    }
  }

  const responsePayload = DisconnectAccountResponseSchema.parse({
    success: true,
    accountId,
    disconnectedPagesCount,
  });

  return NextResponse.json(responsePayload);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; accountId: string }> }
): Promise<NextResponse> {
  const { subdomain, accountId } = await context.params;
  return handleDisconnectAccount(request, subdomain, accountId);
}
