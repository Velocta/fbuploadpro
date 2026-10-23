/**
 * Platform connect-config registry (Spec 123, Part C — FROZEN for specs 124–127).
 *
 * Server-only module. Platform specs (124 Instagram/Threads, 125 YouTube,
 * 126 TikTok, 127 X) register one PlatformConnectConfig each; the framework
 * owns state, PKCE, callback handling, persistence, the destination picker
 * and the post-connect landing. Platform specs supply only the two platform
 * calls: exchangeCode and fetchDestinations.
 */
import type { Platform } from '@fbuploadpro/contracts';

export type { Platform };

/** Platforms whose workspaces supply their own app credentials (BYOC). */
export const BYOC_PLATFORMS: readonly Platform[] = [
  'facebook',
  'instagram',
  'threads',
];

export function isByocPlatform(platform: Platform): boolean {
  return BYOC_PLATFORMS.includes(platform);
}

export interface ConnectExchangeContext {
  code: string;
  redirectUri: string;
  /** PKCE verifier when the platform config sets usePkce, otherwise null. */
  codeVerifier: string | null;
  clientId: string;
  /** Decrypted workspace app secret for BYOC platforms; null for global apps. */
  clientSecret: string | null;
  workspaceId: string;
  userId: string;
}

export interface ExchangedAccount {
  externalAccountId: string;
  displayName: string;
  avatarUrl?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  /** Seconds until the access token expires, when the platform reports it. */
  expiresIn?: number | null;
  scopes?: string[];
}

export interface DiscoveredDestination {
  externalDestinationId: string;
  name: string;
  handle?: string | null;
  avatarUrl?: string | null;
}

export interface PlatformConnectConfig {
  platform: Platform;
  /** Base authorize URL the user is redirected to. */
  authorizeUrl: string;
  clientIdSource: 'byoc' | 'global';
  scopes: string[];
  usePkce: boolean;
  destinationMode: 'picker' | 'single-confirm';
  exchangeCode: (
    code: string,
    ctx: ConnectExchangeContext
  ) => Promise<ExchangedAccount>;
  fetchDestinations: (
    accessToken: string,
    account: ExchangedAccount
  ) => Promise<DiscoveredDestination[]>;
  /** Env var holding the client ID when clientIdSource is 'global'. Defaults to CONNECT_<PLATFORM>_CLIENT_ID. */
  globalClientIdEnv?: string;
  /** Env var holding the client secret when clientIdSource is 'global'. */
  globalClientSecretEnv?: string;
  /** Optional override for resolving the client ID (takes precedence over the sources above). */
  resolveClientId?: (ctx: { workspaceId: string }) => Promise<string | null>;
  /** Extra query parameters appended to the authorize URL. */
  extraAuthorizeParams?: Record<string, string>;
}

const registry = new Map<Platform, PlatformConnectConfig>();

export function registerPlatformConnectConfig(
  config: PlatformConnectConfig
): void {
  if (registry.has(config.platform)) {
    throw new Error(
      `A connect config is already registered for platform "${config.platform}".`
    );
  }
  registry.set(config.platform, config);
}

export function getPlatformConnectConfig(
  platform: string
): PlatformConnectConfig | null {
  return registry.get(platform as Platform) ?? null;
}

export function hasPlatformConnectConfig(platform: string): boolean {
  return registry.has(platform as Platform);
}

export function listRegisteredPlatforms(): Platform[] {
  return [...registry.keys()];
}

/** Test support only: clears registrations so a test file can start clean. */
export function clearPlatformConnectConfigsForTests(): void {
  registry.clear();
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  threads: 'Threads',
  youtube: 'YouTube',
  x: 'X',
  tiktok: 'TikTok',
};

export function isKnownPlatform(value: string): value is Platform {
  return value in PLATFORM_LABELS;
}
