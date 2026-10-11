import { type NextRequest, NextResponse } from 'next/server';
import {
  DownloaderIngestRequestSchema,
  DownloaderIngestResponseSchema,
  MediaItemResponseSchema,
  validateSafeRemoteUrl,
  verifySessionToken,
  type IStorageService,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import type { DatabaseClient } from '@fbuploadpro/database';
import { getDbClient } from '../../../../../../lib/db';
import { getStorageService } from '../../../../../../lib/storage';
import {
  MediaDownloaderError,
  resolveAndUploadMediaFromUrl,
} from '../../../../../../lib/media-downloader';

interface MediaItemDbRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  file_size: string | number;
  mime_type: string;
  media_type: 'video' | 'image';
  storage_key: string;
  url: string;
  thumbnail_key: string | null;
  thumbnail_url: string | null;
  duration_seconds: string | number | null;
  aspect_ratio: string | null;
  caption_text: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function normalizeQueryRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as T[];
    }
  }
  return [];
}

function mapRowToMediaItemResponse(row: MediaItemDbRow): MediaItemResponse {
  return MediaItemResponseSchema.parse({
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id ?? null,
    name: row.name,
    fileSize: Number(row.file_size),
    mimeType: row.mime_type,
    mediaType: row.media_type,
    storageKey: row.storage_key,
    url: row.url,
    thumbnailKey: row.thumbnail_key ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    durationSeconds:
      row.duration_seconds !== null && row.duration_seconds !== undefined
        ? Number(row.duration_seconds)
        : null,
    aspectRatio: row.aspect_ratio ?? 'unknown',
    captionText: row.caption_text ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

export async function handleDownloadMediaFromUrl(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient,
  storageService?: IStorageService,
  fetchImpl?: typeof fetch,
  extractorApiUrl?: string | null
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
      { error: 'INVALID_REQUEST', message: 'Invalid JSON request payload.' },
      { status: 400 }
    );
  }

  const parsed = DownloaderIngestRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'INVALID_REQUEST',
        message: 'Please enter a valid link starting with http:// or https://.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const safety = validateSafeRemoteUrl(body.url);
  if (!safety.valid || !safety.url) {
    return NextResponse.json(
      {
        error: 'UNSAFE_URL',
        message: safety.reason ?? 'Please enter a valid public http:// or https:// link.',
      },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();
  const storage = storageService ?? getStorageService();
  const targetFolderId = body.folderId ?? null;

  try {
    // 4. Verify destination folder ownership if folderId is specified
    if (targetFolderId !== null) {
      const checkFolder = async (queryFn: (sql: string, params?: unknown[]) => Promise<unknown>) => {
        const res = await queryFn(
          'SELECT id FROM media_folders WHERE id = $1 AND user_id = $2',
          [targetFolderId, session.userId]
        );
        return normalizeQueryRows<{ id: string }>(res);
      };

      let folderRows: { id: string }[] = [];
      if (typeof db.query === 'function') {
        folderRows = await checkFolder((sql, params) => db.query(sql, params));
      } else if (typeof db.withTransaction === 'function') {
        folderRows = await db.withTransaction((tx) =>
          checkFolder((sql, params) => tx.query(sql, params))
        );
      }

      if (folderRows.length === 0) {
        return NextResponse.json(
          {
            error: 'FOLDER_NOT_FOUND',
            message: 'Selected destination folder was not found.',
          },
          { status: 404 }
        );
      }
    }

    // 5. Resolve remote media link & stream directly to R2
    const resolved = await resolveAndUploadMediaFromUrl({
      sourceUrl: body.url,
      userId: session.userId,
      storage,
      fetchImpl,
      extractorApiUrl,
    });

    // 6. Persist all resolved media items inside a transaction
    const executeInserts = async (tx: {
      query: (sql: string, params?: unknown[]) => Promise<unknown>;
    }): Promise<MediaItemDbRow[]> => {
      const insertedRows: MediaItemDbRow[] = [];
      for (const item of resolved.items) {
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
            item.mediaId,
            session.userId,
            targetFolderId,
            item.name,
            item.fileSize,
            item.mimeType,
            item.mediaType,
            item.storageKey,
            item.url,
            item.thumbnailKey,
            item.thumbnailUrl,
            item.durationSeconds,
            item.aspectRatio,
            item.captionText,
          ]
        );

        const rows = normalizeQueryRows<MediaItemDbRow>(insertRes);
        if (rows[0]) {
          insertedRows.push(rows[0]);
        }
      }
      return insertedRows;
    };

    let insertedRows: MediaItemDbRow[];
    if (typeof db.withTransaction === 'function') {
      insertedRows = await db.withTransaction(executeInserts);
    } else {
      insertedRows = await executeInserts({
        query: (sql, params) => db.query(sql, params),
      });
    }

    const responseItems = insertedRows.map(mapRowToMediaItemResponse);
    const responsePayload = DownloaderIngestResponseSchema.parse({
      sourceUrl: resolved.sourceUrl,
      platform: resolved.platform,
      items: responseItems,
    });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    if (err instanceof MediaDownloaderError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      );
    }
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: 'Could not save media from this link right now. Please try again.',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleDownloadMediaFromUrl(request, subdomain);
}
