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
  client?: DatabaseClient | SupabaseClient<any>
): client is DatabaseClient {
  return (
    !!client &&
    (('query' in client && typeof (client as any).query === 'function') ||
      ('withTransaction' in client &&
        typeof (client as any).withTransaction === 'function'))
  );
}

export function getRouteSupabase(
  client?: DatabaseClient | SupabaseClient<any>
): SupabaseClient<any> | null {
  if (client && 'from' in client) {
    return client as SupabaseClient<any>;
  }
  return getSupabaseAdminClient() as SupabaseClient<any> | null;
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
