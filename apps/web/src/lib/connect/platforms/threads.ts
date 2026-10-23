/**
 * Threads connect registration (Spec 124, on spec 123's framework).
 *
 * BYOC with the THREADS pair: the workspace's Threads App ID/Secret
 * come from `platform_credentials` platform='threads' — the framework
 * resolves them per platform, so this flow can never receive the main
 * Meta (Facebook) App ID/Secret pair by accident. ⚠️ Using the main
 * Meta pair here is the classic error-452 trap: the Threads app is a
 * separate app in the dashboard with its own ID and secret, and the
 * Settings Threads tab says so in plain language.
 *
 * Hosts (build-time docs verification, recorded in the spec 124 PR):
 * the Threads web product moved from threads.net to threads.com, and
 * Meta's current docs show the authorize window on threads.com; the
 * API host in every corroborated token/publishing reference remains
 * `graph.threads.net`. This module builds on that pair:
 * authorize `threads.com/oauth/authorize`, API `graph.threads.net`.
 * The redirect address must match byte-for-byte at authorize and at
 * exchange — the framework builds it once from the same helper for
 * both legs, and this module passes `ctx.redirectUri` through
 * untouched.
 *
 * Code handling: the returned code is single-use, valid 1 hour, and
 * arrives with a trailing `#_` — stripped HERE, in the exchange,
 * before the code is sent anywhere. Token path: code → short-lived
 * (1-hour) → long-lived (60-day) via `th_exchange_token`, exchanged
 * server-side; the framework persists the long-lived token encrypted.
 * Threads user ids are Threads-scoped — never reuse Facebook or
 * Instagram ids; the account and its single destination are the
 * Threads profile itself (`single-confirm`).
 *
 * Guide facts the Settings copy carries (spec 124 §5): testers are
 * added under App Dashboard → Roles → Threads Testers AND must accept
 * in the Threads app (Settings → Account → Website Permissions →
 * Invites) — both steps. Own-account BYOC publishes fully in
 * Development mode with no App Review.
 */
import { THREADS_OAUTH_SCOPES } from '@fbuploadpro/contracts';
import {
  getPlatformCallbackUrls,
  type PlatformCallbackUrls,
} from '../../platforms/callback-urls';
import {
  hasPlatformConnectConfig,
  registerPlatformConnectConfig,
  type ConnectExchangeContext,
  type DiscoveredDestination,
  type ExchangedAccount,
  type PlatformConnectConfig,
} from '../registry';

export const THREADS_AUTHORIZE_URL = 'https://threads.com/oauth/authorize';
export const THREADS_API_BASE_URL = 'https://graph.threads.net';
export const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
export const THREADS_GRAPH_VERSIONED_BASE_URL = 'https://graph.threads.net/v1.0';

/**
 * The three stable public callback addresses the Threads app settings
 * require (sign-in redirect, deauthorize, data deletion) — resolved
 * through the shared callback-urls mechanism so the addresses this
 * flow uses can never drift from the ones the Settings tab displays.
 */
export function getThreadsCallbackUrls(origin?: string): PlatformCallbackUrls {
  return getPlatformCallbackUrls('threads', origin);
}

/** Strips the trailing `#_` Threads appends to the returned code. */
export function stripThreadsCodeSuffix(code: string): string {
  return code.endsWith('#_') ? code.slice(0, -2) : code;
}

export interface ThreadsProfile {
  id: string;
  username: string;
  name?: string | undefined;
  profilePictureUrl?: string | null | undefined;
}

async function fetchThreadsProfile(
  fetchFn: typeof fetch,
  accessToken: string
): Promise<ThreadsProfile> {
  const url =
    `${THREADS_GRAPH_VERSIONED_BASE_URL}/me?fields=` +
    'id,username,name,threads_profile_picture_url';
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => null)) as {
    id?: string;
    username?: string;
    name?: string;
    threads_profile_picture_url?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json?.id || !json?.username) {
    throw new Error(
      `Threads profile lookup failed: ${json?.error?.message ?? `HTTP ${res.status}`}`
    );
  }
  return {
    id: json.id,
    username: json.username,
    name: json.name,
    profilePictureUrl: json.threads_profile_picture_url ?? null,
  };
}

export function createThreadsConnectConfig(
  fetchFn: typeof fetch = globalThis.fetch
): PlatformConnectConfig {
  return {
    platform: 'threads',
    authorizeUrl: THREADS_AUTHORIZE_URL,
    clientIdSource: 'byoc',
    scopes: [...THREADS_OAUTH_SCOPES],
    usePkce: false,
    destinationMode: 'single-confirm',
    async exchangeCode(
      code: string,
      ctx: ConnectExchangeContext
    ): Promise<ExchangedAccount> {
      if (!ctx.clientSecret) {
        throw new Error('Threads app details are not saved for this workspace.');
      }
      const cleanCode = stripThreadsCodeSuffix(code);

      // Step 1: code → short-lived (1-hour) token. The redirect_uri is
      // the framework's, passed byte-for-byte as at authorize time.
      const form = new URLSearchParams({
        client_id: ctx.clientId,
        client_secret: ctx.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: ctx.redirectUri,
        code: cleanCode,
      });
      const tokenRes = await fetchFn(THREADS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const tokenJson = (await tokenRes.json().catch(() => null)) as {
        access_token?: string;
        user_id?: string | number;
        error?: { message?: string; code?: number };
      } | null;
      if (!tokenRes.ok || !tokenJson?.access_token) {
        throw new Error(
          `Threads sign-in exchange failed: ${tokenJson?.error?.message ?? `HTTP ${tokenRes.status}`}`
        );
      }
      const shortLivedToken = tokenJson.access_token;

      // Step 2: short-lived → long-lived (60-day) token.
      const longUrl =
        `${THREADS_API_BASE_URL}/access_token?grant_type=th_exchange_token` +
        `&client_secret=${encodeURIComponent(ctx.clientSecret)}` +
        `&access_token=${encodeURIComponent(shortLivedToken)}`;
      const longRes = await fetchFn(longUrl, { method: 'GET' });
      const longJson = (await longRes.json().catch(() => null)) as {
        access_token?: string;
        expires_in?: number;
        error?: { message?: string };
      } | null;
      if (!longRes.ok || !longJson?.access_token) {
        throw new Error(
          `Threads long-lived exchange failed: ${longJson?.error?.message ?? `HTTP ${longRes.status}`}`
        );
      }

      // Step 3: profile read — binds the Threads-scoped account id.
      const profile = await fetchThreadsProfile(fetchFn, longJson.access_token);
      if (
        tokenJson.user_id !== undefined &&
        profile.id !== String(tokenJson.user_id)
      ) {
        throw new Error('Threads sign-in returned a different account than expected.');
      }

      return {
        externalAccountId: profile.id,
        displayName: profile.name ?? profile.username,
        avatarUrl: profile.profilePictureUrl ?? null,
        accessToken: longJson.access_token,
        refreshToken: null,
        expiresIn: longJson.expires_in ?? null,
        scopes: [...THREADS_OAUTH_SCOPES],
      };
    },
    async fetchDestinations(
      accessToken: string,
      account: ExchangedAccount
    ): Promise<DiscoveredDestination[]> {
      const profile = await fetchThreadsProfile(fetchFn, accessToken);
      return [
        {
          externalDestinationId: account.externalAccountId,
          name: profile.name ?? profile.username,
          handle: profile.username,
          avatarUrl: profile.profilePictureUrl ?? null,
        },
      ];
    },
  };
}

/** Registers the Threads connect config once (idempotent). */
export function registerThreadsConnectConfig(): void {
  if (!hasPlatformConnectConfig('threads')) {
    registerPlatformConnectConfig(createThreadsConnectConfig());
  }
}

// Registration is a module side effect: importing this file (the
// connect routes and picker page do) makes Threads connectable.
registerThreadsConnectConfig();
