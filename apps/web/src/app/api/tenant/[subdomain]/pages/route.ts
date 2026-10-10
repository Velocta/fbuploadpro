import { type NextRequest, NextResponse } from 'next/server';
import {
  ListFacebookPagesResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

function extractFollowersCount(row: any): number {
  if (typeof row.followers_count === 'number') return row.followers_count;
  if (typeof row.followersCount === 'number') return row.followersCount;
  return 0;
}

export async function handleListPages(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

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

  const db = dbClient ?? getDbClient();

  // 3. Query imported pages with parent account display name
  const rows = (await db.query(
    `SELECT 
      p.id,
      p.facebook_account_id,
      a.display_name AS account_display_name,
      p.fb_page_id,
      p.page_name,
      p.profile_picture_url,
      p.category,
      p.followers_count,
      p.status,
      p.tasks,
      p.created_at,
      p.updated_at
    FROM facebook_pages p
    LEFT JOIN facebook_accounts a ON a.id = p.facebook_account_id
    WHERE p.user_id = $1
    ORDER BY p.created_at DESC`,
    [session.userId]
  )) as any[];

  const pages = (rows || []).map((row) => {
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

    return {
      id: row.id,
      facebookAccountId: row.facebook_account_id || row.facebookAccountId,
      accountDisplayName:
        row.account_display_name || row.accountDisplayName || '',
      fbPageId: row.fb_page_id || row.fbPageId,
      pageName: row.page_name || row.pageName,
      profilePictureUrl:
        row.profile_picture_url ?? row.profilePictureUrl ?? null,
      category: row.category ?? null,
      followersCount: extractFollowersCount(row),
      status: row.status ?? 'active',
      tasks: parsedTasks,
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
