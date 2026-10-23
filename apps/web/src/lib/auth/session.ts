/**
 * Session validity + session-cookie helpers (spec 137 §3.2.5 split).
 *
 * Split from the former 1,314-line auth monolith
 * by spec 137 PR-A1b (audit #6 / spec §3.2.5). Function bodies are
 * verbatim; only imports/exports were re-wired to the new modules.
 */

import type { NextResponse } from 'next/server';
import type { SessionPayload } from '@fbuploadpro/contracts';
import { getCookieDomain, getSupabaseAdminClient } from './clients';
import { findUserByEmail } from './users';

export async function validateSessionActive(session: SessionPayload): Promise<boolean> {
  if (session.status === 'suspended') return false;
  const user = await findUserByEmail(session.email);
  if (!user) {
    if (!getSupabaseAdminClient() && process.env.NODE_ENV !== 'production') {
      return session.status === 'active';
    }
    return false;
  }
  if (user.status !== 'active') return false;
  if (user.passwordUpdatedAt && session.iat <= user.passwordUpdatedAt) {
    return false;
  }
  return true;
}

export function purgeHostOnlySessionCookie(response: NextResponse): void {
  const isProduction = process.env.NODE_ENV === 'production';
  response.headers.append(
    'Set-Cookie',
    `fbup_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProduction ? '; Secure' : ''}`
  );
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  requestHost?: string | null
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = getCookieDomain(requestHost);

  response.cookies.set('fbup_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: 86400 * 30, // 30 days
  });

  if (domain) {
    purgeHostOnlySessionCookie(response);
  }
}
