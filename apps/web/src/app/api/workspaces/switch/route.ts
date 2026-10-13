import { type NextRequest, NextResponse } from 'next/server';
import {
  SwitchWorkspaceRequestSchema,
  verifySessionToken,
  signSessionToken,
  buildTenantUrl,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseClient, setSessionCookie } from '@/lib/supabase-auth';

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

  const parseResult = SwitchWorkspaceRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.errors[0]?.message || 'Validation failed' },
      { status: 400 }
    );
  }

  const { subdomain } = parseResult.data;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    // Validate ownership via Supabase PostgREST
    const { data: rows, error } = await supabase
      .from('workspaces')
      .select('id, name, subdomain')
      .eq('owner_id', session.userId)
      .eq('subdomain', subdomain);

    if (error) {
      console.error('[Switch Workspace API] Query failed:', error);
      return NextResponse.json({ error: 'Failed to verify workspace access' }, { status: 500 });
    }

    if ((!rows || rows.length === 0) && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not have access to this workspace' },
        { status: 403 }
      );
    }

    // Issue updated session token pointing to the switched workspace subdomain
    const secret = getSessionSecret();
    const newToken = await signSessionToken(
      {
        userId: session.userId,
        email: session.email,
        name: session.name,
        subdomain,
        role: session.role,
        status: session.status,
      },
      secret
    );

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
    const redirectUrl = buildTenantUrl(subdomain, '/', request.url, rootDomain).toString();

    const response = NextResponse.json({
      success: true,
      targetSubdomain: subdomain,
      redirectUrl,
    });

    setSessionCookie(response, newToken, request.headers.get('host'));
    return response;
  } catch (err) {
    console.error('[Switch Workspace API] Unhandled exception:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while switching workspace' },
      { status: 500 }
    );
  }
}
