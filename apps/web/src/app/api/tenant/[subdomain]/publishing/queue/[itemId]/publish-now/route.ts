import { type NextRequest, NextResponse } from 'next/server';
import { getSessionSecret, verifySessionToken } from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { DatabaseClient, Database } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

function isLegacyClient(
  client?: DatabaseClient | SupabaseClient<any>
): client is DatabaseClient {
  return (
    !!client &&
    (('query' in client && typeof (client as any).query === 'function') ||
      ('withTransaction' in client && typeof (client as any).withTransaction === 'function'))
  );
}

function getSupabase(
  client?: DatabaseClient | SupabaseClient<any>
): SupabaseClient<any> | null {
  if (client && 'from' in client) {
    return client as SupabaseClient<any>;
  }
  return getSupabaseClient() as SupabaseClient<any> | null;
}

export async function handlePublishNow(
  request: NextRequest,
  subdomain: string,
  itemId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
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

  if (isLegacyClient(dbClient)) {
    // 3. Check existing item
    const existingRows = (await dbClient.query(
      `SELECT id, user_id, status FROM queue_items WHERE id = $1 AND user_id = $2`,
      [itemId, session.userId]
    )) as any[];

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    const existing = existingRows[0];
    if (existing.status === 'published') {
      return NextResponse.json(
        { error: 'ALREADY_PUBLISHED', message: 'Item has already been published' },
        { status: 400 }
      );
    }

    // 4. Update scheduled_time to now() and status to 'queued'
    await dbClient.query(
      `UPDATE queue_items
       SET scheduled_time = now(),
           status = 'queued',
           updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [itemId, session.userId]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Item dispatched for immediate publishing',
      },
      { status: 200 }
    );
  }

  const supabase = getSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { data: existing, error: existErr } = await supabase
    .from('queue_items')
    .select('id, user_id, status')
    .eq('id', itemId)
    .eq('user_id', session.userId)
    .maybeSingle();

  if (existErr || !existing) {
    return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
  }

  if (existing.status === 'published') {
    return NextResponse.json(
      { error: 'ALREADY_PUBLISHED', message: 'Item has already been published' },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabase
    .from('queue_items')
    .update({
      scheduled_time: new Date().toISOString(),
      status: 'queued',
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', session.userId);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to dispatch item' }, { status: 500 });
  }

  return NextResponse.json(
    {
      success: true,
      message: 'Item dispatched for immediate publishing',
    },
    { status: 200 }
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; itemId: string }> }
): Promise<NextResponse> {
  const { subdomain, itemId } = await context.params;
  return handlePublishNow(request, subdomain, itemId);
}
