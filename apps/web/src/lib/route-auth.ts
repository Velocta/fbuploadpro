import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  verifySessionToken,
  canAccessTenant,
  type DatabaseClient,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/auth/clients';
import type { SupabaseClient } from '@supabase/supabase-js';

export function isLegacyClient(
  client?: DatabaseClient | SupabaseClient
): client is DatabaseClient {
  if (!client) return false;
  // Structural probe (spec 137 §3.7): view the client as a record of
  // unknown members and narrow each with typeof — no `any` casts.
  const candidate = client as { query?: unknown; withTransaction?: unknown };
  return (
    ('query' in client && typeof candidate.query === 'function') ||
    ('withTransaction' in client &&
      typeof candidate.withTransaction === 'function')
  );
}

export function getRouteSupabase(
  client?: DatabaseClient | SupabaseClient
): SupabaseClient | null {
  if (client && 'from' in client) {
    return client as SupabaseClient;
  }
  return getSupabaseAdminClient() as SupabaseClient | null;
}

export async function authenticateTenantRoute(
  request: NextRequest,
  subdomain: string
): Promise<
  | { session: SessionPayload; errorResponse?: never }
  | { session?: never; errorResponse: NextResponse }
> {
  const sessionSecret = getSessionSecret();
  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  let session: SessionPayload;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const { validateSessionActive } = await import('@/lib/auth/session');
  const isActive = await validateSessionActive(session);
  if (!isActive) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    return {
      errorResponse: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { session };
}
