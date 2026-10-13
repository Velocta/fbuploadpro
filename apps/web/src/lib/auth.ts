import { headers, cookies } from 'next/headers';
import {
  getSessionSecret,
  verifySessionToken,
  type SessionPayload,
  type UserRole,
  UserRoleSchema,
} from '@fbuploadpro/contracts';

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  role: UserRole;
  subdomain: string;
}

export async function getServerSessionContext(): Promise<AuthenticatedUserContext | null> {
  let cookieStore = null;
  try {
    cookieStore = await cookies();
  } catch {
    cookieStore = null;
  }

  const token = cookieStore?.get('fbup_session')?.value;
  if (token) {
    const secret = getSessionSecret();
    try {
      const session: SessionPayload = await verifySessionToken(token, secret);
      return {
        userId: session.userId,
        email: session.email,
        role: session.role,
        subdomain: session.subdomain,
      };
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV === 'test') {
    let reqHeaders: Headers | null = null;
    try {
      reqHeaders = await headers();
    } catch {
      reqHeaders = null;
    }

    if (reqHeaders) {
      const userId = reqHeaders.get('x-user-id');
      const rawRole = reqHeaders.get('x-user-role');
      const email = reqHeaders.get('x-user-email');
      const subdomain = reqHeaders.get('x-user-subdomain');

      if (userId && rawRole && email && subdomain) {
        const parsedRole = UserRoleSchema.safeParse(rawRole);
        if (parsedRole.success) {
          return {
            userId,
            role: parsedRole.data,
            email,
            subdomain,
          };
        }
      }
    }
  }

  return null;
}
