/**
 * Instagram connect registration (Spec 124, on spec 123's framework).
 *
 * BYOC: the workspace supplies its own Meta app details (Settings →
 * Instagram tab, stored in `platform_credentials`); this flow reads
 * them through the framework — the Threads-pair trap does not apply
 * here, but the pair used is always THIS workspace's Instagram app.
 *
 * Route (D2, DECIDED): Instagram-Login ONLY — the authorize window is
 * Instagram's own (`api.instagram.com/oauth/authorize`), never the
 * Facebook-Login dialog. The account must be Professional (Business or
 * Creator): a personal account cannot publish, so the exchange reads
 * the profile and refuses a non-Professional account in plain
 * language. (Spec 123's callback maps any exchange failure to the
 * framework's plain-language "couldn't finish connecting" notice; the
 * specific reason is logged here server-side.)
 *
 * Token path: code → 1-hour short-lived token → 60-day long-lived
 * token, both exchanged server-side here; the framework persists the
 * long-lived token encrypted. The destination is the IG account
 * itself: its external id is the destination id, presented through
 * the framework's picker (spec 123's fixture mode for Instagram).
 *
 * Guide facts the Settings copy carries (spec 124 §1): where the app
 * is in Development mode, the account owner accepts the tester invite
 * in the Instagram app (Settings → Apps and websites → Tester
 * Invites). The own-account case needs no App Review and no business
 * verification — Standard Access covers role-holders.
 */
import { INSTAGRAM_OAUTH_SCOPES } from '@fbuploadpro/contracts';
import {
  hasPlatformConnectConfig,
  registerPlatformConnectConfig,
  type ConnectExchangeContext,
  type DiscoveredDestination,
  type ExchangedAccount,
  type PlatformConnectConfig,
} from '../registry';

export const INSTAGRAM_AUTHORIZE_URL = 'https://api.instagram.com/oauth/authorize';
export const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
export const INSTAGRAM_GRAPH_BASE_URL = 'https://graph.instagram.com';
export const INSTAGRAM_GRAPH_VERSIONED_BASE_URL = 'https://graph.instagram.com/v26.0';

/** Professional account types that can publish. Anything else is refused. */
export const INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES: readonly string[] = [
  'BUSINESS',
  'MEDIA_CREATOR',
  'CREATOR',
];

export function isProfessionalInstagramAccountType(
  accountType: string | null | undefined
): boolean {
  if (!accountType) return false;
  return INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES.includes(
    accountType.trim().toUpperCase()
  );
}

export interface InstagramProfile {
  id: string;
  username: string;
  name?: string | undefined;
  accountType: string | null;
  profilePictureUrl?: string | null | undefined;
}

async function fetchInstagramProfile(
  fetchFn: typeof fetch,
  accessToken: string
): Promise<InstagramProfile> {
  const url =
    `${INSTAGRAM_GRAPH_VERSIONED_BASE_URL}/me?fields=` +
    'id,username,name,account_type,profile_picture_url';
  const res = await fetchFn(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json().catch(() => null)) as {
    id?: string;
    username?: string;
    name?: string;
    account_type?: string;
    profile_picture_url?: string;
    error?: { message?: string };
  } | null;
  if (!res.ok || !json?.id || !json?.username) {
    throw new Error(
      `Instagram profile lookup failed: ${json?.error?.message ?? `HTTP ${res.status}`}`
    );
  }
  return {
    id: json.id,
    username: json.username,
    name: json.name,
    accountType: json.account_type ?? null,
    profilePictureUrl: json.profile_picture_url ?? null,
  };
}

export function createInstagramConnectConfig(
  fetchFn: typeof fetch = globalThis.fetch
): PlatformConnectConfig {
  return {
    platform: 'instagram',
    authorizeUrl: INSTAGRAM_AUTHORIZE_URL,
    clientIdSource: 'byoc',
    scopes: [...INSTAGRAM_OAUTH_SCOPES],
    usePkce: false,
    destinationMode: 'picker',
    async exchangeCode(
      code: string,
      ctx: ConnectExchangeContext
    ): Promise<ExchangedAccount> {
      if (!ctx.clientSecret) {
        throw new Error('Instagram app details are not saved for this workspace.');
      }

      // Step 1: code → short-lived (1-hour) token + IG user id.
      const form = new URLSearchParams({
        client_id: ctx.clientId,
        client_secret: ctx.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: ctx.redirectUri,
        code,
      });
      const tokenRes = await fetchFn(INSTAGRAM_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      const tokenJson = (await tokenRes.json().catch(() => null)) as {
        access_token?: string;
        user_id?: string | number;
        error_message?: string;
        error?: { message?: string };
      } | null;
      if (!tokenRes.ok || !tokenJson?.access_token) {
        throw new Error(
          `Instagram sign-in exchange failed: ${tokenJson?.error_message ?? tokenJson?.error?.message ?? `HTTP ${tokenRes.status}`}`
        );
      }
      const shortLivedToken = tokenJson.access_token;
      const tokenUserId =
        tokenJson.user_id !== undefined ? String(tokenJson.user_id) : null;

      // Step 2: short-lived → long-lived (60-day) token.
      const longLivedUrl =
        `${INSTAGRAM_GRAPH_BASE_URL}/access_token?grant_type=ig_exchange_token` +
        `&client_secret=${encodeURIComponent(ctx.clientSecret)}` +
        `&access_token=${encodeURIComponent(shortLivedToken)}`;
      const longRes = await fetchFn(longLivedUrl, { method: 'GET' });
      const longJson = (await longRes.json().catch(() => null)) as {
        access_token?: string;
        expires_in?: number;
        error?: { message?: string };
      } | null;
      if (!longRes.ok || !longJson?.access_token) {
        throw new Error(
          `Instagram long-lived exchange failed: ${longJson?.error?.message ?? `HTTP ${longRes.status}`}`
        );
      }

      // Step 3: profile read — binds the account and enforces the
      // Professional-account rule with a plain-language refusal.
      const profile = await fetchInstagramProfile(fetchFn, longJson.access_token);
      if (tokenUserId && profile.id !== tokenUserId) {
        throw new Error('Instagram sign-in returned a different account than expected.');
      }
      if (!isProfessionalInstagramAccountType(profile.accountType)) {
        console.warn(
          '[connect/instagram] Refused a non-Professional Instagram account',
          { accountType: profile.accountType }
        );
        throw new Error(
          'This Instagram account is a personal account. Switch it to a Professional account (Business or Creator) in the Instagram app, then connect again.'
        );
      }

      return {
        externalAccountId: profile.id,
        displayName: profile.name ?? profile.username,
        avatarUrl: profile.profilePictureUrl ?? null,
        accessToken: longJson.access_token,
        refreshToken: null,
        expiresIn: longJson.expires_in ?? null,
        scopes: [...INSTAGRAM_OAUTH_SCOPES],
      };
    },
    async fetchDestinations(
      accessToken: string,
      account: ExchangedAccount
    ): Promise<DiscoveredDestination[]> {
      const profile = await fetchInstagramProfile(fetchFn, accessToken);
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

/** Registers the Instagram connect config once (idempotent). */
export function registerInstagramConnectConfig(): void {
  if (!hasPlatformConnectConfig('instagram')) {
    registerPlatformConnectConfig(createInstagramConnectConfig());
  }
}

// Registration is a module side effect: importing this file (the
// connect routes and picker page do) makes Instagram connectable.
registerInstagramConnectConfig();
