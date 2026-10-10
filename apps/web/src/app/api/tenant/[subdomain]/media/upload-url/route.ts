import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  UploadUrlRequestSchema,
  UploadUrlResponseSchema,
  verifySessionToken,
  type IStorageService,
} from '@fbuploadpro/contracts';
import { getStorageService } from '../../../../../../lib/storage';

export async function handleCreateUploadUrl(
  request: NextRequest,
  subdomain: string,
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

  // 4. Build isolated object keys
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
