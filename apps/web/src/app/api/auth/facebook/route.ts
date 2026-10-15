import { type NextRequest, NextResponse } from 'next/server';
import {
  getSessionSecret,
  signOAuthState,
  verifySessionToken,
} from '@fbuploadpro/contracts';
import { getSupabaseClient } from '@/lib/supabase-auth';
import type { DatabaseClient } from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveWorkspaceFacebookCredentials } from '@/lib/server/byoc-resolver';

export async function handleInitiateFacebookOAuth(
  request: NextRequest,
  dbClient?: DatabaseClient | SupabaseClient<any>
): Promise<NextResponse> {
  const sessionSecret = getSessionSecret();
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

  // 2. Resolve workspace BYOC Facebook credentials
  const client = dbClient || getSupabaseClient();
  const byocResult = await resolveWorkspaceFacebookCredentials(
    client,
    session.subdomain,
    session.userId
  );

  if (!byocResult.ok) {
    const settingsUrl = new URL(`/tenant/${session.subdomain}/settings`, request.url);
    settingsUrl.searchParams.set('tab', 'byoc');
    settingsUrl.searchParams.set('error', 'credentials_required');
    return NextResponse.redirect(settingsUrl);
  }

  const effectiveAppId = byocResult.fbAppId;

  // 3. Generate signed OAuth state
  const expectedFbAccountId =
    request.nextUrl.searchParams.get('expectedFbAccountId')?.trim() || undefined;
  const expectedDisplayName =
    request.nextUrl.searchParams.get('expectedDisplayName')?.trim() || undefined;
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const state = await signOAuthState(
    {
      tenantSubdomain: session.subdomain,
      userId: session.userId,
      nonce,
      iat: now,
      exp: now + 600, // 10 minutes
      ...(expectedFbAccountId ? { expectedFbAccountId } : {}),
      ...(expectedDisplayName ? { expectedDisplayName } : {}),
    },
    sessionSecret
  );

  // 4. Construct Facebook OAuth Dialog URL (Graph API v26.0)
  const scopes =
    'pages_show_list,pages_read_engagement,pages_manage_posts,pages_manage_engagement,business_management';
  const oauthUrl = new URL('https://www.facebook.com/v26.0/dialog/oauth');
  oauthUrl.searchParams.set('client_id', effectiveAppId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('scope', scopes);
  oauthUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(oauthUrl.toString());
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleInitiateFacebookOAuth(request);
}
