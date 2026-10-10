import { type NextRequest, NextResponse } from 'next/server';
import {
  ConfirmUploadRequestSchema,
  deriveDefaultCaptionFromFilename,
  MediaItemResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleConfirmUpload(
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

  // 3. Request payload validation
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = ConfirmUploadRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const db = dbClient ?? getDbClient();

  const resolvedCaptionText =
    body.captionText !== undefined
      ? body.captionText
      : deriveDefaultCaptionFromFilename(body.name);

  try {
    const executeInsert = async (tx: {
      query: (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number }>;
    }) => {
      const insertRes = await tx.query(
        `INSERT INTO media_items (
           id, user_id, folder_id, name, file_size, mime_type, media_type,
           storage_key, url, thumbnail_key, thumbnail_url, duration_seconds,
           aspect_ratio, caption_text, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12,
           $13, $14, now(), now()
         )
         RETURNING *`,
        [
          body.mediaId,
          session.userId,
          body.folderId ?? null,
          body.name,
          body.fileSize,
          body.mimeType,
          body.mediaType,
          body.storageKey,
          body.url,
          body.thumbnailKey ?? null,
          body.thumbnailUrl ?? null,
          body.durationSeconds ?? null,
          body.aspectRatio ?? 'unknown',
          resolvedCaptionText,
        ]
      );

      return insertRes.rows[0];
    };

    let insertedRow: any;
    if (typeof db.withTransaction === 'function') {
      insertedRow = await db.withTransaction(executeInsert);
    } else {
      insertedRow = await executeInsert({
        query: async (sql, params) => {
          const rows = await db.query(sql, params);
          return { rows, rowCount: rows.length };
        },
      });
    }

    const responsePayload = MediaItemResponseSchema.parse({
      id: insertedRow.id,
      userId: insertedRow.user_id,
      folderId: insertedRow.folder_id ?? null,
      name: insertedRow.name,
      fileSize: Number(insertedRow.file_size),
      mimeType: insertedRow.mime_type,
      mediaType: insertedRow.media_type,
      storageKey: insertedRow.storage_key,
      url: insertedRow.url,
      thumbnailKey: insertedRow.thumbnail_key ?? null,
      thumbnailUrl: insertedRow.thumbnail_url ?? null,
      durationSeconds:
        insertedRow.duration_seconds !== null && insertedRow.duration_seconds !== undefined
          ? Number(insertedRow.duration_seconds)
          : null,
      aspectRatio: insertedRow.aspect_ratio ?? 'unknown',
      captionText: insertedRow.caption_text ?? null,
      createdAt: new Date(insertedRow.created_at).toISOString(),
      updatedAt: new Date(insertedRow.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (_err) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to confirm media upload' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleConfirmUpload(request, subdomain);
}
