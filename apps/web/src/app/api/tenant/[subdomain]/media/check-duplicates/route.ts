import { type NextRequest, NextResponse } from 'next/server';
import {
  canAccessTenant,
  CheckDuplicatesRequestSchema,
  CheckDuplicatesResponseSchema,
  getSessionSecret,
  MediaItemResponseSchema,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import { isLegacyClient, getRouteSupabase } from '@/lib/route-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

function formatMediaRow(row: any) {
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
    width: row.width ? Number(row.width) : null,
    height: row.height ? Number(row.height) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}

function findDuplicatesInRows(
  entries: Array<{ clientKey: string; name: string; fileSize: number }>,
  rows: Array<Record<string, unknown> & { name: string; file_size: number | string }>
): Array<{ clientKey: string; existingItem: any }> {
  const duplicates: Array<{ clientKey: string; existingItem: any }> = [];
  for (const entry of entries) {
    const match = rows.find(
      (r) =>
        r.name.toLowerCase() === entry.name.toLowerCase() &&
        Number(r.file_size) === entry.fileSize
    );
    if (match) {
      duplicates.push({
        clientKey: entry.clientKey,
        existingItem: formatMediaRow(match),
      });
    }
  }
  return duplicates;
}

async function queryLegacyDuplicates(
  dbClient: DatabaseClient,
  userId: string,
  folderId: string | null | undefined,
  entries: Array<{ clientKey: string; name: string; fileSize: number }>
): Promise<Array<Record<string, unknown> & { name: string; file_size: number | string }>> {
  const fileSizes = entries.map((e) => e.fileSize);
  const names = entries.map((e) => e.name.toLowerCase());
  const targetFolderId = folderId ?? null;
  const query = `
    SELECT id, user_id, folder_id, name, file_size, mime_type, media_type,
           storage_key, url, thumbnail_key, thumbnail_url, duration_seconds,
           aspect_ratio, caption_text, width, height, created_at, updated_at
    FROM media_items
    WHERE user_id = $1
      AND (folder_id = $2 OR ($2 IS NULL AND folder_id IS NULL))
      AND LOWER(name) = ANY($3::text[])
      AND file_size = ANY($4::bigint[])
  `;
  return (await dbClient.query(query, [
    userId,
    targetFolderId,
    names,
    fileSizes,
  ])) as any[];
}

async function querySupabaseDuplicates(
  supabase: SupabaseClient<any>,
  userId: string,
  folderId: string | null | undefined,
  entries: Array<{ clientKey: string; name: string; fileSize: number }>
): Promise<{ rows?: any[]; error?: string }> {
  let queryBuilder = supabase
    .from('media_items')
    .select(
      'id, user_id, folder_id, name, file_size, mime_type, media_type, storage_key, url, thumbnail_key, thumbnail_url, duration_seconds, aspect_ratio, caption_text, width, height, created_at, updated_at'
    )
    .eq('user_id', userId);

  if (folderId) {
    queryBuilder = queryBuilder.eq('folder_id', folderId);
  } else {
    queryBuilder = queryBuilder.is('folder_id', null);
  }

  const fileSizes = entries.map((e) => e.fileSize);
  queryBuilder = queryBuilder.in('file_size', fileSizes);

  const { data: rows, error } = await queryBuilder;
  if (error) {
    return { error: error.message };
  }
  return { rows: rows || [] };
}

export async function handleCheckDuplicates(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();

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

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const parsed = CheckDuplicatesRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { folderId, entries } = parsed.data;

  if (isLegacyClient(dbClient)) {
    const rows = await queryLegacyDuplicates(dbClient, session.userId, folderId, entries);
    const duplicates = findDuplicatesInRows(entries, rows);
    return NextResponse.json(CheckDuplicatesResponseSchema.parse({ duplicates }));
  }

  const supabase = getRouteSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const { rows, error } = await querySupabaseDuplicates(supabase, session.userId, folderId, entries);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  const duplicates = findDuplicatesInRows(entries, rows || []);
  return NextResponse.json(CheckDuplicatesResponseSchema.parse({ duplicates }));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleCheckDuplicates(request, subdomain);
}
