import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  extractSubdomain,
  getTenantRewriteUrl,
  verifySessionToken,
  canAccessTenant,
  type SessionPayload,
} from '@fbuploadpro/contracts';

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /_next (Next.js internals)
     * 2. /favicon.ico, /robots.txt, static files with extensions (.svg, .png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

function extractToken(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('fbup_session')?.value;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

async function resolveSession(
  request: NextRequest,
  sessionSecret: string
): Promise<SessionPayload | null> {
  const token = extractToken(request);
  if (!token) return null;
  try {
    return await verifySessionToken(token, sessionSecret);
  } catch {
    return null;
  }
}

function buildAuthenticatedWorkspaceRedirect(
  request: NextRequest,
  session: SessionPayload,
  host: string,
  rootDomain: string
): NextResponse {
  const cleanHost = host.toLowerCase().split(':')[0] || '';
  const isLocalRoot = rootDomain.includes('localhost') || rootDomain.includes('127.0.0.1');
  const isLocalHost = cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1');

  if (cleanHost.endsWith('.vercel.app') || (isLocalRoot && !isLocalHost)) {
    return NextResponse.redirect(new URL(`/tenant/${session.subdomain}`, request.url));
  }

  const workspaceUrl = new URL(request.url);
  workspaceUrl.host = `${session.subdomain}.${rootDomain}`;
  workspaceUrl.pathname = '/';
  return NextResponse.redirect(workspaceUrl);
}

function buildTenantHeaders(
  request: NextRequest,
  subdomain: string,
  pathname: string,
  session: SessionPayload
): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-subdomain', subdomain);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-user-id', session.userId);
  requestHeaders.set('x-user-role', session.role);
  requestHeaders.set('x-user-email', session.email);
  requestHeaders.set('x-user-subdomain', session.subdomain);
  return requestHeaders;
}

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

function handleDirectTenantPathOnApex(
  request: NextRequest,
  pathSubdomain: string,
  pathname: string,
  session: SessionPayload | null
): NextResponse {
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', request.url);
    return NextResponse.redirect(loginUrl, 307);
  }

  if (session.status === 'suspended') {
    return NextResponse.redirect(new URL('/account-suspended', request.url), 307);
  }

  const access = canAccessTenant(session, pathSubdomain);
  if (!access.allowed) {
    if (access.reason === 'mismatch') {
      return NextResponse.redirect(new URL(`/tenant/${session.subdomain}`, request.url), 307);
    }
    return NextResponse.redirect(new URL('/login', request.url), 307);
  }

  const requestHeaders = buildTenantHeaders(request, pathSubdomain, pathname, session);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return applyNoStoreHeaders(response);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host') || '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const sessionSecret = process.env.SESSION_SECRET || 'super-secret-session-signing-key-minimum-32-chars-long';

  // System API routes and public static bypass tenant rewriting
  if (pathname.startsWith('/api') || pathname === '/account-suspended') {
    return NextResponse.next();
  }

  // Extract subdomain and determine routing target
  const { subdomain, isApex, isReserved } = extractSubdomain(host, rootDomain);

  // If apex domain or reserved system subdomain, serve root routes
  if (isApex || isReserved || !subdomain) {
    if (isApex && pathname.startsWith('/tenant/')) {
      const pathSubdomain = pathname.split('/')[2];
      if (pathSubdomain) {
        const session = await resolveSession(request, sessionSecret);
        return handleDirectTenantPathOnApex(request, pathSubdomain, pathname, session);
      }
    }

    if (subdomain === 'app' || isApex) {
      const session = await resolveSession(request, sessionSecret);
      const isLogoutSuccess = request.nextUrl.searchParams.get('logout') === 'success';
      const isEntryOrAuthRoute =
        pathname === '/' || pathname === '/login' || pathname === '/signup';

      if (session && session.status !== 'suspended' && !isLogoutSuccess && isEntryOrAuthRoute) {
        return buildAuthenticatedWorkspaceRedirect(request, session, host, rootDomain);
      }

      if (!session && subdomain === 'app' && pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    return NextResponse.next();
  }

  // Customer tenant subdomains only host private workspace routes (/, /accounts, etc.).
  const isAuthRoute =
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password';

  if (isAuthRoute) {
    const gatewayUrl = new URL(request.url);
    gatewayUrl.host = `app.${rootDomain}`;
    return NextResponse.redirect(gatewayUrl, 307);
  }

  const session = await resolveSession(request, sessionSecret);

  if (!session) {
    const loginUrl = new URL(request.url);
    loginUrl.host = `app.${rootDomain}`;
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('returnUrl', request.url);
    return NextResponse.redirect(loginUrl, 307);
  }

  if (session.status === 'suspended') {
    return NextResponse.redirect(new URL('/account-suspended', request.url), 307);
  }

  const access = canAccessTenant(session, subdomain);
  if (!access.allowed) {
    if (access.reason === 'mismatch') {
      const authorizedUrl = new URL(request.url);
      authorizedUrl.host = `${session.subdomain}.${rootDomain}`;
      return NextResponse.redirect(authorizedUrl, 307);
    }
    return NextResponse.redirect(new URL('/login', request.url), 307);
  }

  // Rewrite to tenant workspace path (/tenant/[subdomain]/*)
  const rewriteUrl = getTenantRewriteUrl(subdomain, pathname, request.url);
  const requestHeaders = buildTenantHeaders(request, subdomain, pathname, session);

  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  return applyNoStoreHeaders(response);
}
