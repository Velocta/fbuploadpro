/**
 * Session + client resolution shared by the connect routes, following the
 * same pattern as the tenant settings routes (fbup_session cookie,
 * verifySessionToken, canAccessTenant).
 */
import type { NextRequest } from 'next/server';
import {
  canAccessTenant,
  getSessionSecret,
  verifySessionToken,
  type SessionPayload,
} from '@fbuploadpro/contracts';
import { getSupabaseAdminClient } from '@/lib/supabase-auth';
import type { ConnectDbClient } from './persist';

export async function extractConnectSession(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get('fbup_session')?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token, getSessionSecret());
  } catch {
    return null;
  }
}

export function resolveConnectDbClient(
  dbClient?: ConnectDbClient | null
): ConnectDbClient | null {
  if (dbClient) return dbClient;
  return (getSupabaseAdminClient() as ConnectDbClient | null) ?? null;
}

export function sessionCanAccessTenant(
  session: SessionPayload,
  subdomain: string
): boolean {
  return canAccessTenant(session, subdomain).allowed;
}
