/**
 * TikTok connect registration (Spec 126, D1 — via Post for Me).
 *
 * TikTok is provider-managed: our publishing partner (Post for Me)
 * holds the audited TikTok app and the creator tokens. There is NO
 * TikTok OAuth here, no TikTok developer app of ours, no workspace
 * credential form, and no `platform_credentials` row for TikTok —
 * ever.
 *
 * How the provider's link flow maps onto spec 123's framework:
 *  - Initiation: the framework redirects the browser to this config's
 *    `authorizeUrl`, which is OUR OWN shim
 *    (`/api/connect/tiktok/authorize`). The shim asks the provider
 *    (server-side, with our API key) for a fresh auth URL and sends
 *    the browser on to the provider-hosted flow.
 *  - Return: the provider redirects back to the shim's return route
 *    (`/api/connect/tiktok/return`) with `isSuccess` / `accountIds`
 *    / `error` — not an OAuth code. The return route translates a
 *    success into the framework callback, carrying the provider
 *    account id(s) as the `code`.
 *  - `exchangeCode` treats that code as the provider account id and
 *    READS THE ACCOUNT BACK from the provider: the creator identity
 *    persisted (and later shown for confirmation) always comes from
 *    the provider's read-back, never from redirect parameters.
 *  - `fetchDestinations` reads the account back again and returns
 *    its single TikTok account as a `single-confirm` destination —
 *    the user must check the creator identity and confirm before
 *    anything is saved (spec 126 read-back-and-confirm). An account
 *    with no creator id yields no destinations, and the framework
 *    answers with the plain-language `nothing_found` notice.
 *  - The provider account ref travels on the discovered destination
 *    and is written into `social_accounts.metadata` and
 *    `destinations.metadata` by the TikTok complete route
 *    (`/api/connect/tiktok/complete`) — the worker's TikTok
 *    publisher reads it from the destination metadata.
 *
 * The API key is read from the web app's server env
 * (POST_FOR_ME_API_KEY, shared with spec 125) at call time. It is
 * never sent to the browser, never stored in the database, and the
 * `client_id` the framework appends to our own authorize URL is the
 * non-secret marker `post-for-me` (see `resolveClientId`).
 *
 * ASSUMPTIONS (live-verification-pending — the provider account and
 * the Gate A/Gate B evidence are Shahzeb-side; see the spec 126 PR
 * record):
 *  - The provider's post-connect redirect appends `accountIds` as a
 *    comma-separated list; v1 connects the first account returned.
 *  - The provider account object carries the TikTok creator id as
 *    `platform_account_id` / `external_id`, the creator name as
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

/** Non-secret marker used as the framework `client_id` for TikTok. */
export const TIKTOK_CONNECT_CLIENT_MARKER = 'post-for-me';

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

/** The provider calls the TikTok connect flow depends on — mockable in tests. */
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
      'POST_FOR_ME_API_KEY is not configured; TikTok connect is unavailable.'
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
 * `apps/worker/src/providers/post-for-me-tiktok.ts`.
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
          '/social-accounts?platform=tiktok'
        );
        const accounts = Array.isArray(list)
          ? (list as PostForMeSocialAccount[])
          : ((list as { data?: PostForMeSocialAccount[] }).data ?? []);
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

/** The TikTok creator id behind a provider account, when it has one. */
export function creatorIdFromProviderAccount(
  account: PostForMeSocialAccount
): string | null {
  return stringField(account, [
    'platform_account_id',
    'external_id',
    'external_account_id',
  ]);
}

export interface TikTokExchangedAccount extends ExchangedAccount {
  /** The provider's social account id (`sa_…`) — our publishing ref. */
  providerAccountId: string;
  /** The TikTok creator id, or null when the account has none. */
  creatorId: string | null;
}

export interface TikTokDiscoveredDestination extends DiscoveredDestination {
  /** Carried through the pending cookie so the complete route can persist it. */
  providerAccountId: string;
}

/**
 * The framework's `code` for TikTok is the provider account id from
 * the provider's return redirect. This step reads the account back
 * from the provider — the persisted identity is always the
 * read-back, never the redirect parameters.
 */
export async function exchangeTikTokCode(
  client: PostForMeConnectClient,
  code: string
): Promise<TikTokExchangedAccount> {
  const providerAccountId = code.split(',')[0]?.trim() ?? '';
  if (!providerAccountId) {
    throw new Error('The provider did not return an account to connect.');
  }
  const account = await client.getSocialAccount(providerAccountId);
  if (!account) {
    throw new Error('The connected account could not be read back.');
  }
  const creatorId = creatorIdFromProviderAccount(account);
  return {
    // With a creator, the account's external identity is the creator;
    // without one, fall back to the provider ref so the account row
    // still persists and the no-creator path can explain itself.
    externalAccountId: creatorId ?? providerAccountId,
    displayName:
      stringField(account, ['display_name', 'username']) ??
      'TikTok account',
    avatarUrl: stringField(account, ['profile_image_url', 'avatar_url']),
    // Provider-managed: there is no token of ours to store.
    accessToken: '',
    refreshToken: null,
    expiresIn: null,
    scopes: [],
    providerAccountId,
    creatorId,
  };
}

/**
 * Discovers the account's TikTok creator for the read-back-and-confirm
 * step. Reads the provider account back fresh; an account with no
 * creator returns no destinations (the framework then shows the
 * plain-language `nothing_found` explanation).
 */
export async function fetchTikTokDestinations(
  client: PostForMeConnectClient,
  account: ExchangedAccount
): Promise<TikTokDiscoveredDestination[]> {
  const exchanged = account as TikTokExchangedAccount;
  if (!exchanged.providerAccountId) return [];
  const fresh = await client.getSocialAccount(exchanged.providerAccountId);
  if (!fresh) return [];
  const creatorId = creatorIdFromProviderAccount(fresh);
  if (!creatorId) return [];
  return [
    {
      externalDestinationId: creatorId,
      name:
        stringField(fresh, ['display_name', 'username']) ??
        'TikTok account',
      handle: stringField(fresh, ['username']),
      avatarUrl: stringField(fresh, ['profile_image_url', 'avatar_url']),
      providerAccountId: exchanged.providerAccountId,
    },
  ];
}

export interface TikTokConnectConfigDeps {
  client?: PostForMeConnectClient;
  /** Absolute origin of this web app, for our own authorize shim URL. */
  appOrigin?: string;
}

export function createTikTokConnectConfig(
  deps: TikTokConnectConfigDeps = {}
): PlatformConnectConfig {
  const client = deps.client ?? createPostForMeConnectClient();
  const appOrigin = (
    deps.appOrigin ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  return {
    platform: 'tiktok',
    // Our own shim: the provider's auth URL is generated per attempt
    // by an authenticated API call, so the framework redirects to us
    // first and the shim sends the browser on to the provider.
    authorizeUrl: `${appOrigin}/api/connect/tiktok/authorize`,
    clientIdSource: 'global',
    // The framework requires a client id before it will start a
    // flow; ours is a non-secret marker — the real credential (the
    // provider API key) never leaves the server.
    resolveClientId: async () => TIKTOK_CONNECT_CLIENT_MARKER,
    scopes: [],
    usePkce: false,
    // Exactly one TikTok account per provider account, and the user
    // must check it and confirm before it is saved (spec 126).
    destinationMode: 'single-confirm',
    exchangeCode: async (code) => exchangeTikTokCode(client, code),
    fetchDestinations: async (_accessToken, account) =>
      fetchTikTokDestinations(client, account),
  };
}

/** Idempotent registration into spec 123's framework registry. */
export function registerTikTokConnectConfig(
  deps: TikTokConnectConfigDeps = {}
): void {
  if (!hasPlatformConnectConfig('tiktok')) {
    registerPlatformConnectConfig(createTikTokConnectConfig(deps));
  }
}

// Importing this module registers the TikTok config (the connect
// routes and the destination picker import it for this side effect).
registerTikTokConnectConfig();
