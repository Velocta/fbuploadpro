import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  UploadUrlRequestSchema,
  UploadUrlResponseSchema,
  verifySessionToken,
  type IStorageService,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import { getStorageService } from '../../../../../../lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleCreateUploadUrl(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient,
  storageService?: IStorageService
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

  // 3. Request payload validation
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = UploadUrlRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const db = dbClient ?? getDbClient();

  // 4. Storage quota pre-check
  const quotaRows = (await db.query(
    `SELECT total_bytes, used_bytes FROM user_storage_quotas WHERE user_id = $1`,
    [session.userId]
  )) as any[];

  const defaultTotalBytes = 5368709120; // 5 GB
  const totalBytes = quotaRows.length > 0 ? Number(quotaRows[0].total_bytes) : defaultTotalBytes;
  const usedBytes = quotaRows.length > 0 ? Number(quotaRows[0].used_bytes) : 0;
  const remainingBytes = Math.max(0, totalBytes - usedBytes);

  if (body.fileSize > remainingBytes) {
    return NextResponse.json(
      {
        error: 'INSUFFICIENT_STORAGE_QUOTA',
        message: 'Storage quota exceeded. Please delete existing media to free up space.',
      },
      { status: 403 }
    );
  }

  // 5. Build isolated object keys
  const sanitizedFileName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const mediaId = randomUUID();
  const mediaKey = `users/${session.userId}/media/${mediaId}/${sanitizedFileName}`;
  const thumbnailExt = body.thumbnailMimeType === 'image/jpeg' ? 'jpeg' : 'webp';
  const thumbnailKey = `users/${session.userId}/thumbnails/${mediaId}.${thumbnailExt}`;

  // 6. Generate presigned PUT URLs via storage service
  const storage = storageService ?? getStorageService();
  const expiresInSeconds = 900;

  const [mediaResult, thumbnailResult] = await Promise.all([
    storage.getPresignedUploadUrl({
      key: mediaKey,
      contentType: body.mimeType,
      expiresInSeconds,
    }),
    storage.getPresignedUploadUrl({
      key: thumbnailKey,
      contentType: body.thumbnailMimeType,
      expiresInSeconds,
    }),
  ]);

  const responsePayload = UploadUrlResponseSchema.parse({
    mediaId,
    mediaKey,
    mediaUploadUrl: mediaResult.uploadUrl,
    thumbnailKey,
    thumbnailUploadUrl: thumbnailResult.uploadUrl,
    publicMediaUrl: mediaResult.publicUrl,
    publicThumbnailUrl: thumbnailResult.publicUrl,
    expiresInSeconds,
  });

  return NextResponse.json(responsePayload);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleCreateUploadUrl(request, subdomain);
}
