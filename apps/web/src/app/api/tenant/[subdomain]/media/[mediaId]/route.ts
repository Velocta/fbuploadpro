import { type NextRequest, NextResponse } from 'next/server';
import {
  DeleteMediaItemResponseSchema,
  type IStorageService,
  MediaItemResponseSchema,
  UpdateMediaItemRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import { getStorageService } from '../../../../../../lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authenticateUser(request: NextRequest, subdomain: string) {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';

  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  let session;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch (_e) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session };
}

function formatMediaRow(row: any) {
  return MediaItemResponseSchema.parse({
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    name: row.name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    mediaType: row.media_type,
    storageKey: row.storage_key,
    url: row.url,
    thumbnailKey: row.thumbnail_key,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds:
      row.duration_seconds !== null ? Number(row.duration_seconds) : null,
    aspectRatio: row.aspect_ratio,
    captionText: row.caption_text,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

export async function handleGetMedia(
  request: NextRequest,
  subdomain: string,
  mediaId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const auth = await authenticateUser(request, subdomain);
  if (auth.error || !auth.session) return auth.error!;

  if (!UUID_REGEX.test(mediaId)) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid media ID format' },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();
  const rows = (await db.query(
    `SELECT id, user_id, folder_id, name, file_size, mime_type, media_type,
            storage_key, url, thumbnail_key, thumbnail_url, duration_seconds,
            aspect_ratio, caption_text,
            created_at, updated_at
     FROM media_items
     WHERE id = $1 AND user_id = $2`,
    [mediaId, auth.session.userId]
  )) as any[];

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
  }

  return NextResponse.json(formatMediaRow(rows[0]));
}

export async function handleUpdateMedia(
  request: NextRequest,
  subdomain: string,
  mediaId: string,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const auth = await authenticateUser(request, subdomain);
  if (auth.error || !auth.session) return auth.error!;

  if (!UUID_REGEX.test(mediaId)) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid media ID format' },
      { status: 400 }
    );
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

  const parsed = UpdateMediaItemRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();

  const existingMedia = (await db.query(
    `SELECT id, folder_id, caption_text
     FROM media_items
     WHERE id = $1 AND user_id = $2`,
    [mediaId, auth.session.userId]
  )) as any[];

  if (!existingMedia || existingMedia.length === 0) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
  }

  if (parsed.data.folderId !== undefined && parsed.data.folderId !== null) {
    const folderRows = (await db.query(
      `SELECT id FROM media_folders WHERE id = $1 AND user_id = $2`,
      [parsed.data.folderId, auth.session.userId]
    )) as any[];

    if (!folderRows || folderRows.length === 0) {
      return NextResponse.json(
        { error: 'FOLDER_NOT_FOUND', message: 'Specified folder was not found' },
        { status: 404 }
      );
    }
  }

  const updates: string[] = ['updated_at = now()'];
  const values: any[] = [];
  let paramIdx = 1;

  if (parsed.data.name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    values.push(parsed.data.name);
  }
  if (parsed.data.folderId !== undefined) {
    updates.push(`folder_id = $${paramIdx++}`);
    values.push(parsed.data.folderId);
  }
  if (parsed.data.captionText !== undefined) {
    updates.push(`caption_text = $${paramIdx++}`);
    values.push(parsed.data.captionText);
  }

  values.push(mediaId, auth.session.userId);
  const updateQuery = `
    UPDATE media_items
    SET ${updates.join(', ')}
    WHERE id = $${paramIdx++} AND user_id = $${paramIdx++}
    RETURNING id, user_id, folder_id, name, file_size, mime_type, media_type,
              storage_key, url, thumbnail_key, thumbnail_url, duration_seconds,
              aspect_ratio, caption_text,
              created_at, updated_at
  `;

  const updatedRows = (await db.query(updateQuery, values)) as any[];
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
  }

  return NextResponse.json(formatMediaRow(updatedRows[0]));
}

export async function handleDeleteMedia(
  request: NextRequest,
  subdomain: string,
  mediaId: string,
  dbClient?: DatabaseClient,
  storageService?: IStorageService
): Promise<NextResponse> {
  const auth = await authenticateUser(request, subdomain);
  if (auth.error || !auth.session) return auth.error!;

  if (!UUID_REGEX.test(mediaId)) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid media ID format' },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();
  const rows = (await db.query(
    `SELECT id, user_id, storage_key, thumbnail_key
     FROM media_items
     WHERE id = $1 AND user_id = $2`,
    [mediaId, auth.session.userId]
  )) as any[];

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
  }

  const item = rows[0];

  const storage = storageService ?? getStorageService();
  if (item.storage_key) {
    try {
      await storage.deleteObject(item.storage_key);
    } catch (_e) {
      // Continue with DB deletion even if storage deletion fails
    }
  }
  if (item.thumbnail_key) {
    try {
      await storage.deleteObject(item.thumbnail_key);
    } catch (_e) {
      // Continue
    }
  }

  await db.query(
    `DELETE FROM media_items WHERE id = $1 AND user_id = $2`,
    [mediaId, auth.session.userId]
  );

  const payload = DeleteMediaItemResponseSchema.parse({
    success: true,
    mediaId,
  });

  return NextResponse.json(payload);
}

export async function GET(
  request: NextRequest,
  props: {
    params:
      | { subdomain: string; mediaId: string }
      | Promise<{ subdomain: string; mediaId: string }>;
  }
) {
  const resolvedParams = await Promise.resolve(props.params);
  return handleGetMedia(request, resolvedParams.subdomain, resolvedParams.mediaId);
}

export async function PATCH(
  request: NextRequest,
  props: {
    params:
      | { subdomain: string; mediaId: string }
      | Promise<{ subdomain: string; mediaId: string }>;
  }
) {
  const resolvedParams = await Promise.resolve(props.params);
  return handleUpdateMedia(
    request,
    resolvedParams.subdomain,
    resolvedParams.mediaId
  );
}

export async function DELETE(
  request: NextRequest,
  props: {
    params:
      | { subdomain: string; mediaId: string }
      | Promise<{ subdomain: string; mediaId: string }>;
  }
) {
  const resolvedParams = await Promise.resolve(props.params);
  return handleDeleteMedia(
    request,
    resolvedParams.subdomain,
    resolvedParams.mediaId
  );
}
