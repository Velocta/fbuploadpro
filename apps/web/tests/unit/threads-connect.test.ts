/**
 * Spec 124: Threads connect registration on spec 123's framework.
 *
 * BYOC with the Threads App ID/Secret pair (never the main Meta pair),
 * `#_`-stripped code exchange, byte-for-byte redirect, 60-day
 * long-lived token, Threads-scoped ids, and the three hosted callback
 * addresses bound via the shared callback-urls mechanism.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { THREADS_OAUTH_SCOPES } from '@fbuploadpro/contracts';
import {
  clearPlatformConnectConfigsForTests,
  getPlatformConnectConfig,
  hasPlatformConnectConfig,
} from '@/lib/connect/registry';
import {
  createThreadsConnectConfig,
  getThreadsCallbackUrls,
  registerThreadsConnectConfig,
  stripThreadsCodeSuffix,
} from '@/lib/connect/platforms/threads';
import { getPlatformCallbackUrls } from '@/lib/platforms/callback-urls';

describe('Threads connect registration (spec 124)', () => {
  beforeEach(() => {
    clearPlatformConnectConfigsForTests();
  });

  it('registers Threads as a BYOC, single-confirm platform', () => {
    registerThreadsConnectConfig();
    expect(hasPlatformConnectConfig('threads')).toBe(true);
    const config = getPlatformConnectConfig('threads');
    expect(config?.authorizeUrl).toBe('https://threads.com/oauth/authorize');
    expect(config?.clientIdSource).toBe('byoc');
    expect(config?.usePkce).toBe(false);
    expect(config?.destinationMode).toBe('single-confirm');
    expect(config?.scopes).toEqual([...THREADS_OAUTH_SCOPES]);
    expect(config?.scopes).toEqual(['threads_basic', 'threads_content_publish']);
  });

  it('registration is idempotent', () => {
    registerThreadsConnectConfig();
    expect(() => registerThreadsConnectConfig()).not.toThrow();
  });

  it('binds the three hosted callbacks through the shared callback-urls mechanism', () => {
    const urls = getThreadsCallbackUrls('https://app.example');
    expect(urls).toEqual(getPlatformCallbackUrls('threads', 'https://app.example'));
    expect(urls.signInCallback).toBe('https://app.example/api/connect/threads/callback');
    expect(urls.deauthorizeCallback).toBe(
      'https://app.example/api/connect/threads/deauthorize'
    );
    expect(urls.dataDeletionCallback).toBe(
      'https://app.example/api/connect/threads/data-deletion'
    );
  });

  it('strips the trailing #_ from returned codes, and only the suffix', () => {
    expect(stripThreadsCodeSuffix('abc123#_')).toBe('abc123');
    expect(stripThreadsCodeSuffix('abc123')).toBe('abc123');
    expect(stripThreadsCodeSuffix('a#_b#_')).toBe('a#_b');
  });
});

describe('Threads connect exchange (spec 124)', () => {
  const ctx = {
    code: 'threads-code',
    redirectUri: 'https://app.example/api/connect/threads/callback',
    codeVerifier: null,
    clientId: 'threads-app-id',
    clientSecret: 'threads-app-secret',
    workspaceId: 'ws-1',
    userId: 'user-1',
  };

  function mockFetch() {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === 'https://graph.threads.net/oauth/access_token') {
        return new Response(
          JSON.stringify({ access_token: 'short-lived-token', user_id: 777 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://graph.threads.net/access_token')) {
        return new Response(
          JSON.stringify({ access_token: 'long-lived-token', expires_in: 5184000 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://graph.threads.net/v1.0/me')) {
        return new Response(
          JSON.stringify({
            id: '777',
            username: 'daily.grind',
            name: 'The Daily Grind',
            threads_profile_picture_url: 'https://img.example/t.jpg',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    return { fetchFn: fetchFn as unknown as typeof fetch, calls };
  }

  it('exchanges the #-stripped code with the Threads pair and the byte-for-byte redirect', async () => {
    const { fetchFn, calls } = mockFetch();
    const config = createThreadsConnectConfig(fetchFn);
    const account = await config.exchangeCode('threads-code#_', ctx);

    // Threads-scoped id (777), never an FB/IG id.
    expect(account.externalAccountId).toBe('777');
    expect(account.accessToken).toBe('long-lived-token');
    expect(account.expiresIn).toBe(5184000);

    const tokenCall = calls.find((c) => c.url === 'https://graph.threads.net/oauth/access_token');
    const form = new URLSearchParams(String(tokenCall?.init?.body));
    expect(form.get('code')).toBe('threads-code');
    expect(form.get('client_id')).toBe('threads-app-id');
    expect(form.get('client_secret')).toBe('threads-app-secret');
    // Byte-for-byte: exactly the authorize-time redirect, untouched.
    expect(form.get('redirect_uri')).toBe(ctx.redirectUri);
    expect(form.get('grant_type')).toBe('authorization_code');

    const longCall = calls.find((c) => c.url.includes('grant_type=th_exchange_token'));
    expect(longCall).toBeTruthy();

    const destinations = await config.fetchDestinations(account.accessToken, account);
    expect(destinations).toEqual([
      {
        externalDestinationId: '777',
        name: 'The Daily Grind',
        handle: 'daily.grind',
        avatarUrl: 'https://img.example/t.jpg',
      },
    ]);
  });

  it('uses the Threads app pair from the exchange context — there is no path to another platform pair', async () => {
    const { fetchFn, calls } = mockFetch();
    const config = createThreadsConnectConfig(fetchFn);
    await config.exchangeCode('code', {
      ...ctx,
      clientId: 'main-meta-app-id',
      clientSecret: 'main-meta-secret',
    });
    // Whatever pair the framework resolved for platform='threads' is
    // what is sent — the config itself holds no credentials at all.
    const tokenCall = calls.find((c) => c.url === 'https://graph.threads.net/oauth/access_token');
    const form = new URLSearchParams(String(tokenCall?.init?.body));
    expect(form.get('client_id')).toBe('main-meta-app-id');
  });
});
