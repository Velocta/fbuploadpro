import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import {
  decryptToken,
  encryptToken,
  signSessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import {
  clearPlatformConnectConfigsForTests,
  registerPlatformConnectConfig,
  type DiscoveredDestination,
  type ExchangedAccount,
} from '@/lib/connect/registry';
import { verifyConnectState } from '@/lib/connect/state';
import { CONNECT_NOTICE_MESSAGES } from '@/lib/connect/errors';
import { handleConnectInitiate } from '@/app/api/connect/[platform]/route';
import { handleConnectCallback } from '@/app/api/connect/[platform]/callback/route';
import { handleConnectComplete } from '@/app/api/connect/[platform]/complete/route';
import { handleConnectDeauthorize } from '@/app/api/connect/[platform]/deauthorize/route';
import { handleConnectDataDeletion } from '@/app/api/connect/[platform]/data-deletion/route';
import { handleListSocialAccounts } from '@/app/api/tenant/[subdomain]/accounts/social/route';
import { handleGetSocialDestination } from '@/app/api/tenant/[subdomain]/accounts/social/[destinationId]/route';

const TEST_SECRET = 'test_session_secret_at_least_32_chars_long_value';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const userId = '11111111-1111-4111-a111-111111111111';
const workspaceId = '22222222-2222-4222-a222-222222222222';
const subdomain = 'acme';

const FIXTURE_ACCOUNT: ExchangedAccount = {
  externalAccountId: 'ext-acct-1',
  displayName: 'Fixture Creator',
  avatarUrl: null,
  accessToken: 'fixture_access_token_plain',
  refreshToken: 'fixture_refresh_token_plain',
  expiresIn: 3600,
  scopes: ['basic', 'publish'],
};

const FIXTURE_DESTINATIONS: DiscoveredDestination[] = [
  { externalDestinationId: 'dest-1001', name: 'My Brand', handle: 'mybrand.one' },
  { externalDestinationId: 'dest-2002', name: 'My Brand', handle: 'mybrand.two' },
  { externalDestinationId: 'dest-3003', name: 'Side Project', handle: 'sideproject' },
];

interface SocialAccountStoreRow {
  id: string;
  workspace_id: string;
  platform: string;
  external_account_id: string;
  display_name: string;
  avatar_url: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface DestinationStoreRow {
  id: string;
  workspace_id: string;
  account_id: string;
  platform: string;
  external_destination_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  timezone: string;
  status: string;
  created_at: string;
}

class FakeDb {
  accounts = new Map<string, SocialAccountStoreRow>();
  destinations = new Map<string, DestinationStoreRow>();
  credentials = new Map<string, { client_id: string; encrypted_client_secret: string }>();
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM workspaces')) {
      return [{ id: workspaceId }];
    }
    if (sql.includes('FROM platform_credentials')) {
      const row = this.credentials.get(String(params[1]));
      return row ? [row] : [];
    }
    if (sql.includes('INSERT INTO social_accounts')) {
      const [
        wsId, platform, externalAccountId, displayName, avatarUrl,
        encAccess, encRefresh, expiresAt, scopes,
      ] = params as [string, string, string, string, string | null, string, string | null, string | null, string[]];
      const key = `${wsId}|${platform}|${externalAccountId}`;
      const existing = this.accounts.get(key);
      if (existing) {
        existing.display_name = displayName;
        existing.avatar_url = avatarUrl;
        existing.encrypted_access_token = encAccess;
        existing.encrypted_refresh_token = encRefresh ?? existing.encrypted_refresh_token;
        existing.token_expires_at = expiresAt;
        existing.scopes = scopes;
        existing.status = 'active';
        return [{ id: existing.id }];
      }
      const row: SocialAccountStoreRow = {
        id: this.nextId('acct'),
        workspace_id: wsId,
        platform,
        external_account_id: externalAccountId,
        display_name: displayName,
        avatar_url: avatarUrl,
        encrypted_access_token: encAccess,
        encrypted_refresh_token: encRefresh,
        token_expires_at: expiresAt,
        scopes,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.accounts.set(key, row);
      return [{ id: row.id }];
    }
    if (sql.includes('INSERT INTO destinations')) {
      const [wsId, accountId, platform, externalDestinationId, name, handle, avatarUrl] =
        params as [string, string, string, string, string, string | null, string | null];
      const key = `${accountId}|${externalDestinationId}`;
      if (this.destinations.has(key)) return [];
      const row: DestinationStoreRow = {
        id: this.nextId('dest-row'),
        workspace_id: wsId,
        account_id: accountId,
        platform,
        external_destination_id: externalDestinationId,
        name,
        handle,
        avatar_url: avatarUrl,
        timezone: 'UTC',
        status: 'active',
        created_at: new Date().toISOString(),
      };
      this.destinations.set(key, row);
      return [{ id: row.id }];
    }
    if (sql.includes('UPDATE social_accounts')) {
      const [platform, externalAccountId] = params as [string, string];
      const updated: Array<{ id: string }> = [];
      for (const row of this.accounts.values()) {
        if (row.platform === platform && row.external_account_id === externalAccountId) {
          row.status = 'revoked';
          updated.push({ id: row.id });
        }
      }
      return updated;
    }
    if (sql.includes('JOIN social_accounts')) {
      const [destinationId, wsId] = params as [string, string];
      for (const row of this.destinations.values()) {
        if (row.id === destinationId && row.workspace_id === wsId) {
          const account = [...this.accounts.values()].find((a) => a.id === row.account_id);
          return [{
            ...row,
            account_display_name: account?.display_name ?? '',
            account_status: account?.status ?? 'active',
          }];
        }
      }
      return [];
    }
    if (sql.includes('FROM destinations')) {
      return [...this.destinations.values()].filter((r) => r.workspace_id === params[0]);
    }
    if (sql.includes('FROM social_accounts')) {
      return [...this.accounts.values()].filter((r) => r.workspace_id === params[0]);
    }
    return [];
  });
}

describe('Connect framework (Spec 123 Part C) with a fixture platform', () => {
  let db: FakeDb;
  let dbClient: DatabaseClient;
  let sessionCookie: string;

  beforeAll(async () => {
    clearPlatformConnectConfigsForTests();
    registerPlatformConnectConfig({
      platform: 'instagram',
      authorizeUrl: 'https://fixture.example/authorize',
      clientIdSource: 'byoc',
      scopes: ['basic', 'publish'],
      usePkce: false,
      destinationMode: 'picker',
      exchangeCode: async () => FIXTURE_ACCOUNT,
      fetchDestinations: async () => FIXTURE_DESTINATIONS,
    });
    registerPlatformConnectConfig({
      platform: 'x',
      authorizeUrl: 'https://fixture-x.example/authorize',
      clientIdSource: 'global',
      scopes: ['tweet.read', 'tweet.write'],
      usePkce: true,
      destinationMode: 'single-confirm',
      exchangeCode: async () => ({
        ...FIXTURE_ACCOUNT,
        externalAccountId: 'ext-x-1',
      }),
      fetchDestinations: async () => [
        { externalDestinationId: 'x-dest-1', name: 'Fixture X', handle: 'fixturex' },
      ],
    });
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    process.env.CONNECT_X_CLIENT_ID = 'x_global_client_id';

    db = new FakeDb();
    dbClient = db as unknown as DatabaseClient;
    db.credentials.set('instagram', {
      client_id: 'fixture_ig_app_id',
      encrypted_client_secret: await encryptToken('fixture_ig_secret', TEST_ENCRYPTION_KEY),
    });

    const token = await signSessionToken(
      {
        userId,
        email: 'alexander@gmail.com',
        name: 'Alex Acme',
        subdomain,
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    sessionCookie = `fbup_session=${token}`;
  });

  async function initiateInstagram(): Promise<{ res: Response; state: string }> {
    const req = new NextRequest(
      `http://localhost:3000/api/connect/instagram?subdomain=${subdomain}`,
      { headers: { cookie: sessionCookie } }
    );
    const res = await handleConnectInitiate(req, 'instagram', dbClient);
    const location = res.headers.get('location') ?? '';
    const state = new URL(location).searchParams.get('state') ?? '';
    return { res, state };
  }

  async function runCallback(state: string): Promise<Response> {
    const req = new NextRequest(
      `http://localhost:3000/api/connect/instagram/callback?code=fixture_code&state=${encodeURIComponent(state)}`
    );
    return handleConnectCallback(req, 'instagram', dbClient);
  }

  function cookieValue(res: Response, name: string): string | null {
    const setCookies = res.headers.getSetCookie();
    for (const entry of setCookies) {
      if (entry.startsWith(`${name}=`)) {
        const value = entry.slice(name.length + 1).split(';')[0];
        return value ? decodeURIComponent(value) : null;
      }
    }
    return null;
  }

  it('initiate builds the authorize URL with signed state and the workspace app ID', async () => {
    const { res, state } = await initiateInstagram();
    expect(res.status).toBe(307);
    const url = new URL(res.headers.get('location') ?? '');
    expect(url.origin).toBe('https://fixture.example');
    expect(url.searchParams.get('client_id')).toBe('fixture_ig_app_id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/connect/instagram/callback'
    );
    expect(url.searchParams.get('scope')).toBe('basic publish');
    expect(state).toBeTruthy();
    const payload = await verifyConnectState(state, TEST_SECRET);
    expect(payload.workspaceId).toBe(workspaceId);
    expect(payload.platform).toBe('instagram');
    expect(payload.userId).toBe(userId);
    expect(payload.tenantSubdomain).toBe(subdomain);
  });

  it('initiate with PKCE adds a code challenge and sets the verifier cookie', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/connect/x?subdomain=${subdomain}`,
      { headers: { cookie: sessionCookie } }
    );
    const res = await handleConnectInitiate(req, 'x', dbClient);
    expect(res.status).toBe(307);
    const url = new URL(res.headers.get('location') ?? '');
    expect(url.searchParams.get('client_id')).toBe('x_global_client_id');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(cookieValue(res, 'fbup_connect_pkce')).toBeTruthy();
  });

  it('initiate redirects to login without a session', async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/connect/instagram?subdomain=${subdomain}`
    );
    const res = await handleConnectInitiate(req, 'instagram', dbClient);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('callback persists the account with encrypted tokens and redirects to the picker', async () => {
    const { state } = await initiateInstagram();
    const res = await runCallback(state);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain(`/tenant/${subdomain}/connect/instagram`);
    expect(cookieValue(res, 'fbup_connect_pending')).toBeTruthy();

    expect(db.accounts.size).toBe(1);
    const row = [...db.accounts.values()][0];
    expect(row.external_account_id).toBe('ext-acct-1');
    expect(row.encrypted_access_token).not.toBe('fixture_access_token_plain');
    expect(row.encrypted_access_token).not.toContain('fixture_access_token_plain');
    expect(await decryptToken(row.encrypted_access_token, TEST_ENCRYPTION_KEY)).toBe(
      'fixture_access_token_plain'
    );
    expect(row.token_expires_at).toBeTruthy();
    expect(row.scopes).toEqual(['basic', 'publish']);
    expect(row.status).toBe('active');
  });

  it('complete persists only the picked destinations and returns the Accounts landing URL', async () => {
    const { state } = await initiateInstagram();
    const callbackRes = await runCallback(state);
    const pending = cookieValue(callbackRes, 'fbup_connect_pending');
    expect(pending).toBeTruthy();

    const req = new NextRequest('http://localhost:3000/api/connect/instagram/complete', {
      method: 'POST',
      headers: {
        cookie: `${sessionCookie}; fbup_connect_pending=${encodeURIComponent(pending ?? '')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ destinationIds: ['dest-1001', 'dest-3003', 'not-a-real-id'] }),
    });
    const res = await handleConnectComplete(req, 'instagram', dbClient);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { accountsUrl: string; addedCount: number };
    expect(data.accountsUrl).toBe(`/tenant/${subdomain}/accounts`);
    expect(data.addedCount).toBe(2);
    const storedIds = [...db.destinations.values()].map((d) => d.external_destination_id);
    expect(storedIds.sort()).toEqual(['dest-1001', 'dest-3003']);
  });

  it('reconnect re-binds the same social_accounts row instead of duplicating it', async () => {
    const first = await initiateInstagram();
    await runCallback(first.state);
    expect(db.accounts.size).toBe(1);
    const firstId = [...db.accounts.values()][0].id;

    const second = await initiateInstagram();
    await runCallback(second.state);
    expect(db.accounts.size).toBe(1);
    expect([...db.accounts.values()][0].id).toBe(firstId);
  });

  it('callback denial lands on a plain-language notice with no jargon', async () => {
    const { state } = await initiateInstagram();
    const req = new NextRequest(
      `http://localhost:3000/api/connect/instagram/callback?error=access_denied&state=${encodeURIComponent(state)}`
    );
    const res = await handleConnectCallback(req, 'instagram', dbClient);
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain(`/tenant/${subdomain}/connect/instagram`);
    expect(location).toContain('notice=denied');
    expect(db.accounts.size).toBe(0);

    const message = CONNECT_NOTICE_MESSAGES.denied;
    expect(message).toBe('Connection canceled. No changes were made.');
    for (const notice of Object.values(CONNECT_NOTICE_MESSAGES)) {
      expect(notice).not.toMatch(/oauth|scope|endpoint|token/i);
    }
  });

  it('deauthorize marks the matching account revoked', async () => {
    const { state } = await initiateInstagram();
    await runCallback(state);
    expect([...db.accounts.values()][0].status).toBe('active');

    const req = new NextRequest('http://localhost:3000/api/connect/instagram/deauthorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'ext-acct-1' }),
    });
    const res = await handleConnectDeauthorize(req, 'instagram', dbClient);
    expect(res.status).toBe(200);
    expect([...db.accounts.values()][0].status).toBe('revoked');
  });

  it('data-deletion answers with a confirmation code and revokes the account', async () => {
    const { state } = await initiateInstagram();
    await runCallback(state);

    const req = new NextRequest('http://localhost:3000/api/connect/instagram/data-deletion', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'ext-acct-1' }),
    });
    const res = await handleConnectDataDeletion(req, 'instagram', dbClient);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { url: string; confirmation_code: string };
    expect(data.confirmation_code).toBeTruthy();
    expect(data.url).toContain('/accounts');
    expect([...db.accounts.values()][0].status).toBe('revoked');
  });

  it('social accounts API returns accounts across platforms, each with destinations', async () => {
    const { state } = await initiateInstagram();
    const callbackRes = await runCallback(state);
    const pending = cookieValue(callbackRes, 'fbup_connect_pending');
    const completeReq = new NextRequest('http://localhost:3000/api/connect/instagram/complete', {
      method: 'POST',
      headers: {
        cookie: `${sessionCookie}; fbup_connect_pending=${encodeURIComponent(pending ?? '')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ destinationIds: ['dest-1001'] }),
    });
    await handleConnectComplete(completeReq, 'instagram', dbClient);

    // A second platform's account + destination, as spec 125 would persist them.
    db.accounts.set(`${workspaceId}|youtube|yt-acct-9`, {
      id: 'acct-yt',
      workspace_id: workspaceId,
      platform: 'youtube',
      external_account_id: 'yt-acct-9',
      display_name: 'Fixture Channel Owner',
      avatar_url: null,
      encrypted_access_token: 'stored-ciphertext',
      encrypted_refresh_token: null,
      token_expires_at: null,
      scopes: [],
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    db.destinations.set('acct-yt|yt-dest-1', {
      id: 'dest-row-yt',
      workspace_id: workspaceId,
      account_id: 'acct-yt',
      platform: 'youtube',
      external_destination_id: 'yt-dest-1',
      name: 'Fixture Channel',
      handle: 'fixturechannel',
      avatar_url: null,
      timezone: 'UTC',
      status: 'active',
      created_at: new Date().toISOString(),
    });

    const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/accounts/social`, {
      headers: { cookie: sessionCookie },
    });
    const res = await handleListSocialAccounts(req, subdomain, dbClient);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      accounts: Array<{
        platform: string;
        displayName: string;
        destinations: Array<{ name: string; id: string }>;
      }>;
    };
    expect(data.accounts).toHaveLength(2);
    const platforms = data.accounts.map((a) => a.platform).sort();
    expect(platforms).toEqual(['instagram', 'youtube']);
    const instagram = data.accounts.find((a) => a.platform === 'instagram');
    expect(instagram?.destinations).toHaveLength(1);
    expect(instagram?.destinations[0].name).toBe('My Brand');

    // Destination detail for the dedicated-section landing.
    const detailReq = new NextRequest(
      `http://localhost:3000/api/tenant/${subdomain}/accounts/social/${instagram?.destinations[0].id}`,
      { headers: { cookie: sessionCookie } }
    );
    const detailRes = await handleGetSocialDestination(
      detailReq,
      subdomain,
      instagram?.destinations[0].id ?? '',
      dbClient
    );
    expect(detailRes.status).toBe(200);
    const detail = (await detailRes.json()) as {
      destination: { name: string; platform: string; account: { displayName: string } };
    };
    expect(detail.destination.name).toBe('My Brand');
    expect(detail.destination.platform).toBe('instagram');
    expect(detail.destination.account.displayName).toBe('Fixture Creator');
  });

  it('social accounts API rejects requests without a session', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/accounts/social`);
    const res = await handleListSocialAccounts(req, subdomain, dbClient);
    expect(res.status).toBe(401);
  });

  it('contains no platform_credentials writes anywhere in the new connect code', () => {
    const roots = [
      path.resolve(__dirname, '../../src/lib/connect'),
      path.resolve(__dirname, '../../src/app/api/connect'),
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(full);
      }
    };
    roots.forEach(walk);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, file).not.toMatch(/(INSERT INTO|UPDATE)\s+platform_credentials/i);
      expect(content, file).not.toMatch(
        /platform_credentials[\s\S]{0,300}?\.(insert|update|upsert)\s*\(/
      );
    }
  });
});
