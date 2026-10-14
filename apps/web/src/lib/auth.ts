import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  getSessionSecret,
  verifySessionToken,
  type SessionPayload,
  type UserRole,
} from '@fbuploadpro/contracts';

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  role: UserRole;
  subdomain: string;
  allowedSubdomains?: string[] | undefined;
}

export async function getServerSessionContext(req?: NextRequest): Promise<AuthenticatedUserContext | null> {
  let token = req?.cookies?.get('fbup_session')?.value;
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore?.get('fbup_session')?.value;
    } catch {
      token = undefined;
    }
  }
  if (!token) {
    return null;
  }

  const secret = getSessionSecret();
  try {
    const session: SessionPayload = await verifySessionToken(token, secret);
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
      subdomain: session.subdomain,
      ...(session.allowedSubdomains ? { allowedSubdomains: session.allowedSubdomains } : {}),
    };
  } catch {
    return null;
  }
}
