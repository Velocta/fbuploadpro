import { type NextRequest, NextResponse } from 'next/server';
import {
  MediaItemResponseSchema,
  UpdateMediaItemRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleUpdateMedia(
  request: NextRequest,
  subdomain: string,
  mediaId: string,
  dbClient?: DatabaseClient
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

  // Verify media item exists and belongs to the user
  const existingMedia = (await db.query(
    `SELECT id, folder_id, caption_template_id, caption_text
     FROM media_items
     WHERE id = $1 AND user_id = $2`,
    [mediaId, session.userId]
  )) as any[];

  if (!existingMedia || existingMedia.length === 0) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
  }

  // Validate folder if specified
  if (parsed.data.folderId !== undefined && parsed.data.folderId !== null) {
    const folderRows = (await db.query(
      `SELECT id FROM media_folders WHERE id = $1 AND user_id = $2`,
      [parsed.data.folderId, session.userId]
    )) as any[];

    if (!folderRows || folderRows.length === 0) {
      return NextResponse.json(
        { error: 'FOLDER_NOT_FOUND', message: 'Specified folder was not found' },
        { status: 404 }
      );
    }
  }

  let captionTextToSave: string | null | undefined = parsed.data.captionText;

  // Validate caption template if specified
  if (
    parsed.data.captionTemplateId !== undefined &&
    parsed.data.captionTemplateId !== null
  ) {
    const captionRows = (await db.query(
      `SELECT id, content FROM caption_templates WHERE id = $1 AND user_id = $2`,
      [parsed.data.captionTemplateId, session.userId]
    )) as any[];

    if (!captionRows || captionRows.length === 0) {
      return NextResponse.json(
        {
          error: 'CAPTION_TEMPLATE_NOT_FOUND',
          message: 'Specified caption template was not found',
        },
        { status: 404 }
      );
    }

    // If captionText is not explicitly provided, snapshot template content
    if (captionTextToSave === undefined) {
      captionTextToSave = captionRows[0].content;
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
  if (parsed.data.tags !== undefined) {
    updates.push(`tags = $${paramIdx++}`);
    values.push(JSON.stringify(parsed.data.tags));
  }
  if (parsed.data.captionTemplateId !== undefined) {
    updates.push(`caption_template_id = $${paramIdx++}`);
    values.push(parsed.data.captionTemplateId);
  }
  if (captionTextToSave !== undefined) {
    updates.push(`caption_text = $${paramIdx++}`);
    values.push(captionTextToSave);
  }

  values.push(mediaId, session.userId);
  const updateQuery = `
    UPDATE media_items
    SET ${updates.join(', ')}
    WHERE id = $${paramIdx++} AND user_id = $${paramIdx++}
    RETURNING id, user_id, folder_id, name, file_size, mime_type, media_type,
              storage_key, url, thumbnail_key, thumbnail_url, duration_seconds,
              aspect_ratio, tags, caption_template_id, caption_text,
              created_at, updated_at
  `;

  const updatedRows = (await db.query(updateQuery, values)) as any[];
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
  }

  const row = updatedRows[0];
  const payload = MediaItemResponseSchema.parse({
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
    tags: Array.isArray(row.tags)
      ? row.tags
      : typeof row.tags === 'string'
      ? JSON.parse(row.tags)
      : [],
    captionTemplateId: row.caption_template_id,
    captionText: row.caption_text,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });

  return NextResponse.json(payload);
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
