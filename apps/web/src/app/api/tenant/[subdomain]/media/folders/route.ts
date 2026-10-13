import { type NextRequest, NextResponse } from 'next/server';
import {
  CreateFolderRequestSchema,
  FolderListResponseSchema,
  FolderResponseSchema,
  getSessionSecret,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { DatabaseClient, Database } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

function isLegacyClient(
  client?: DatabaseClient | SupabaseClient<any>
): client is DatabaseClient {
  return (
    !!client &&
    (('query' in client && typeof (client as any).query === 'function') ||
      ('withTransaction' in client && typeof (client as any).withTransaction === 'function'))
  );
}

function getSupabase(
  client?: DatabaseClient | SupabaseClient<any>
): SupabaseClient<any> | null {
  if (client && 'from' in client) {
    return client as SupabaseClient<any>;
  }
  return getSupabaseClient() as SupabaseClient<any> | null;
}

export async function handleListFolders(
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

  if (session.subdomain !== subdomain && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isLegacyClient(dbClient)) {
    const folderRows = (await dbClient.query(
      `SELECT 
         f.id,
         f.user_id,
         f.parent_id,
         f.name,
         COALESCE(COUNT(DISTINCT m.id), 0)::int AS item_count,
         COALESCE(COUNT(DISTINCT sf.id), 0)::int AS subfolder_count,
         f.created_at,
         f.updated_at
       FROM media_folders f
       LEFT JOIN media_items m ON m.folder_id = f.id AND m.user_id = f.user_id
       LEFT JOIN media_folders sf ON sf.parent_id = f.id AND sf.user_id = f.user_id
       WHERE f.user_id = $1
       GROUP BY f.id, f.user_id, f.parent_id, f.name, f.created_at, f.updated_at
       ORDER BY f.name ASC`,
      [session.userId]
    )) as any[];

    const unorganizedRows = (await dbClient.query(
      `SELECT COUNT(*)::int AS unorganized_count
       FROM media_items
       WHERE user_id = $1 AND folder_id IS NULL`,
      [session.userId]
    )) as any[];

    const unorganizedCount = Number(unorganizedRows[0]?.unorganized_count ?? 0);

    const folders = folderRows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      parentId: row.parent_id ?? null,
      name: row.name,
      itemCount: Number(row.item_count ?? 0),
      subfolderCount: Number(row.subfolder_count ?? 0),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    }));

    const responsePayload = FolderListResponseSchema.parse({
      folders,
      unorganizedCount,
    });

    return NextResponse.json(responsePayload);
  }

  const supabase = getSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  const [foldersRes, itemsRes] = await Promise.all([
    supabase
      .from('media_folders')
      .select('id, user_id, parent_id, name, created_at, updated_at')
      .eq('user_id', session.userId)
      .order('name', { ascending: true }),
    supabase
      .from('media_items')
      .select('id, folder_id')
      .eq('user_id', session.userId),
  ]);

  if (foldersRes.error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Failed to list folders' }, { status: 500 });
  }

  const folderRows = foldersRes.data || [];
  const itemsRows = itemsRes.data || [];

  const itemCounts = new Map<string, number>();
  let unorganizedCount = 0;
  for (const item of itemsRows) {
    if (item.folder_id) {
      itemCounts.set(item.folder_id, (itemCounts.get(item.folder_id) || 0) + 1);
    } else {
      unorganizedCount++;
    }
  }

  const subfolderCounts = new Map<string, number>();
  for (const folder of folderRows) {
    if (folder.parent_id) {
      subfolderCounts.set(folder.parent_id, (subfolderCounts.get(folder.parent_id) || 0) + 1);
    }
  }

  const folders = folderRows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    parentId: row.parent_id ?? null,
    name: row.name,
    itemCount: itemCounts.get(row.id) || 0,
    subfolderCount: subfolderCounts.get(row.id) || 0,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));

  const responsePayload = FolderListResponseSchema.parse({
    folders,
    unorganizedCount,
  });

  return NextResponse.json(responsePayload);
}

export async function handleCreateFolder(
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

  const parsed = CreateFolderRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const parentId = parsed.data.parentId ?? null;

  if (isLegacyClient(dbClient)) {
    try {
      if (parentId !== null) {
        const parentRows = (await dbClient.query(
          `SELECT id FROM media_folders WHERE id = $1 AND user_id = $2`,
          [parentId, session.userId]
        )) as any[];

        if (!parentRows || parentRows.length === 0) {
          return NextResponse.json(
            {
              error: 'PARENT_FOLDER_NOT_FOUND',
              message: 'Parent folder not found',
            },
            { status: 404 }
          );
        }
      }

      const rows = (await dbClient.query(
        `INSERT INTO media_folders (user_id, parent_id, name, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())
         RETURNING id, user_id, parent_id, name, created_at, updated_at`,
        [session.userId, parentId, parsed.data.name]
      )) as any[];

      const row = rows[0];
      const responsePayload = FolderResponseSchema.parse({
        id: row.id,
        userId: row.user_id,
        parentId: row.parent_id ?? parentId,
        name: row.name,
        itemCount: 0,
        subfolderCount: 0,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      });

      return NextResponse.json(responsePayload, { status: 201 });
    } catch (err: any) {
      if (err?.code === '23505') {
        return NextResponse.json(
          {
            error: 'FOLDER_NAME_ALREADY_EXISTS',
            message: 'A folder with this name already exists in this location',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to create folder' },
        { status: 500 }
      );
    }
  }

  const supabase = getSupabase(dbClient);
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 });
  }

  try {
    if (parentId !== null) {
      const { data: parentFolder } = await supabase
        .from('media_folders')
        .select('id')
        .eq('id', parentId)
        .eq('user_id', session.userId)
        .maybeSingle();

      if (!parentFolder) {
        return NextResponse.json(
          {
            error: 'PARENT_FOLDER_NOT_FOUND',
            message: 'Parent folder not found',
          },
          { status: 404 }
        );
      }
    }

    const { data: insertedFolder, error: insertErr } = await supabase
      .from('media_folders')
      .insert({
        user_id: session.userId,
        parent_id: parentId,
        name: parsed.data.name,
      })
      .select('id, user_id, parent_id, name, created_at, updated_at')
      .single();

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json(
          {
            error: 'FOLDER_NAME_ALREADY_EXISTS',
            message: 'A folder with this name already exists in this location',
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to create folder' },
        { status: 500 }
      );
    }

    const responsePayload = FolderResponseSchema.parse({
      id: insertedFolder.id,
      userId: insertedFolder.user_id,
      parentId: insertedFolder.parent_id ?? parentId,
      name: insertedFolder.name,
      itemCount: 0,
      subfolderCount: 0,
      createdAt: new Date(insertedFolder.created_at).toISOString(),
      updatedAt: new Date(insertedFolder.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (_err) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListFolders(request, subdomain);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleCreateFolder(request, subdomain);
}
