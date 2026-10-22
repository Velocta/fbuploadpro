import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateTenantRoute,
  getRouteSupabase,
  isLegacyClient,
} from '@/lib/route-auth';
import type { DatabaseClient } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function handlePublishNow(
  request: NextRequest,
  subdomain: string,
  itemId: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const auth = await authenticateTenantRoute(request, subdomain);
  if (auth.errorResponse) return auth.errorResponse;
  const session = auth.session;

  if (isLegacyClient(dbClient)) {
    // 3. Check existing item
    const existingRows = (await dbClient.query(
      `SELECT id, user_id, status FROM legacy_queue_items WHERE id = $1 AND user_id = $2`,
      [itemId, session.userId]
    )) as Record<string, unknown>[];

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
      `UPDATE legacy_queue_items
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

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { data: existing, error: existErr } = await supabase
    .from('legacy_queue_items')
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
    .from('legacy_queue_items')
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
