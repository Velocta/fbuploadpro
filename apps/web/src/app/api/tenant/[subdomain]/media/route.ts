import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  MediaListQuerySchema,
  MediaListResponseSchema,
  verifySessionToken,
  type DatabaseClient,
  type Database,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sanitizes and escapes user search input for safe interpolation into PostgREST `.or()` filter strings.
 *
 * PostgREST syntax uses `,` and `()` as query delimiters. Quoting patterns with `"` protects commas
 * and parentheses from breaking PostgREST query parsing.
 * Inside double quotes:
 * - `\` is escaped to prevent escape injection.
 * - `"` is escaped to prevent quote breakout.
 * - `%` and `_` are escaped to treat them as literals in LIKE / ILIKE pattern matching.
 */
export function sanitizePostgrestSearchPattern(input: string): string {
  const escaped = input
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
  return `"%${escaped}%"`;
}

export async function handleListMedia(
  request: NextRequest,
  subdomain: string,
  dbClient?: DatabaseClient | SupabaseClient<Database>
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

  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsedQuery = MediaListQuerySchema.safeParse({
    folderId: searchParams.get('folderId') || undefined,
    mediaType: searchParams.get('mediaType') || undefined,
    aspectRatio: searchParams.get('aspectRatio') || undefined,
    captionStatus: searchParams.get('captionStatus') || undefined,
    search: searchParams.get('search') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    sortOrder: searchParams.get('sortOrder') || undefined,
    limit: searchParams.get('limit') || undefined,
    offset: searchParams.get('offset') || undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      { error: 'INVALID_QUERY', details: parsedQuery.error.flatten() },
      { status: 400 }
    );
  }

  const {
    folderId,
    mediaType,
    aspectRatio,
    captionStatus,
    search,
    sortBy,
    sortOrder,
    limit,
    offset,
  } = parsedQuery.data;

  let total = 0;
  let rows: any[] = [];

  if (dbClient && 'query' in dbClient && typeof dbClient.query === 'function') {
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

    if (aspectRatio) {
      params.push(aspectRatio);
      conditions.push(`aspect_ratio = $${params.length}`);
    }

    if (captionStatus === 'has_caption') {
      conditions.push("caption_text IS NOT NULL AND BTRIM(caption_text) <> ''");
    } else if (captionStatus === 'empty_caption') {
      conditions.push("(caption_text IS NULL OR BTRIM(caption_text) = '')");
    }

    if (search) {
      params.push(`%${search}%`);
      const paramIndex = params.length;
      conditions.push(`(name ILIKE $${paramIndex} OR caption_text ILIKE $${paramIndex})`);
    }

    const whereClause = conditions.join(' AND ');

    const SORT_COLUMN_MAP: Record<'created_at' | 'name' | 'file_size', string> = {
      created_at: 'created_at',
      name: 'LOWER(name)',
      file_size: 'file_size',
    };
    const orderColumn = SORT_COLUMN_MAP[sortBy] ?? 'created_at';
    const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 1. Total count
    const countSql = `SELECT COUNT(*)::int AS total FROM media_items WHERE ${whereClause}`;
    const countRows = (await dbClient.query(countSql, params)) as any[];
    total = Number(countRows[0]?.total ?? 0);

    // 2. Fetch page items
    const queryParams = [...params, limit, offset];
    const itemsSql = `SELECT * FROM media_items WHERE ${whereClause} ORDER BY ${orderColumn} ${orderDirection} LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`;
    rows = (await dbClient.query(itemsSql, queryParams)) as any[];
  } else {
    const supabase = (dbClient && 'from' in dbClient ? dbClient : getSupabaseClient()) as SupabaseClient<Database> | null;
    if (!supabase) {
      return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
    }

    let queryBuilder = supabase
      .from('media_items')
      .select('*', { count: 'exact' })
      .eq('user_id', session.userId);

    if (folderId === 'unorganized') {
      queryBuilder = queryBuilder.is('folder_id', null);
    } else if (folderId) {
      queryBuilder = queryBuilder.eq('folder_id', folderId);
    }

    if (mediaType) {
      queryBuilder = queryBuilder.eq('media_type', mediaType);
    }

    if (aspectRatio) {
      queryBuilder = queryBuilder.eq('aspect_ratio', aspectRatio);
    }

    if (captionStatus === 'has_caption') {
      queryBuilder = queryBuilder.not('caption_text', 'is', null).neq('caption_text', '');
    } else if (captionStatus === 'empty_caption') {
      queryBuilder = queryBuilder.or('caption_text.is.null,caption_text.eq.');
    }

    if (search) {
      const pattern = sanitizePostgrestSearchPattern(search);
      queryBuilder = queryBuilder.or(`name.ilike.${pattern},caption_text.ilike.${pattern}`);
    }

    let sortCol = 'created_at';
    if (sortBy === 'name') {
      sortCol = 'name';
    } else if (sortBy === 'file_size') {
      sortCol = 'file_size';
    }
    queryBuilder = queryBuilder.order(sortCol as any, { ascending: sortOrder === 'asc' });
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    const { data: mediaRows, count, error } = await queryBuilder;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    total = count ?? (mediaRows || []).length;
    rows = mediaRows || [];
  }

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
