import { type NextRequest, NextResponse } from 'next/server';
import { buildTenantUrl, getSessionSecret } from '@fbuploadpro/contracts';
import {
  getPlatformConnectConfig,
  isKnownPlatform,
} from '@/lib/connect/registry';
import {
  buildConnectCallbackUrl,
  signPendingDestinations,
  verifyConnectState,
  verifyPkceCookie,
  CONNECT_PENDING_TTL_SECONDS,
  PENDING_COOKIE_NAME,
  PKCE_COOKIE_NAME,
} from '@/lib/connect/state';
import {
  persistConnectedAccount,
  resolvePlatformClientCredentials,
  type ConnectDbClient,
} from '@/lib/connect/persist';
import { resolveConnectDbClient } from '@/lib/connect/session';
import { mapProviderDenial, type ConnectNoticeCode } from '@/lib/connect/errors';

function pickerRedirect(
  request: NextRequest,
  subdomain: string,
  platform: string,
  rootDomain: string,
  notice?: ConnectNoticeCode
): NextResponse {
  const url = buildTenantUrl(
    subdomain,
    `/connect/${platform}`,
    request.url,
    rootDomain
  );
  if (notice) {
    url.searchParams.set('notice', notice);
  }
  return NextResponse.redirect(url);
}

/**
 * GET /api/connect/[platform]/callback — the address platforms return to.
 *
 * Verifies the signed state, surfaces a denial as a plain-language notice,
 * exchanges the code through the registered platform config, persists the
 * account (tokens encrypted; reconnects re-bind the same row), stashes the
 * discovered destinations in a signed cookie, and redirects to the picker.
 */
export async function handleConnectCallback(
  request: NextRequest,
  platformParam: string,
  dbClient?: ConnectDbClient
): Promise<NextResponse> {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '';
  const sessionSecret = getSessionSecret();
  const params = request.nextUrl.searchParams;
  const errorParam = params.get('error');
  const code = params.get('code');
  const stateParam = params.get('state');

  if (!isKnownPlatform(platformParam)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 });
  }
  const platform = platformParam;

  if (!stateParam) {
    const fallback = new URL('/accounts', request.url);
    fallback.searchParams.set('error', 'connect_failed');
    return NextResponse.redirect(fallback);
  }

  let statePayload;
  try {
    statePayload = await verifyConnectState(stateParam, sessionSecret);
  } catch (err) {
    console.error('[connect/callback] State verification failed:', err);
    const fallback = new URL('/accounts', request.url);
    fallback.searchParams.set('error', 'connect_failed');
    return NextResponse.redirect(fallback);
  }

  if (statePayload.platform !== platform) {
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'expired_link'
    );
  }

  if (errorParam) {
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      mapProviderDenial(errorParam)
    );
  }

  if (!code) {
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'missing_reply'
    );
  }

  const config = getPlatformConnectConfig(platform);
  if (!config) {
    console.error(
      `[connect/callback] No connect config registered for platform "${platform}".`
    );
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'connect_failed'
    );
  }

  const client = resolveConnectDbClient(dbClient);
  if (!client) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  // PKCE verifier, when this flow used PKCE, rides in a signed cookie
  // matched to the state nonce.
  let codeVerifier: string | null = null;
  if (config.usePkce) {
    const pkceCookie = request.cookies.get(PKCE_COOKIE_NAME)?.value;
    if (pkceCookie) {
      try {
        const pkcePayload = await verifyPkceCookie(pkceCookie, sessionSecret);
        if (
          pkcePayload.nonce === statePayload.nonce &&
          pkcePayload.platform === platform
        ) {
          codeVerifier = pkcePayload.codeVerifier;
        }
      } catch (err) {
        console.error('[connect/callback] PKCE cookie invalid:', err);
      }
    }
    if (!codeVerifier) {
      return pickerRedirect(
        request,
        statePayload.tenantSubdomain,
        platform,
        rootDomain,
        'expired_link'
      );
    }
  }

  // Client credentials for the exchange: the workspace's own app details
  // for BYOC platforms, our global app otherwise.
  let clientId = '';
  let clientSecret: string | null = null;
  if (config.resolveClientId) {
    clientId =
      (await config.resolveClientId({ workspaceId: statePayload.workspaceId })) ??
      '';
  }
  if (config.clientIdSource === 'byoc') {
    const credentials = await resolvePlatformClientCredentials(
      client,
      statePayload.workspaceId,
      platform
    );
    if (!credentials) {
      return pickerRedirect(
        request,
        statePayload.tenantSubdomain,
        platform,
        rootDomain,
        'credentials_required'
      );
    }
    clientId = credentials.clientId;
    clientSecret = credentials.clientSecret;
  } else if (!clientId) {
    const idEnv =
      config.globalClientIdEnv ?? `CONNECT_${platform.toUpperCase()}_CLIENT_ID`;
    const secretEnv =
      config.globalClientSecretEnv ??
      `CONNECT_${platform.toUpperCase()}_CLIENT_SECRET`;
    clientId = process.env[idEnv] ?? '';
    clientSecret = process.env[secretEnv] ?? null;
  }

  const redirectUri = buildConnectCallbackUrl(request.url, platform);

  let exchanged;
  try {
    exchanged = await config.exchangeCode(code, {
      code,
      redirectUri,
      codeVerifier,
      clientId,
      clientSecret,
      workspaceId: statePayload.workspaceId,
      userId: statePayload.userId,
    });
  } catch (err) {
    console.error(
      `[connect/callback] Code exchange failed for platform "${platform}":`,
      err
    );
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'connect_failed'
    );
  }

  let accountId: string;
  try {
    const persisted = await persistConnectedAccount(client, {
      workspaceId: statePayload.workspaceId,
      platform,
      exchanged,
    });
    accountId = persisted.accountId;
  } catch (err) {
    console.error('[connect/callback] Failed to persist account:', err);
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'connect_failed'
    );
  }

  let destinations;
  try {
    destinations = await config.fetchDestinations(
      exchanged.accessToken,
      exchanged
    );
  } catch (err) {
    console.error(
      `[connect/callback] Destination discovery failed for platform "${platform}":`,
      err
    );
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'connect_failed'
    );
  }

  if (!destinations || destinations.length === 0) {
    return pickerRedirect(
      request,
      statePayload.tenantSubdomain,
      platform,
      rootDomain,
      'nothing_found'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const pendingValue = await signPendingDestinations(
    {
      accountId,
      workspaceId: statePayload.workspaceId,
      tenantSubdomain: statePayload.tenantSubdomain,
      platform,
      destinations,
      exp: now + CONNECT_PENDING_TTL_SECONDS,
    },
    sessionSecret
  );

  const response = pickerRedirect(
    request,
    statePayload.tenantSubdomain,
    platform,
    rootDomain
  );
  response.cookies.set(PENDING_COOKIE_NAME, pendingValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CONNECT_PENDING_TTL_SECONDS,
  });
  if (config.usePkce) {
    response.cookies.set(PKCE_COOKIE_NAME, '', {
      httpOnly: true,
      path: '/api/connect',
      maxAge: 0,
    });
  }
  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await context.params;
  return handleConnectCallback(request, platform);
}
