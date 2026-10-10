import { type NextRequest, NextResponse } from 'next/server';
import {
  signOAuthState,
  verifyMagicLinkToken,
} from '@fbuploadpro/contracts';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';
  const appId = process.env.FACEBOOK_APP_ID || '';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    const errorUrl = new URL('/connect/facebook/error', request.url);
    errorUrl.searchParams.set('reason', 'missing_token');
    return NextResponse.redirect(errorUrl);
  }

  // 1. Verify 15-minute magic token
  let payload;
  try {
    payload = await verifyMagicLinkToken(token, sessionSecret);
  } catch (_e) {
    const errorUrl = new URL('/connect/facebook/error', request.url);
    errorUrl.searchParams.set('reason', 'expired_or_invalid');
    return NextResponse.redirect(errorUrl);
  }

  // 2. Generate signed OAuth state flagged with isMagic: true
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const state = await signOAuthState(
    {
      tenantSubdomain: payload.tenantSubdomain,
      userId: payload.userId,
      nonce,
      iat: now,
      exp: now + 600, // 10 minutes
      isMagic: true,
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
