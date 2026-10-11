import { type NextRequest, NextResponse } from 'next/server';
import {
  DeleteFolderResponseSchema,
  FolderResponseSchema,
  type IStorageService,
  UpdateFolderRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../lib/db';
import { getStorageService } from '../../../../../../../lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleUpdateFolder(
  request: NextRequest,
  subdomain: string,
  folderId: string,
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = UpdateFolderRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.name === undefined && parsed.data.parentId === undefined) {
    return NextResponse.json(
      {
        error: 'INVALID_REQUEST',
        message: 'At least one of name or parentId must be provided',
      },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();

  try {
    const existingRows = (await db.query(
      `SELECT id, user_id, parent_id, name, created_at, updated_at
       FROM media_folders
       WHERE id = $1 AND user_id = $2`,
      [folderId, session.userId]
    )) as any[];

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Folder not found' },
        { status: 404 }
      );
    }

    if (parsed.data.parentId !== undefined) {
      if (parsed.data.parentId === folderId) {
        return NextResponse.json(
          {
            error: 'INVALID_FOLDER_HIERARCHY',
            message: 'A folder cannot be moved into itself',
          },
          { status: 400 }
        );
      }

      if (parsed.data.parentId !== null) {
        const parentRows = (await db.query(
          `SELECT id FROM media_folders WHERE id = $1 AND user_id = $2`,
          [parsed.data.parentId, session.userId]
        )) as any[];

        if (!parentRows || parentRows.length === 0) {
          return NextResponse.json(
            {
              error: 'PARENT_FOLDER_NOT_FOUND',
              message: 'Target parent folder not found',
            },
            { status: 404 }
          );
        }

        const cycleRows = (await db.query(
          `WITH RECURSIVE descendants AS (
             SELECT id FROM media_folders WHERE parent_id = $1 AND user_id = $2
             UNION ALL
             SELECT f.id FROM media_folders f INNER JOIN descendants d ON f.parent_id = d.id WHERE f.user_id = $2
           )
           SELECT id FROM descendants WHERE id = $3`,
          [folderId, session.userId, parsed.data.parentId]
        )) as any[];

        if (cycleRows && cycleRows.length > 0) {
          return NextResponse.json(
            {
              error: 'INVALID_FOLDER_HIERARCHY',
              message: 'A folder cannot be moved into one of its own subfolders',
            },
            { status: 400 }
          );
        }
      }
    }

    const updates: string[] = ['updated_at = now()'];
    const values: any[] = [];
    let paramIdx = 1;

    if (parsed.data.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(parsed.data.name);
    }
    if (parsed.data.parentId !== undefined) {
      updates.push(`parent_id = $${paramIdx++}`);
      values.push(parsed.data.parentId);
    }

    values.push(folderId, session.userId);

    const updateRows = (await db.query(
      `UPDATE media_folders
       SET ${updates.join(', ')}
       WHERE id = $${paramIdx++} AND user_id = $${paramIdx++}
       RETURNING id, user_id, parent_id, name, created_at, updated_at`,
      values
    )) as any[];

    if (!updateRows || updateRows.length === 0) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Folder not found' },
        { status: 404 }
      );
    }

    const row = updateRows[0];

    const countRows = (await db.query(
      `SELECT COUNT(*)::int AS item_count
       FROM media_items
       WHERE folder_id = $1 AND user_id = $2`,
      [folderId, session.userId]
    )) as any[];

    const subfolderRows = (await db.query(
      `SELECT COUNT(*)::int AS subfolder_count
       FROM media_folders
       WHERE parent_id = $1 AND user_id = $2`,
      [folderId, session.userId]
    )) as any[];

    const itemCount = Number(countRows[0]?.item_count ?? 0);
    const subfolderCount = Number(subfolderRows[0]?.subfolder_count ?? 0);

    const responsePayload = FolderResponseSchema.parse({
      id: row.id,
      userId: row.user_id,
      parentId: row.parent_id ?? null,
      name: row.name,
      itemCount,
      subfolderCount,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload);
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
      { error: 'INTERNAL_ERROR', message: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

export async function handleDeleteFolder(
  request: NextRequest,
  subdomain: string,
  folderId: string,
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

  const db = dbClient ?? getDbClient();
  const storage = storageService ?? getStorageService();

  // 1. Verify target folder belongs to user
  const existingRows = (await db.query(
    `SELECT id FROM media_folders WHERE id = $1 AND user_id = $2`,
    [folderId, session.userId]
  )) as any[];

  if (!existingRows || existingRows.length === 0) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Folder not found' },
      { status: 404 }
    );
  }

  // 2. Collect target folder and all descendant subfolders recursively
  const treeRows = (await db.query(
    `WITH RECURSIVE folder_tree AS (
       SELECT id FROM media_folders WHERE id = $1 AND user_id = $2
       UNION ALL
       SELECT f.id FROM media_folders f INNER JOIN folder_tree ft ON f.parent_id = ft.id WHERE f.user_id = $2
     )
     SELECT id FROM folder_tree`,
    [folderId, session.userId]
  )) as any[];

  const folderIds: string[] =
    treeRows && treeRows.length > 0
      ? treeRows.map((r) => r.id)
      : [folderId];

  // 3. Collect all media items inside the folder subtree
  const mediaRows = ((await db.query(
    `SELECT id, storage_key, thumbnail_key
     FROM media_items
     WHERE user_id = $1 AND folder_id = ANY($2::uuid[])`,
    [session.userId, folderIds]
  )) as any[]) ?? [];

  // 4. Purge R2 objects for all contained media items
  for (const item of mediaRows) {
    if (item.storage_key) {
      try {
        await storage.deleteObject(item.storage_key);
      } catch (_e) {
        // Continue with cleanup even if individual R2 key deletion fails
      }
    }
    if (item.thumbnail_key) {
      try {
        await storage.deleteObject(item.thumbnail_key);
      } catch (_e) {
        // Continue with cleanup
      }
    }
  }

  // 5. Delete media items and folder subtree in PostgreSQL
  await db.query(
    `DELETE FROM media_items WHERE user_id = $1 AND folder_id = ANY($2::uuid[])`,
    [session.userId, folderIds]
  );

  await db.query(
    `DELETE FROM media_folders WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [session.userId, folderIds]
  );

  const responsePayload = DeleteFolderResponseSchema.parse({
    success: true,
    deletedFolderId: folderId,
    deletedSubfoldersCount: Math.max(0, folderIds.length - 1),
    deletedItemsCount: mediaRows.length,
  });

  return NextResponse.json(responsePayload);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; folderId: string }> }
): Promise<NextResponse> {
  const { subdomain, folderId } = await context.params;
  return handleUpdateFolder(request, subdomain, folderId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; folderId: string }> }
): Promise<NextResponse> {
  const { subdomain, folderId } = await context.params;
  return handleDeleteFolder(request, subdomain, folderId);
}
