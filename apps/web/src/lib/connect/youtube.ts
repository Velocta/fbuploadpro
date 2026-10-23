/**
 * YouTube connect registration (Spec 125, D3 — via Post for Me).
 *
 * YouTube is provider-managed: our publishing partner (Post for Me)
 * holds the Google app and the channel tokens. There is NO Google
 * OAuth here, no workspace credential form, and no
 * `platform_credentials` row for YouTube — ever.
 *
 * How the provider's link flow maps onto spec 123's framework:
 *  - Initiation: the framework redirects the browser to this config's
 *    `authorizeUrl`, which is OUR OWN shim
 *    (`/api/connect/youtube/authorize`). The shim asks the provider
 *    (server-side, with our API key) for a fresh auth URL and sends
 *    the browser on to the provider-hosted flow.
 *  - Return: the provider redirects back to the shim's return route
 *    (`/api/connect/youtube/return`) with `isSuccess` / `accountIds`
 *    / `error` — not an OAuth code. The return route translates a
 *    success into the framework callback, carrying the provider
 *    account id(s) as the `code`.
 *  - `exchangeCode` treats that code as the provider account id and
 *    READS THE ACCOUNT BACK from the provider: the channel identity
 *    persisted (and later shown for confirmation) always comes from
 *    the provider's read-back, never from redirect parameters.
 *  - `fetchDestinations` reads the account back again and returns
 *    its single channel as a `single-confirm` destination — the
 *    user must check the channel identity and confirm before
 *    anything is saved (spec 125 read-back-and-confirm). An account
 *    with no channel yields no destinations, and the framework
 *    answers with the plain-language `nothing_found` notice.
 *  - The provider account ref travels on the discovered destination
 *    and is written into `social_accounts.metadata` and
 *    `destinations.metadata` by the YouTube complete route
 *    (`/api/connect/youtube/complete`) — the worker's YouTube
 *    publisher reads it from the destination metadata.
 *
 * The API key is read from the web app's server env
 * (POST_FOR_ME_API_KEY) at call time. It is never sent to the
 * browser, never stored in the database, and the `client_id` the
 * framework appends to our own authorize URL is the non-secret
 * marker `post-for-me` (see `resolveClientId`).
 *
 * ASSUMPTIONS (live-verification-pending — no provider account or
 * API key exists yet; see the spec 125 PR record):
 *  - The provider's post-connect redirect appends `accountIds` as a
 *    comma-separated list; v1 connects the first account returned.
 *  - The provider account object carries the channel id as
 *    `platform_account_id` / `external_id`, the channel name as
 *    `display_name` / `username`, and an avatar as
 *    `profile_image_url` / `avatar_url` (fields read flexibly).
 */
import {
  hasPlatformConnectConfig,
  registerPlatformConnectConfig,
  type DiscoveredDestination,
  type ExchangedAccount,
  type PlatformConnectConfig,
} from './registry';

const POST_FOR_ME_BASE_URL = 'https://api.postforme.dev/v1';

/** Non-secret marker used as the framework `client_id` for YouTube. */
export const YOUTUBE_CONNECT_CLIENT_MARKER = 'post-for-me';

/** A connected account as the provider lists it. Extra fields pass through. */
export interface PostForMeSocialAccount {
  id: string;
  platform?: string;
  username?: string | null;
  display_name?: string | null;
  platform_account_id?: string | null;
  external_account_id?: string | null;
  external_id?: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
}

/** The provider calls the YouTube connect flow depends on — mockable in tests. */
export interface PostForMeConnectClient {
  createAuthUrl(input: {
    platform: string;
    redirectUrl: string;
  }): Promise<{ url: string }>;
  getSocialAccount(id: string): Promise<PostForMeSocialAccount | null>;
}

export interface PostForMeConnectClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

function providerApiKey(explicit?: string): string {
  const key = explicit ?? process.env.POST_FOR_ME_API_KEY ?? '';
  if (!key) {
    throw new Error(
      'POST_FOR_ME_API_KEY is not configured; YouTube connect is unavailable.'
    );
  }
  return key;
}

async function providerRequest<T>(
  options: PostForMeConnectClientOptions,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? POST_FOR_ME_BASE_URL).replace(/\/+$/, '');
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${providerApiKey(options.apiKey)}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    throw new Error(
      `Post for Me request failed with status ${response.status}`
    );
  }
  const record = parsed as Record<string, unknown> | null;
  if (record && typeof record.data === 'object' && record.data !== null) {
    return record.data as T;
  }
  return parsed as T;
}

/**
 * The web-side Post for Me client for the connect flow. Transport
 * only — the worker carries its own copy for publishing (the two
 * runtimes share no code); endpoints mirror
 * `apps/worker/src/providers/post-for-me-youtube.ts`.
 */
export function createPostForMeConnectClient(
  options: PostForMeConnectClientOptions = {}
): PostForMeConnectClient {
  return {
    async createAuthUrl(input) {
      return providerRequest<{ url: string }>(
        options,
        'POST',
        '/social-accounts/auth-url',
        {
          platform: input.platform,
          // ASSUMPTION (live-verification-pending): field name per the
          // provider's generated SDK references; see the file header.
          redirect_url_override: input.redirectUrl,
        }
      );
    },
    async getSocialAccount(id) {
      try {
        return await providerRequest<PostForMeSocialAccount>(
          options,
          'GET',
          `/social-accounts/${encodeURIComponent(id)}`
        );
      } catch {
        // The singular read may not exist for every plan; fall back
        // to the documented list endpoint and match by id.
        const list = await providerRequest<unknown>(
          options,
          'GET',
          '/social-accounts?platform=youtube'
        );
        const accounts = Array.isArray(list)
          ? (list as PostForMeSocialAccount[])
          : ((list as { data?: PostForMeSocialAccount[] })?.data ?? []);
        return accounts.find((account) => account.id === id) ?? null;
      }
    },
  };
}

function stringField(
  record: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** The YouTube channel id behind a provider account, when it has one. */
export function channelIdFromProviderAccount(
  account: PostForMeSocialAccount
): string | null {
  return stringField(account, [
    'platform_account_id',
    'external_id',
    'external_account_id',
  ]);
}

export interface YouTubeExchangedAccount extends ExchangedAccount {
  /** The provider's social account id (`sa_…`) — our publishing ref. */
  providerAccountId: string;
  /** The YouTube channel id, or null when the account has no channel. */
  channelId: string | null;
}

export interface YouTubeDiscoveredDestination extends DiscoveredDestination {
  /** Carried through the pending cookie so the complete route can persist it. */
  providerAccountId: string;
}

/**
 * The framework's `code` for YouTube is the provider account id from
 * the provider's return redirect. This step reads the account back
 * from the provider — the persisted identity is always the
 * read-back, never the redirect parameters.
 */
export async function exchangeYouTubeCode(
  client: PostForMeConnectClient,
  code: string
): Promise<YouTubeExchangedAccount> {
  const providerAccountId = code.split(',')[0]?.trim() ?? '';
  if (!providerAccountId) {
    throw new Error('The provider did not return an account to connect.');
  }
  const account = await client.getSocialAccount(providerAccountId);
  if (!account) {
    throw new Error('The connected account could not be read back.');
  }
  const channelId = channelIdFromProviderAccount(account);
  return {
    // With a channel, the account's external identity is the channel;
    // without one, fall back to the provider ref so the account row
    // still persists and the no-channel path can explain itself.
    externalAccountId: channelId ?? providerAccountId,
    displayName:
      stringField(account, ['display_name', 'username']) ??
      'YouTube channel',
    avatarUrl: stringField(account, ['profile_image_url', 'avatar_url']),
    // Provider-managed: there is no token of ours to store.
    accessToken: '',
    refreshToken: null,
    expiresIn: null,
    scopes: [],
    providerAccountId,
    channelId,
  };
}

/**
 * Discovers the account's channel for the read-back-and-confirm
 * step. Reads the provider account back fresh; an account with no
 * channel returns no destinations (the framework then shows the
 * plain-language `nothing_found` explanation).
 */
export async function fetchYouTubeDestinations(
  client: PostForMeConnectClient,
  account: ExchangedAccount
): Promise<YouTubeDiscoveredDestination[]> {
  const exchanged = account as YouTubeExchangedAccount;
  if (!exchanged.providerAccountId) return [];
  const fresh = await client.getSocialAccount(exchanged.providerAccountId);
  if (!fresh) return [];
  const channelId = channelIdFromProviderAccount(fresh);
  if (!channelId) return [];
  return [
    {
      externalDestinationId: channelId,
      name:
        stringField(fresh, ['display_name', 'username']) ??
        'YouTube channel',
      handle: stringField(fresh, ['username']),
      avatarUrl: stringField(fresh, ['profile_image_url', 'avatar_url']),
      providerAccountId: exchanged.providerAccountId,
    },
  ];
}

export interface YouTubeConnectConfigDeps {
  client?: PostForMeConnectClient;
  /** Absolute origin of this web app, for our own authorize shim URL. */
  appOrigin?: string;
}

export function createYouTubeConnectConfig(
  deps: YouTubeConnectConfigDeps = {}
): PlatformConnectConfig {
  const client = deps.client ?? createPostForMeConnectClient();
  const appOrigin = (
    deps.appOrigin ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  return {
    platform: 'youtube',
    // Our own shim: the provider's auth URL is generated per attempt
    // by an authenticated API call, so the framework redirects to us
    // first and the shim sends the browser on to the provider.
    authorizeUrl: `${appOrigin}/api/connect/youtube/authorize`,
    clientIdSource: 'global',
    // The framework requires a client id before it will start a
    // flow; ours is a non-secret marker — the real credential (the
    // provider API key) never leaves the server.
    resolveClientId: async () => YOUTUBE_CONNECT_CLIENT_MARKER,
    scopes: [],
    usePkce: false,
    // Exactly one channel per account, and the user must check it
    // and confirm before it is saved (spec 125).
    destinationMode: 'single-confirm',
    exchangeCode: async (code) => exchangeYouTubeCode(client, code),
    fetchDestinations: async (_accessToken, account) =>
      fetchYouTubeDestinations(client, account),
  };
}

/** Idempotent registration into spec 123's framework registry. */
export function registerYouTubeConnectConfig(
  deps: YouTubeConnectConfigDeps = {}
): void {
  if (!hasPlatformConnectConfig('youtube')) {
    registerPlatformConnectConfig(createYouTubeConnectConfig(deps));
  }
}

// Importing this module registers the YouTube config (the connect
// routes and the destination picker import it for this side effect).
registerYouTubeConnectConfig();
