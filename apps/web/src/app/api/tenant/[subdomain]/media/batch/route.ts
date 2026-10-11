import { type NextRequest, NextResponse } from 'next/server';
import {
  BatchMediaRequestSchema,
  BatchMediaResponseSchema,
  type IStorageService,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import { getStorageService } from '../../../../../../lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleBatchMedia(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient,
  storageService?: IStorageService
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

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

  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = BatchMediaRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();
  const payload = parsed.data;

  if (payload.action === 'move') {
    if (payload.folderId !== null) {
      const folderRows = (await db.query(
        `SELECT id FROM media_folders WHERE id = $1 AND user_id = $2`,
        [payload.folderId, session.userId]
      )) as any[];

      if (!folderRows || folderRows.length === 0) {
        return NextResponse.json(
          { error: 'FOLDER_NOT_FOUND', message: 'Target folder not found' },
          { status: 404 }
        );
      }
    }

    const updatedRows = ((await db.query(
      `UPDATE media_items
       SET folder_id = $1, updated_at = now()
       WHERE user_id = $2 AND id = ANY($3::uuid[])
       RETURNING id`,
      [payload.folderId, session.userId, payload.mediaIds]
    )) as any[]) ?? [];

    const response = BatchMediaResponseSchema.parse({
      success: true,
      action: 'move',
      affectedCount: updatedRows.length,
    });

    return NextResponse.json(response);
  }

  if (payload.action === 'caption') {
    const updatedRows = ((await db.query(
      `UPDATE media_items
       SET caption_text = $1, updated_at = now()
       WHERE user_id = $2 AND id = ANY($3::uuid[])
       RETURNING id`,
      [payload.captionText, session.userId, payload.mediaIds]
    )) as any[]) ?? [];

    const response = BatchMediaResponseSchema.parse({
      success: true,
      action: 'caption',
      affectedCount: updatedRows.length,
    });

    return NextResponse.json(response);
  }

  // payload.action === 'delete'
  const storage = storageService ?? getStorageService();
  const mediaRows = ((await db.query(
    `SELECT id, storage_key, thumbnail_key
     FROM media_items
     WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [session.userId, payload.mediaIds]
  )) as any[]) ?? [];

  for (const item of mediaRows) {
    if (item.storage_key) {
      try {
        await storage.deleteObject(item.storage_key);
      } catch (_e) {
        // Continue cleanup even if individual storage key fails
      }
    }
    if (item.thumbnail_key) {
      try {
        await storage.deleteObject(item.thumbnail_key);
      } catch (_e) {
        // Continue cleanup
      }
    }
  }

  await db.query(
    `DELETE FROM media_items WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [session.userId, payload.mediaIds]
  );

  const response = BatchMediaResponseSchema.parse({
    success: true,
    action: 'delete',
    affectedCount: mediaRows.length,
  });

  return NextResponse.json(response);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleBatchMedia(request, subdomain);
}
