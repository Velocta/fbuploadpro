import { type NextRequest, NextResponse } from 'next/server';
import {
  CreateWorkspaceRequestSchema,
  generateWorkspaceSubdomain,
  verifySessionToken,
  signSessionToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getDbClient } from '@/lib/db';
import { setSessionCookie } from '@/lib/supabase-auth';

function getSessionSecret(): string {
  return (
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long'
  );
}

async function extractSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get('fbup_session')?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token, getSessionSecret());
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await extractSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDbClient();

  // Query all workspaces owned by the user
  let rows = (await db.query(
    `SELECT id, owner_id AS "ownerId", name, subdomain, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM workspaces
     WHERE owner_id = $1
     ORDER BY created_at ASC`,
    [session.userId]
  )) as Array<{
    id: string;
    ownerId: string;
    name: string;
    subdomain: string;
    createdAt?: string;
    updatedAt?: string;
  }>;

  // Backfill if empty
  if (!rows || rows.length === 0) {
    const initialName = session.name || session.subdomain;
    rows = (await db.query(
      `INSERT INTO workspaces (id, owner_id, name, subdomain)
       VALUES (gen_random_uuid(), $1, $2, $3)
       ON CONFLICT (subdomain) DO UPDATE SET owner_id = EXCLUDED.owner_id
       RETURNING id, owner_id AS "ownerId", name, subdomain, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [session.userId, initialName, session.subdomain]
    )) as Array<{
      id: string;
      ownerId: string;
      name: string;
      subdomain: string;
      createdAt?: string;
      updatedAt?: string;
    }>;
  }

  return NextResponse.json({ workspaces: rows });
}

async function resolveUniqueSubdomain(
  db: ReturnType<typeof getDbClient>,
  userId: string,
  userSubdomain: string | undefined,
  requestedSubdomain?: string
): Promise<{ subdomain?: string; error?: string; status?: number }> {
  if (requestedSubdomain) {
    const conflictCheck = (await db.query(
      `SELECT id FROM workspaces WHERE subdomain = $1 LIMIT 1`,
      [requestedSubdomain]
    )) as Array<{ id: string }>;

    if (conflictCheck && conflictCheck.length > 0) {
      return {
        error: 'Subdomain already in use. Please select a different subdomain.',
        status: 409,
      };
    }
    return { subdomain: requestedSubdomain };
  }

  const primaryWsRows = (await db.query(
    `SELECT subdomain FROM workspaces WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId]
  )) as Array<{ subdomain: string }>;
  const mainSubdomain = primaryWsRows?.[0]?.subdomain || userSubdomain || 'ws';

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateWorkspaceSubdomain(mainSubdomain);
    const existing = (await db.query(
      `SELECT id FROM workspaces WHERE subdomain = $1 LIMIT 1`,
      [candidate]
    )) as Array<{ id: string }>;
    if (!existing || existing.length === 0) {
      return { subdomain: candidate };
    }
  }

  return {
    error: 'Unable to auto-generate a unique workspace subdomain. Please try again.',
    status: 500,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await extractSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parseResult = CreateWorkspaceRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.errors[0]?.message || 'Validation failed' },
      { status: 400 }
    );
  }

  const { name, subdomain } = parseResult.data;
  const db = getDbClient();

  const resolution = await resolveUniqueSubdomain(db, session.userId, session.subdomain, subdomain);
  if (resolution.error || !resolution.subdomain) {
    return NextResponse.json({ error: resolution.error }, { status: resolution.status || 500 });
  }
  const targetSubdomain = resolution.subdomain;

  // Insert workspace
  const insertRows = (await db.query(
    `INSERT INTO workspaces (owner_id, name, subdomain)
     VALUES ($1, $2, $3)
     RETURNING id, owner_id AS "ownerId", name, subdomain, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [session.userId, name, targetSubdomain]
  )) as Array<{
    id: string;
    ownerId: string;
    name: string;
    subdomain: string;
    createdAt?: string;
    updatedAt?: string;
  }>;

  const newWorkspace = insertRows[0];
  if (!newWorkspace) {
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }

  // Generate new session token pointing to the newly created workspace
  const secret = getSessionSecret();
  const newToken = await signSessionToken(
    {
      userId: session.userId,
      email: session.email,
      name: session.name,
      subdomain: newWorkspace.subdomain,
      role: session.role,
      status: session.status,
    },
    secret
  );

  const response = NextResponse.json({
    success: true,
    workspace: newWorkspace,
  });

  setSessionCookie(response, newToken, request.headers.get('host'));
  return response;
}
