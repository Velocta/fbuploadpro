import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  DownloaderIngestRequestSchema,
  DownloaderIngestResponseSchema,
  getSessionSecret,
  MediaItemResponseSchema,
  validateSafeRemoteUrl,
  verifySessionToken,
  type DatabaseClient,
  type IStorageService,
  type MediaItemResponse,
} from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
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

async function verifyFolderOwnership(
  db: DatabaseClient,
  targetFolderId: string,
  userId: string
): Promise<boolean> {
  const checkFolder = async (
    queryFn: (sql: string, params?: unknown[]) => Promise<unknown>
  ) => {
    const res = await queryFn(
      'SELECT id FROM media_folders WHERE id = $1 AND user_id = $2',
      [targetFolderId, userId]
    );
    return normalizeQueryRows<{ id: string }>(res);
  };

  if (typeof db.query === 'function') {
    const rows = await checkFolder((sql, params) => db.query(sql, params));
    return rows.length > 0;
  }
  if (typeof db.withTransaction === 'function') {
    const rows = await db.withTransaction((tx) =>
      checkFolder((sql, params) => tx.query(sql, params))
    );
    return rows.length > 0;
  }
  return false;
}

async function insertSingleResolvedItem(
  tx: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  userId: string,
  targetFolderId: string | null,
  item: Awaited<ReturnType<typeof resolveAndUploadMediaFromUrl>>['items'][number]
): Promise<MediaItemDbRow | null> {
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
      userId,
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
  return rows[0] ?? null;
}

async function persistResolvedMediaItems(
  db: DatabaseClient,
  userId: string,
  targetFolderId: string | null,
  items: Awaited<ReturnType<typeof resolveAndUploadMediaFromUrl>>['items']
): Promise<MediaItemDbRow[]> {
  const executeInserts = async (tx: {
    query: (sql: string, params?: unknown[]) => Promise<unknown>;
  }): Promise<MediaItemDbRow[]> => {
    const inserted = await Promise.all(
      items.map((item) => insertSingleResolvedItem(tx, userId, targetFolderId, item))
    );
    return inserted.filter((row): row is MediaItemDbRow => row !== null);
  };

  if (typeof db.withTransaction === 'function') {
    return db.withTransaction(executeInserts);
  }
  return executeInserts({
    query: (sql, params) => (db as any).query(sql, params),
  });
}

export async function handleDownloadMediaFromUrl(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient<any>,
  storageService?: IStorageService,
  fetchImpl?: typeof fetch,
  extractorApiUrl?: string | null
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();

  // 1. Session auth guard
  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let session;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Tenant isolation check
  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Request payload validation
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
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

  const storage = storageService ?? getStorageService();
  const targetFolderId = body.folderId ?? null;

  try {
    if (isLegacyClient(dbClient)) {
      // 4. Verify destination folder ownership if folderId is specified
      if (targetFolderId !== null) {
        const folderExists = await verifyFolderOwnership(dbClient, targetFolderId, session.userId);
        if (!folderExists) {
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
      const insertedRows = await persistResolvedMediaItems(
        dbClient,
        session.userId,
        targetFolderId,
        resolved.items
      );

      const responseItems = insertedRows.map(mapRowToMediaItemResponse);
      const responsePayload = DownloaderIngestResponseSchema.parse({
        sourceUrl: resolved.sourceUrl,
        platform: resolved.platform,
        items: responseItems,
      });

      return NextResponse.json(responsePayload, { status: 201 });
    }

    const supabase = getRouteSupabase(dbClient);
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    if (targetFolderId !== null) {
      const { data: folder } = await supabase
        .from('media_folders')
        .select('id')
        .eq('id', targetFolderId)
        .eq('user_id', session.userId)
        .maybeSingle();

      if (!folder) {
        return NextResponse.json(
          {
            error: 'FOLDER_NOT_FOUND',
            message: 'Selected destination folder was not found.',
          },
          { status: 404 }
        );
      }
    }

    const resolved = await resolveAndUploadMediaFromUrl({
      sourceUrl: body.url,
      userId: session.userId,
      storage,
      fetchImpl,
      extractorApiUrl,
    });

    const insertRecords = resolved.items.map((item) => ({
      id: item.mediaId,
      user_id: session.userId,
      folder_id: targetFolderId,
      name: item.name,
      file_size: item.fileSize,
      mime_type: item.mimeType,
      media_type: item.mediaType,
      storage_key: item.storageKey,
      url: item.url,
      thumbnail_key: item.thumbnailKey,
      thumbnail_url: item.thumbnailUrl,
      duration_seconds: item.durationSeconds,
      aspect_ratio: item.aspectRatio,
      caption_text: item.captionText,
    }));

    const { data: insertedRows, error: insertErr } = await supabase
      .from('media_items')
      .insert(insertRecords)
      .select();

    if (insertErr || !insertedRows) {
      return NextResponse.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'Could not save media from this link right now. Please try again.',
        },
        { status: 500 }
      );
    }

    const responseItems = (insertedRows as MediaItemDbRow[]).map(mapRowToMediaItemResponse);
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
