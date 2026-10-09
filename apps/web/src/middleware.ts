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
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
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
    // Central App Gateway (app.fbuploadpro.com) handling
    if (subdomain === 'app') {
      let session: SessionPayload | null = null;
      const token = extractToken(request);
      if (token) {
        try {
          session = await verifySessionToken(token, sessionSecret);
        } catch {
          session = null;
        }
      }

      const isLogoutSuccess = request.nextUrl.searchParams.get('logout') === 'success';

      // If already authenticated and visiting app root, login, or signup, redirect to their tenant workspace (unless explicit logout)
      if (session && !isLogoutSuccess && (pathname === '/' || pathname === '/login' || pathname === '/signup')) {
        const workspaceUrl = new URL(request.url);
        workspaceUrl.host = `${session.subdomain}.${rootDomain}`;
        workspaceUrl.pathname = '/';
        return NextResponse.redirect(workspaceUrl);
      }

      // If unauthenticated on app root (/), redirect to /login
      if (!session && pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    return NextResponse.next();
  }

  // Customer tenant subdomains only host private workspace routes (/, /accounts, etc.).
  // Any attempt to access centralized auth routes (/login, /signup, /forgot-password, /reset-password)
  // on a tenant subdomain is cleanly 307 redirected to the central gateway (app.${rootDomain}) preserving query params.
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

  let session: SessionPayload | null = null;
  const token = extractToken(request);

  if (token) {
    try {
      session = await verifySessionToken(token, sessionSecret);
    } catch {
      session = null;
    }
  }

  if (!session) {
    // Redirect unauthenticated tenant access to central app login
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
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-subdomain', subdomain);
  requestHeaders.set('x-pathname', pathname);

  if (session) {
    requestHeaders.set('x-user-id', session.userId);
    requestHeaders.set('x-user-role', session.role);
    requestHeaders.set('x-user-email', session.email);
    requestHeaders.set('x-user-subdomain', session.subdomain);
  }

  const response = NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: requestHeaders,
    },
  });

  // Prevent browser back-forward cache (bfcache) leaks on authenticated views
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}
