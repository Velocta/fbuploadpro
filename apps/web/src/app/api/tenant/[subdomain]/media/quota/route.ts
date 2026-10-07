import { type NextRequest, NextResponse } from 'next/server';
import {
  StorageQuotaResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleGetQuota(
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

  // 3. Query user storage quota
  const quotaRows = (await db.query(
    `SELECT total_bytes, used_bytes FROM user_storage_quotas WHERE user_id = $1`,
    [session.userId]
  )) as any[];

  const defaultTotalBytes = 5368709120; // 5 GB default
  const totalBytes = quotaRows.length > 0 ? Number(quotaRows[0].total_bytes) : defaultTotalBytes;
  const usedBytes = quotaRows.length > 0 ? Number(quotaRows[0].used_bytes) : 0;
  const remainingBytes = Math.max(0, totalBytes - usedBytes);
  const utilizationPercentage =
    totalBytes > 0
      ? Math.min(100, Math.max(0, Number(((usedBytes / totalBytes) * 100).toFixed(2))))
      : 0;

  // 4. Query item counts
  const itemRows = (await db.query(
    `SELECT 
      COUNT(*)::int AS total_items,
      COUNT(CASE WHEN media_type = 'video' THEN 1 END)::int AS video_items,
      COUNT(CASE WHEN media_type = 'image' THEN 1 END)::int AS image_items
    FROM media_items
    WHERE user_id = $1`,
    [session.userId]
  )) as any[];

  const counts = itemRows[0] || { total_items: 0, video_items: 0, image_items: 0 };

  const responsePayload = StorageQuotaResponseSchema.parse({
    userId: session.userId,
    totalBytes,
    usedBytes,
    remainingBytes,
    utilizationPercentage,
    totalItems: Number(counts.total_items ?? 0),
    videoItems: Number(counts.video_items ?? 0),
    imageItems: Number(counts.image_items ?? 0),
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleGetQuota(request, subdomain);
}
