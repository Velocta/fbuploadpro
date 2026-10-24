/**
 * Spec 124: Instagram connect registration on spec 123's framework.
 *
 * Instagram-Login route only (D2): Instagram's own authorize window,
 * code → 1-hour token → 60-day long-lived token, Professional-account
 * detection with a plain-language refusal, and the destination = the
 * IG account itself.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { INSTAGRAM_OAUTH_SCOPES } from '@fbuploadpro/contracts';
import {
  clearPlatformConnectConfigsForTests,
  getPlatformConnectConfig,
  hasPlatformConnectConfig,
} from '@/lib/connect/registry';
import {
  createInstagramConnectConfig,
  isProfessionalInstagramAccountType,
  registerInstagramConnectConfig,
  type InstagramDiscoveredDestination,
} from '@/lib/connect/platforms/instagram';

describe('Instagram connect registration (spec 124)', () => {
  beforeEach(() => {
    clearPlatformConnectConfigsForTests();
  });

  it('registers Instagram as a BYOC platform on the Instagram-Login route', () => {
    registerInstagramConnectConfig();
    expect(hasPlatformConnectConfig('instagram')).toBe(true);
    const config = getPlatformConnectConfig('instagram');
    // Instagram-Login ONLY: Instagram's own authorize window, never Facebook's dialog.
    expect(config?.authorizeUrl).toBe('https://api.instagram.com/oauth/authorize');
    expect(config?.authorizeUrl).not.toContain('facebook.com');
    expect(config?.clientIdSource).toBe('byoc');
    expect(config?.usePkce).toBe(false);
    // Spec 123's framework fixture mode for Instagram.
    expect(config?.destinationMode).toBe('picker');
  });

  it('requests the manage-comments permission (the first comment needs it)', () => {
    registerInstagramConnectConfig();
    const config = getPlatformConnectConfig('instagram');
    expect(config?.scopes).toEqual([...INSTAGRAM_OAUTH_SCOPES]);
    expect(config?.scopes).toContain('instagram_business_manage_comments');
    expect(config?.scopes).toContain('instagram_business_content_publish');
  });

  it('registration is idempotent', () => {
    registerInstagramConnectConfig();
    expect(() => registerInstagramConnectConfig()).not.toThrow();
  });

  it('Professional detection accepts Business/Creator and refuses personal accounts', () => {
    expect(isProfessionalInstagramAccountType('BUSINESS')).toBe(true);
    expect(isProfessionalInstagramAccountType('MEDIA_CREATOR')).toBe(true);
    expect(isProfessionalInstagramAccountType('CREATOR')).toBe(true);
    expect(isProfessionalInstagramAccountType('business')).toBe(true);
    expect(isProfessionalInstagramAccountType('PERSONAL')).toBe(false);
    expect(isProfessionalInstagramAccountType(null)).toBe(false);
    expect(isProfessionalInstagramAccountType(undefined)).toBe(false);
  });
});

describe('Instagram connect exchange (spec 124)', () => {
  const ctx = {
    code: 'ig-auth-code',
    redirectUri: 'https://app.example/api/connect/instagram/callback',
    codeVerifier: null,
    clientId: 'ig-app-id',
    clientSecret: 'ig-app-secret',
    workspaceId: 'ws-1',
    userId: 'user-1',
  };

  function mockFetch(accountType: string) {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === 'https://api.instagram.com/oauth/access_token') {
        return new Response(
          JSON.stringify({ access_token: 'short-lived-token', user_id: 12345 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://graph.instagram.com/access_token')) {
        return new Response(
          JSON.stringify({ access_token: 'long-lived-token', expires_in: 5184000 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://graph.instagram.com/v26.0/me')) {
        return new Response(
          JSON.stringify({
            id: '12345',
            username: 'boss.baby',
            name: 'The Baby Boss',
            account_type: accountType,
            profile_picture_url: 'https://img.example/avatar.jpg',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    return { fetchFn: fetchFn as unknown as typeof fetch, calls };
  }

  it('exchanges code → short-lived → long-lived and binds the IG account as its own destination', async () => {
    const { fetchFn, calls } = mockFetch('BUSINESS');
    const config = createInstagramConnectConfig(fetchFn);
    const account = await config.exchangeCode('ig-auth-code', ctx);

    expect(account.externalAccountId).toBe('12345');
    expect(account.displayName).toBe('The Baby Boss');
    expect(account.accessToken).toBe('long-lived-token');
    expect(account.expiresIn).toBe(5184000);

    // The short-lived exchange carried the workspace's own app pair
    // and the byte-for-byte redirect.
    const tokenCall = calls.find((c) => c.url.includes('api.instagram.com/oauth'));
    const form = new URLSearchParams(String(tokenCall?.init?.body));
    expect(form.get('client_id')).toBe('ig-app-id');
    expect(form.get('client_secret')).toBe('ig-app-secret');
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('redirect_uri')).toBe(ctx.redirectUri);
    expect(form.get('code')).toBe('ig-auth-code');

    // The long-lived exchange used the ig_exchange_token grant.
    const longCall = calls.find((c) => c.url.includes('grant_type=ig_exchange_token'));
    expect(longCall).toBeTruthy();

    const destinations = await config.fetchDestinations(account.accessToken, account);
    expect(destinations).toEqual([
      {
        externalDestinationId: '12345',
        name: 'The Baby Boss',
        handle: 'boss.baby',
        avatarUrl: 'https://img.example/avatar.jpg',
        // The provider-reported type rides the discovered destination
        // so the complete route can persist it (spec 132 G-IG.1(iii)).
        accountType: 'BUSINESS',
      },
    ]);
  });

  it('refuses a personal (non-Professional) account in plain language', async () => {
    const { fetchFn } = mockFetch('PERSONAL');
    const config = createInstagramConnectConfig(fetchFn);
    await expect(config.exchangeCode('ig-auth-code', ctx)).rejects.toThrow(
      /personal account.*Professional account \(Business or Creator\)/i
    );
  });

  it('accepts a Creator account (Creator is Professional; only stories are Business-only)', async () => {
    const { fetchFn } = mockFetch('MEDIA_CREATOR');
    const config = createInstagramConnectConfig(fetchFn);
    const account = await config.exchangeCode('ig-auth-code', ctx);
    expect(account.externalAccountId).toBe('12345');

    // The Creator type is carried verbatim too — persisting it is
    // what keeps Stories unoffered for this destination (never a
    // guess in either direction).
    const destinations = (await config.fetchDestinations(
      account.accessToken,
      account
    )) as InstagramDiscoveredDestination[];
    expect(destinations[0]?.accountType).toBe('MEDIA_CREATOR');
  });
});
