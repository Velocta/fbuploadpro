/**
 * Spec 127: X connect registration on spec 123's framework.
 *
 * X is a global-app platform (D7): OAuth 2.0 + PKCE against our own
 * app, Basic-auth code exchange at api.x.com/2/oauth2/token, and
 * GET /2/users/me binding the account + its own single destination.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { X_OAUTH_SCOPES } from '@fbuploadpro/contracts';
import {
  clearPlatformConnectConfigsForTests,
  getPlatformConnectConfig,
  hasPlatformConnectConfig,
} from '@/lib/connect/registry';
import {
  createXConnectConfig,
  registerXConnectConfig,
  X_CLIENT_ID_ENV,
  X_CLIENT_SECRET_ENV,
} from '@/lib/connect/platforms/x';

describe('X connect registration (spec 127)', () => {
  beforeEach(() => {
    clearPlatformConnectConfigsForTests();
  });

  it('registers X as a global-app, PKCE, single-confirm platform with the documented scopes', () => {
    registerXConnectConfig();
    expect(hasPlatformConnectConfig('x')).toBe(true);
    const config = getPlatformConnectConfig('x');
    expect(config?.authorizeUrl).toBe('https://x.com/i/oauth2/authorize');
    expect(config?.clientIdSource).toBe('global');
    expect(config?.globalClientIdEnv).toBe(X_CLIENT_ID_ENV);
    expect(config?.globalClientSecretEnv).toBe(X_CLIENT_SECRET_ENV);
    expect(config?.usePkce).toBe(true);
    expect(config?.destinationMode).toBe('single-confirm');
    // The documented scope list — media.write is NOT included: it is
    // absent from X's official examples and stays live-pending until
    // the developer console confirms it (spec 127 Scope.2).
    expect(config?.scopes).toEqual([...X_OAUTH_SCOPES]);
    expect(config?.scopes).toEqual([
      'tweet.read',
      'tweet.write',
      'users.read',
      'offline.access',
    ]);
    expect(config?.scopes).not.toContain('media.write');
  });

  it('registration is idempotent', () => {
    registerXConnectConfig();
    expect(() => registerXConnectConfig()).not.toThrow();
  });
});

describe('X connect exchange (spec 127)', () => {
  function mockFetch() {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === 'https://api.x.com/2/oauth2/token') {
        return new Response(
          JSON.stringify({
            access_token: 'x-access',
            refresh_token: 'x-refresh',
            expires_in: 7200,
            scope: 'tweet.read tweet.write users.read offline.access',
            token_type: 'bearer',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (url.startsWith('https://api.x.com/2/users/me')) {
        return new Response(
          JSON.stringify({
            data: {
              id: 'x-user-42',
              name: 'Test User',
              username: 'testuser',
              profile_image_url: 'https://img.example/avatar.jpg',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Unexpected URL ${url}`);
    });
    return { fetchFn: fetchFn as unknown as typeof fetch, calls };
  }

  const ctx = {
    code: 'auth-code-1',
    redirectUri: 'https://app.example/api/connect/x/callback',
    codeVerifier: 'pkce-verifier-1',
    clientId: 'global-client-id',
    clientSecret: 'global-client-secret',
    workspaceId: 'ws-1',
    userId: 'user-1',
  };

  it('exchanges the code with Basic auth + PKCE verifier, then binds the account via GET /2/users/me', async () => {
    const { fetchFn, calls } = mockFetch();
    const config = createXConnectConfig(fetchFn);
    const account = await config.exchangeCode('auth-code-1', ctx);

    // Token exchange: Basic auth with the global app credentials,
    // form-encoded grant carrying the PKCE verifier (never persisted).
    const tokenCall = calls.find((c) => c.url.endsWith('/oauth2/token'));
    const headers = new Headers(tokenCall?.init?.headers as Record<string, string>);
    expect(headers.get('authorization')).toBe(
      `Basic ${btoa('global-client-id:global-client-secret')}`
    );
    const form = new URLSearchParams(String(tokenCall?.init?.body));
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('auth-code-1');
    expect(form.get('code_verifier')).toBe('pkce-verifier-1');
    expect(form.get('redirect_uri')).toBe(ctx.redirectUri);

    // Account bound by the platform's own id from /users/me.
    expect(account.externalAccountId).toBe('x-user-42');
    expect(account.displayName).toBe('Test User');
    expect(account.accessToken).toBe('x-access');
    expect(account.refreshToken).toBe('x-refresh');
    expect(account.expiresIn).toBe(7200);
    const meCall = calls.find((c) => c.url.includes('/users/me'));
    expect(
      new Headers(meCall?.init?.headers as Record<string, string>).get('authorization')
    ).toBe('Bearer x-access');
  });

  it('the X user is its own single destination (id + handle from /users/me)', async () => {
    const { fetchFn } = mockFetch();
    const config = createXConnectConfig(fetchFn);
    const account = await config.exchangeCode('auth-code-1', ctx);
    const destinations = await config.fetchDestinations(account.accessToken, account);
    expect(destinations).toEqual([
      {
        externalDestinationId: 'x-user-42',
        name: 'Test User',
        handle: 'testuser',
        avatarUrl: 'https://img.example/avatar.jpg',
      },
    ]);
  });

  it('a failed exchange throws (the framework surfaces it as a plain-language notice)', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ detail: 'Invalid code' }), { status: 400 })
    ) as unknown as typeof fetch;
    const config = createXConnectConfig(fetchFn);
    await expect(config.exchangeCode('bad-code', ctx)).rejects.toThrow();
  });
});
