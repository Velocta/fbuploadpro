import { type NextRequest, NextResponse } from 'next/server';
import {
  CaptionTemplateResponseSchema,
  DeleteCaptionTemplateResponseSchema,
  UpdateCaptionTemplateRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleUpdateCaption(
  request: NextRequest,
  subdomain: string,
  captionId: string,
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

  const parsed = UpdateCaptionTemplateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();

  try {
    const updateRows = (await db.query(
      `UPDATE caption_templates
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           tags = COALESCE($3, tags),
           updated_at = now()
       WHERE id = $4 AND user_id = $5
       RETURNING id, user_id, title, content, tags, created_at, updated_at`,
      [
        parsed.data.title ?? null,
        parsed.data.content ?? null,
        parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
        captionId,
        session.userId,
      ]
    )) as any[];

    if (!updateRows || updateRows.length === 0) {
      return NextResponse.json({ error: 'Caption template not found' }, { status: 404 });
    }

    const row = updateRows[0];
    const responsePayload = CaptionTemplateResponseSchema.parse({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      content: row.content,
      tags: Array.isArray(row.tags)
        ? row.tags
        : typeof row.tags === 'string'
        ? JSON.parse(row.tags)
        : [],
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    });

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json(
        {
          error: 'CAPTION_TITLE_ALREADY_EXISTS',
          message: 'A caption template with this title already exists in your workspace',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to update caption template' },
      { status: 500 }
    );
  }
}

export async function handleDeleteCaption(
  request: NextRequest,
  subdomain: string,
  captionId: string,
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

  const deleteRows = (await db.query(
    `DELETE FROM caption_templates
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [captionId, session.userId]
  )) as any[];

  if (!deleteRows || deleteRows.length === 0) {
    return NextResponse.json({ error: 'Caption template not found' }, { status: 404 });
  }

  const responsePayload = DeleteCaptionTemplateResponseSchema.parse({
    success: true,
    deletedCaptionId: captionId,
  });

  return NextResponse.json(responsePayload);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; captionId: string }> }
): Promise<NextResponse> {
  const { subdomain, captionId } = await context.params;
  return handleUpdateCaption(request, subdomain, captionId);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string; captionId: string }> }
): Promise<NextResponse> {
  const { subdomain, captionId } = await context.params;
  return handleDeleteCaption(request, subdomain, captionId);
}
