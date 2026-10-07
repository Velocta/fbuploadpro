import { type NextRequest, NextResponse } from 'next/server';
import {
  CaptionListResponseSchema,
  CaptionTemplateResponseSchema,
  CreateCaptionTemplateRequestSchema,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleListCaptions(
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

  const db = dbClient ?? getDbClient();

  const rows = (await db.query(
    `SELECT id, user_id, title, content, tags, created_at, updated_at
     FROM caption_templates
     WHERE user_id = $1
     ORDER BY title ASC`,
    [session.userId]
  )) as any[];

  const templates = rows.map((row) => ({
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
  }));

  const responsePayload = CaptionListResponseSchema.parse({
    templates,
  });

  return NextResponse.json(responsePayload);
}

export async function handleCreateCaption(
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (_e) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = CreateCaptionTemplateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = dbClient ?? getDbClient();

  try {
    const rows = (await db.query(
      `INSERT INTO caption_templates (user_id, title, content, tags, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       RETURNING id, user_id, title, content, tags, created_at, updated_at`,
      [
        session.userId,
        parsed.data.title,
        parsed.data.content,
        JSON.stringify(parsed.data.tags ?? []),
      ]
    )) as any[];

    const row = rows[0];
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

    return NextResponse.json(responsePayload, { status: 201 });
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
      { error: 'INTERNAL_ERROR', message: 'Failed to create caption template' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleListCaptions(request, subdomain);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ subdomain: string }> }
): Promise<NextResponse> {
  const { subdomain } = await context.params;
  return handleCreateCaption(request, subdomain);
}
