import { type NextRequest, NextResponse } from 'next/server';
import {
  MediaListQuerySchema,
  MediaListResponseSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleListMedia(
  request: NextRequest,
  subdomain: string,
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

  const { searchParams } = new URL(request.url);
  const parsedQuery = MediaListQuerySchema.safeParse({
    folderId: searchParams.get('folderId') || undefined,
    mediaType: searchParams.get('mediaType') || undefined,
    tag: searchParams.get('tag') || undefined,
    search: searchParams.get('search') || undefined,
    limit: searchParams.get('limit') || undefined,
    offset: searchParams.get('offset') || undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  const { folderId, mediaType, tag, search, limit, offset } = parsedQuery.data;
  const db = dbClient ?? getDbClient();

  const conditions: string[] = ['user_id = $1'];
  const params: any[] = [session.userId];

  if (folderId === 'unorganized') {
    conditions.push('folder_id IS NULL');
  } else if (folderId) {
    params.push(folderId);
    conditions.push(`folder_id = $${params.length}`);
  }

  if (mediaType) {
    params.push(mediaType);
    conditions.push(`media_type = $${params.length}`);
  }

  if (tag) {
    params.push(JSON.stringify([tag]));
    conditions.push(`tags @> $${params.length}::jsonb`);
  }

  if (search) {
    params.push(`%${search}%`);
    const paramIndex = params.length;
    conditions.push(`(name ILIKE $${paramIndex} OR caption_text ILIKE $${paramIndex})`);
  }

  const whereClause = conditions.join(' AND ');

  // 1. Total count
  const countSql = `SELECT COUNT(*)::int AS total FROM media_items WHERE ${whereClause}`;
  const countRows = (await db.query(countSql, params)) as any[];
  const total = Number(countRows[0]?.total ?? 0);

  // 2. Fetch page items
  const queryParams = [...params, limit, offset];
  const itemsSql = `SELECT * FROM media_items WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
  const rows = (await db.query(itemsSql, queryParams)) as any[];

  const items = rows.map((row) => ({
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
    tags: Array.isArray(row.tags)
      ? row.tags
      : typeof row.tags === 'string'
      ? JSON.parse(row.tags)
      : [],
    captionTemplateId: row.caption_template_id ?? null,
    captionText: row.caption_text ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));

  const responsePayload = MediaListResponseSchema.parse({
    items,
    total,
    limit,
    offset,
  });

  return NextResponse.json(responsePayload);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListMedia(request, subdomain);
}
