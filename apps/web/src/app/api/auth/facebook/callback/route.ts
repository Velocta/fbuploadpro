import { type NextRequest, NextResponse } from 'next/server';
import {
  encryptToken,
  FacebookTokenExchangeResponseSchema,
  FacebookUserProfileResponseSchema,
  verifyOAuthState,
} from '@fbuploadpro/contracts';
import { getDbClient } from '../../../../../lib/db';
import type { DatabaseClient } from '@fbuploadpro/database';

export async function handleFacebookCallback(
  request: NextRequest,
  dbClient?: DatabaseClient
): Promise<NextResponse> {
  const sessionSecret =
    process.env.SESSION_SECRET ||
    'super-secret-session-signing-key-minimum-32-chars-long';
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || '';
  const appId = process.env.FACEBOOK_APP_ID || '';
  const appSecret = process.env.FACEBOOK_APP_SECRET || '';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/facebook/callback`;

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle upstream OAuth cancellation or error
  if (error) {
    const target = new URL('/accounts', request.url);
    target.searchParams.set('error', error);
    if (errorDescription) {
      target.searchParams.set('error_description', errorDescription);
    }
    return NextResponse.redirect(target);
  }

  if (!code || !state) {
    const target = new URL('/accounts', request.url);
    target.searchParams.set('error', 'missing_code_or_state');
    return NextResponse.redirect(target);
  }

  // 1. Verify signed OAuth state
  let statePayload;
  try {
    statePayload = await verifyOAuthState(state, sessionSecret);
  } catch (_e) {
    const target = new URL('/accounts', request.url);
    target.searchParams.set('error', 'invalid_oauth_state');
    return NextResponse.redirect(target);
  }

  const { tenantSubdomain, userId } = statePayload;
  const destinationUrl = new URL(
    `/tenant/${tenantSubdomain}/accounts`,
    request.url
  );

  try {
    // 2. Exchange temporary code for short-lived token (Graph API v26.0)
    const codeExchangeUrl = new URL(
      'https://graph.facebook.com/v26.0/oauth/access_token'
    );
    codeExchangeUrl.searchParams.set('client_id', appId);
    codeExchangeUrl.searchParams.set('client_secret', appSecret);
    codeExchangeUrl.searchParams.set('redirect_uri', redirectUri);
    codeExchangeUrl.searchParams.set('code', code);

    const shortTokenRes = await fetch(codeExchangeUrl.toString(), {
      method: 'POST',
    });
    if (!shortTokenRes.ok) {
      destinationUrl.searchParams.set('error', 'token_exchange_failed');
      return NextResponse.redirect(destinationUrl);
    }
    const shortTokenJson = await shortTokenRes.json();
    const shortTokenData =
      FacebookTokenExchangeResponseSchema.parse(shortTokenJson);

    // 3. Exchange short-lived token for 60-day long-lived token
    const longTokenUrl = new URL(
      'https://graph.facebook.com/v26.0/oauth/access_token'
    );
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', appId);
    longTokenUrl.searchParams.set('client_secret', appSecret);
    longTokenUrl.searchParams.set(
      'fb_exchange_token',
      shortTokenData.access_token
    );

    const longTokenRes = await fetch(longTokenUrl.toString(), {
      method: 'GET',
    });
    if (!longTokenRes.ok) {
      destinationUrl.searchParams.set('error', 'long_token_exchange_failed');
      return NextResponse.redirect(destinationUrl);
    }
    const longTokenJson = await longTokenRes.json();
    const longTokenData =
      FacebookTokenExchangeResponseSchema.parse(longTokenJson);

    // 4. Fetch user profile from /me
    const meUrl = new URL('https://graph.facebook.com/v26.0/me');
    meUrl.searchParams.set('fields', 'id,name,picture{url}');
    const meRes = await fetch(meUrl.toString(), {
      headers: {
        Authorization: `Bearer ${longTokenData.access_token}`,
      },
    });
    if (!meRes.ok) {
      destinationUrl.searchParams.set('error', 'profile_fetch_failed');
      return NextResponse.redirect(destinationUrl);
    }
    const meJson = await meRes.json();
    const meProfile = FacebookUserProfileResponseSchema.parse(meJson);
    const profilePictureUrl = meProfile.picture?.data?.url ?? null;

    // 5. Encrypt long-lived token using Web Crypto AES-256-GCM
    const encryptedToken = await encryptToken(
      longTokenData.access_token,
      encryptionKey
    );

    const expiresInSeconds = longTokenData.expires_in ?? 5184000; // ~60 days
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 6. Upsert into database
    const db = dbClient ?? getDbClient();
    await db.query(
      `INSERT INTO facebook_accounts (
        user_id, fb_account_id, display_name, encrypted_access_token, token_expires_at, profile_picture_url, status, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'active', now())
      ON CONFLICT (user_id, fb_account_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        encrypted_access_token = EXCLUDED.encrypted_access_token,
        token_expires_at = EXCLUDED.token_expires_at,
        profile_picture_url = EXCLUDED.profile_picture_url,
        status = 'active',
        updated_at = now()
      RETURNING id`,
      [
        userId,
        meProfile.id,
        meProfile.name,
        encryptedToken,
        expiresAt,
        profilePictureUrl,
      ]
    );

    destinationUrl.searchParams.set('connected', '1');
    return NextResponse.redirect(destinationUrl);
  } catch (err) {
    // Redirect to destination with safe generic error parameter rather than leaking internal details
    console.warn('[FacebookOAuth] Callback exchange error:', err instanceof Error ? err.message : String(err));
    destinationUrl.searchParams.set('error', 'internal_oauth_error');
    return NextResponse.redirect(destinationUrl);
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return await handleFacebookCallback(request);
}
