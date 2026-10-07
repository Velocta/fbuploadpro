import { headers, cookies } from 'next/headers';
import { verifySessionToken, type SessionPayload, type UserRole } from '@fbuploadpro/contracts';

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  role: UserRole;
  subdomain: string;
}

export async function getServerSessionContext(): Promise<AuthenticatedUserContext | null> {
  const reqHeaders = await headers();
  const userId = reqHeaders.get('x-user-id');
  const role = reqHeaders.get('x-user-role') as UserRole | null;
  const email = reqHeaders.get('x-user-email');
  const subdomain = reqHeaders.get('x-user-subdomain');

  if (userId && role && email && subdomain) {
    return {
      userId,
      role,
      email,
      subdomain,
    };
  }

  // Fallback to cookie verification
  const cookieStore = await cookies();
  const token = cookieStore.get('fbup_session')?.value;
  if (!token) return null;

  const secret = process.env.SESSION_SECRET || 'super-secret-session-signing-key-minimum-32-chars-long';
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
