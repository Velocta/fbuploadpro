import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  CreateWorkspaceRequestSchema,
  generateWorkspaceSubdomain,
  verifySessionToken,
  signSessionToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseClient, setSessionCookie } from '@/lib/supabase-auth';

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

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('id, owner_id, name, subdomain, created_at, updated_at')
      .eq('owner_id', session.userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Workspaces API] Failed to fetch workspaces:', error);
      return NextResponse.json({ error: error.message || 'Failed to fetch workspaces' }, { status: 500 });
    }

    let rows = (workspaces || []).map((w) => ({
      id: w.id as string,
      ownerId: w.owner_id as string,
      name: w.name as string,
      subdomain: w.subdomain as string,
      createdAt: w.created_at as string | undefined,
      updatedAt: w.updated_at as string | undefined,
    }));

    // Backfill if empty
    if (rows.length === 0) {
      const initialName = session.name || session.subdomain;
      const { data: inserted, error: insertError } = await supabase
        .from('workspaces')
        .upsert(
          {
            owner_id: session.userId,
            name: initialName,
            subdomain: session.subdomain,
          },
          { onConflict: 'subdomain' }
        )
        .select('id, owner_id, name, subdomain, created_at, updated_at')
        .single();

      if (insertError) {
        console.error('[Workspaces API] Failed to provision default workspace:', insertError);
        return NextResponse.json({ error: insertError.message || 'Failed to provision default workspace' }, { status: 500 });
      }

      if (inserted) {
        rows = [
          {
            id: inserted.id as string,
            ownerId: inserted.owner_id as string,
            name: inserted.name as string,
            subdomain: inserted.subdomain as string,
            createdAt: inserted.created_at as string | undefined,
            updatedAt: inserted.updated_at as string | undefined,
          },
        ];
      }
    }

    return NextResponse.json({ workspaces: rows });
  } catch (err) {
    console.error('[Workspaces API] Unhandled GET exception:', err);
    return NextResponse.json({ error: 'Failed to retrieve workspaces' }, { status: 500 });
  }
}

async function resolveUniqueSubdomain(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string,
  userSubdomain: string | undefined,
  requestedSubdomain?: string
): Promise<{ subdomain?: string; error?: string; status?: number }> {
  if (requestedSubdomain) {
    const { data: conflictCheck, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', requestedSubdomain)
      .maybeSingle();

    if (error) {
      return { error: 'Database query failed checking subdomain availability', status: 500 };
    }

    if (conflictCheck) {
      return {
        error: 'Subdomain already in use. Please select a different subdomain.',
        status: 409,
      };
    }
    return { subdomain: requestedSubdomain };
  }

  const { data: primaryWsRows } = await supabase
    .from('workspaces')
    .select('subdomain')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1);

  const mainSubdomain = primaryWsRows?.[0]?.subdomain || userSubdomain || 'ws';

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateWorkspaceSubdomain(mainSubdomain);
    const { data: existing, error } = await supabase
      .from('workspaces')
      .select('id')
      .eq('subdomain', candidate)
      .maybeSingle();

    if (!error && !existing) {
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }

  try {
    const resolution = await resolveUniqueSubdomain(supabase, session.userId, session.subdomain, subdomain);
    if (resolution.error || !resolution.subdomain) {
      return NextResponse.json({ error: resolution.error }, { status: resolution.status || 500 });
    }
    const targetSubdomain = resolution.subdomain;

    // Insert workspace via Supabase PostgREST
    const { data: inserted, error: insertError } = await supabase
      .from('workspaces')
      .insert({
        owner_id: session.userId,
        name,
        subdomain: targetSubdomain,
      })
      .select('id, owner_id, name, subdomain, created_at, updated_at')
      .single();

    if (insertError || !inserted) {
      console.error('[Workspaces API] Failed to insert workspace:', insertError);
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create workspace' },
        { status: 500 }
      );
    }

    const newWorkspace = {
      id: inserted.id as string,
      ownerId: inserted.owner_id as string,
      name: inserted.name as string,
      subdomain: inserted.subdomain as string,
      createdAt: inserted.created_at as string | undefined,
      updatedAt: inserted.updated_at as string | undefined,
    };

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
  } catch (err) {
    console.error('[Workspaces API] Unhandled POST exception:', err);
    return NextResponse.json(
      { error: 'An unexpected server error occurred while creating workspace' },
      { status: 500 }
    );
  }
}
