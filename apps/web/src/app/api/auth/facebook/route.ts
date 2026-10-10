import { type NextRequest, NextResponse } from 'next/server';
import {
  signOAuthState,
  verifySessionToken,
} from '@fbuploadpro/contracts';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';
  const appId = process.env.FACEBOOK_APP_ID || '';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  // 1. Authenticate user from session cookie
  const sessionCookie = request.cookies.get('fbup_session')?.value;
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  let session;
  try {
    session = await verifySessionToken(sessionCookie, sessionSecret);
  } catch (_e) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Generate signed OAuth state
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const state = await signOAuthState(
    {
      tenantSubdomain: session.subdomain,
      userId: session.userId,
      nonce,
      iat: now,
      exp: now + 600, // 10 minutes
    },
    sessionSecret
  );

  // 3. Construct Facebook OAuth Dialog URL (Graph API v26.0)
  const scopes =
    'pages_show_list,pages_read_engagement,pages_manage_posts,business_management';
  const oauthUrl = new URL('https://www.facebook.com/v26.0/dialog/oauth');
  oauthUrl.searchParams.set('client_id', appId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('scope', scopes);
  oauthUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(oauthUrl.toString());
}
