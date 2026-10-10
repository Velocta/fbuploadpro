import { type NextRequest, NextResponse } from 'next/server';
import {
  DeleteFolderResponseSchema,
  FolderResponseSchema,
  UpdateFolderRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../lib/db';
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

  const db = dbClient ?? getDbClient();

  try {
    const updateRows = (await db.query(
      `UPDATE media_folders
       SET name = COALESCE($1, name),
           updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, name, created_at, updated_at`,
      [parsed.data.name ?? null, folderId, session.userId]
    )) as any[];

    if (!updateRows || updateRows.length === 0) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    const row = updateRows[0];

    const countRows = (await db.query(
      `SELECT COUNT(*)::int AS item_count
       FROM media_items
       WHERE folder_id = $1 AND user_id = $2`,
      [folderId, session.userId]
    )) as any[];

    const itemCount = Number(countRows[0]?.item_count ?? 0);

    const responsePayload = FolderResponseSchema.parse({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      itemCount,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json(
        {
          error: 'FOLDER_NAME_ALREADY_EXISTS',
          message: 'A folder with this name already exists in your workspace',
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

  const db = dbClient ?? getDbClient();

  // 1. Count preserved items that will become unorganized
  const countRows = (await db.query(
    `SELECT COUNT(*)::int AS preserved_count
     FROM media_items
     WHERE folder_id = $1 AND user_id = $2`,
    [folderId, session.userId]
  )) as any[];

  const preservedItemsCount = Number(countRows[0]?.preserved_count ?? 0);

  // 2. Delete the folder (foreign key ON DELETE SET NULL reassigns items)
  const deleteRows = (await db.query(
    `DELETE FROM media_folders
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [folderId, session.userId]
  )) as any[];

  if (!deleteRows || deleteRows.length === 0) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
  }

  const responsePayload = DeleteFolderResponseSchema.parse({
    success: true,
    deletedFolderId: folderId,
    preservedItemsCount,
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
