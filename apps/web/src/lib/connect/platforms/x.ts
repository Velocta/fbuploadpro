/**
 * X connect registration (Spec 127, on spec 123's framework).
 *
 * X runs on OUR single global app (D4/D7): every workspace's users
 * authorise the same app, so there are no per-workspace credentials —
 * the client ID/secret come from the environment (GitHub Secrets →
 * Vercel sync for the web token exchange; worker env for publishing),
 * never from `platform_credentials` and never from the product UI.
 *
 * Flow: OAuth 2.0 Authorization Code + PKCE against
 * `x.com/i/oauth2/authorize`; the code exchange runs server-side here
 * at `api.x.com/2/oauth2/token` with Basic auth. `state` and
 * `code_verifier` are the framework's short-lived server-side material
 * (signed state + httpOnly PKCE cookie) — this module never persists
 * them beyond the flow. On completion `GET /2/users/me` binds the X
 * user id + handle: the account row is the authorising user, and the
 * X user is its own single destination (`single-confirm`).
 */
import { X_OAUTH_SCOPES } from '@fbuploadpro/contracts';
import {
  hasPlatformConnectConfig,
  registerPlatformConnectConfig,
  type ConnectExchangeContext,
  type DiscoveredDestination,
  type ExchangedAccount,
  type PlatformConnectConfig,
} from '../registry';

export const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
export const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
export const X_API_BASE_URL = 'https://api.x.com/2';

/** Env var names holding the global app's credentials (names only — values live in secrets). */
export const X_CLIENT_ID_ENV = 'X_CLIENT_ID';
export const X_CLIENT_SECRET_ENV = 'X_CLIENT_SECRET';

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`);
  let binary = '';
  for (const b of bytes) binary += String.fromCodePoint(b);
  return `Basic ${btoa(binary)}`;
}

interface XUserMe {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

async function fetchXMe(fetchFn: typeof fetch, accessToken: string): Promise<XUserMe> {
  const res = await fetchFn(
    `${X_API_BASE_URL}/users/me?user.fields=profile_image_url`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const json = (await res.json().catch(() => null)) as {
    data?: XUserMe;
    detail?: string;
    title?: string;
  } | null;
  if (!res.ok || !json?.data?.id) {
    throw new Error(
      `X profile lookup failed: ${json?.detail ?? json?.title ?? `HTTP ${res.status}`}`
    );
  }
  return json.data;
}

export function createXConnectConfig(
  fetchFn: typeof fetch = globalThis.fetch
): PlatformConnectConfig {
  return {
    platform: 'x',
    authorizeUrl: X_AUTHORIZE_URL,
    clientIdSource: 'global',
    globalClientIdEnv: X_CLIENT_ID_ENV,
    globalClientSecretEnv: X_CLIENT_SECRET_ENV,
    scopes: [...X_OAUTH_SCOPES],
    usePkce: true,
    destinationMode: 'single-confirm',
    async exchangeCode(
      code: string,
      ctx: ConnectExchangeContext
    ): Promise<ExchangedAccount> {
      if (!ctx.clientSecret) {
        throw new Error('X app details are not configured.');
      }
      if (!ctx.codeVerifier) {
        throw new Error('X connect flow is missing its sign-in proof.');
      }
      const form = new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: ctx.redirectUri,
        code_verifier: ctx.codeVerifier,
      });
      const tokenRes = await fetchFn(X_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(ctx.clientId, ctx.clientSecret),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const tokenJson = (await tokenRes.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
        detail?: string;
        title?: string;
      } | null;
      if (!tokenRes.ok || !tokenJson?.access_token) {
        throw new Error(
          `X sign-in exchange failed: ${tokenJson?.detail ?? tokenJson?.title ?? `HTTP ${tokenRes.status}`}`
        );
      }
      const me = await fetchXMe(fetchFn, tokenJson.access_token);
      return {
        externalAccountId: me.id,
        displayName: me.name,
        avatarUrl: me.profile_image_url ?? null,
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token ?? null,
        expiresIn: tokenJson.expires_in ?? null,
        scopes: tokenJson.scope
          ? tokenJson.scope.split(' ').filter(Boolean)
          : [...X_OAUTH_SCOPES],
      };
    },
    async fetchDestinations(
      accessToken: string,
      account: ExchangedAccount
    ): Promise<DiscoveredDestination[]> {
      const me = await fetchXMe(fetchFn, accessToken);
      return [
        {
          externalDestinationId: account.externalAccountId,
          name: me.name,
          handle: me.username,
          avatarUrl: me.profile_image_url ?? null,
        },
      ];
    },
  };
}

/** Registers the X connect config once (idempotent — safe under hot reload/tests). */
export function registerXConnectConfig(): void {
  if (!hasPlatformConnectConfig('x')) {
    registerPlatformConnectConfig(createXConnectConfig());
  }
}

// Registration is a module side effect: importing this file (the
// connect routes and picker page do) makes X connectable.
registerXConnectConfig();
