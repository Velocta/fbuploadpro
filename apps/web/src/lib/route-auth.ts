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

/**
 * Shared session guard for API routes (spec 139): verifies the
 * fbup_session token AND re-validates the session against the live user
 * record via validateSessionActive (user still exists, status is
 * 'active', and the token was not issued at or before the latest
 * password change). Returns null for a missing, invalid, or no-longer-
 * active session. Deliberately uncached — every call re-reads the user
 * record, so suspension, deletion, and password rotation revoke
 * outstanding 30-day tokens on the very next request.
 */
export async function extractActiveSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    return null;
  }

  let session: SessionPayload | null = null;
  try {
    session = await verifySessionToken(sessionCookie, getSessionSecret());
  } catch {
    // Invalid/expired token — treated identically to a missing cookie.
    session = null;
  }
  if (!session) {
    return null;
  }

  const { validateSessionActive } = await import('@/lib/auth/session');
  const isActive = await validateSessionActive(session);
  return isActive ? session : null;
}

export async function authenticateTenantRoute(
  request: NextRequest,
  subdomain: string
): Promise<
  | { session: SessionPayload; errorResponse?: never }
  | { session?: never; errorResponse: NextResponse }
> {
  const session = await extractActiveSession(request);
  if (!session) {
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
