/**
 * @file platform-settings-tabs.test.tsx
 * @description Spec 123 Part B: per-platform Settings tabs, generalised
 * credentials views for Instagram/Threads, explanation-only tabs for
 * YouTube/X/TikTok, shared callback addresses, and the plain-language
 * (no-jargon) lint over the new user-facing copy.
 *
 * The page-level tab cases (7 tabs, default, ?tab= routing incl. the
 * byoc alias) moved to tests/ui/settings-shell.test.tsx in spec 135
 * PR-135-1: the settings page is now an async server component whose
 * tab behaviour lives in the SettingsShell island, which the
 * behavioural suite drives directly.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '../components/setup';
import { InstagramSettingsView } from '@/components/settings/instagram-settings-view';
import { ThreadsSettingsView } from '@/components/settings/threads-settings-view';
import { YouTubeSettingsView } from '@/components/settings/youtube-settings-view';
import { XSettingsView } from '@/components/settings/x-settings-view';
import { TikTokSettingsView } from '@/components/settings/tiktok-settings-view';
import {
  buildPlatformCredentialsUrl,
  fetchPlatformCredentials,
  savePlatformCredentials,
  deletePlatformCredentials,
  validatePlatformCredentialsInput,
} from '@/components/settings/platform-credentials-view';
import {
  getPlatformCallbackUrl,
  getPlatformCallbackUrls,
} from '@/lib/platforms/callback-urls';

// Hoisted mutable search params for the next/navigation mock below.
const searchParamsState = vi.hoisted(() => ({
  current: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ subdomain: 'acme' }),
  useSearchParams: () => searchParamsState.current,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/tenant/acme/settings',
}));

const CONNECTED_IG = {
  appId: '123456789012345',
  appSecret: 'instagram-secret-value',
  hasSecret: true,
  status: 'valid' as const,
  lastTestedAt: '2026-10-16T10:00:00Z',
  connectedAt: '2026-10-16T12:00:00Z',
};

const CONNECTED_THREADS = {
  appId: '109876543210987',
  appSecret: 'threads-secret-value',
  hasSecret: true,
  status: 'valid' as const,
  lastTestedAt: '2026-10-16T10:00:00Z',
  connectedAt: '2026-10-16T12:00:00Z',
};

function stripToVisibleText(html: string): string {
  const withoutTags = html
    .split('<')
    .map((chunk) => {
      const closeIdx = chunk.indexOf('>');
      return closeIdx >= 0 ? chunk.slice(closeIdx + 1) : chunk;
    })
    .join(' ');
  return withoutTags
    .split(/\s+/)
    .filter((word) => !word.startsWith('http://') && !word.startsWith('https://'))
    .join(' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&quot;', '"')
    .toLowerCase();
}

describe('Spec 123 Part B: Instagram credentials view', () => {
  beforeEach(() => {
    searchParamsState.current = new URLSearchParams();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  it('renders the not-connected guided form with the setup guide', () => {
    const { hasText, hasAttribute } = render(
      <InstagramSettingsView subdomain="acme" initialCredentials={null} />
    );

    expect(hasText('Connect Instagram')).toBe(true);
    expect(hasText('Not connected')).toBe(true);
    expect(hasText('Link your Instagram app to start publishing from this workspace.')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-setup-guide')).toBe(true);
    expect(hasText('Create your Meta app')).toBe(true);
    expect(hasText('Add Instagram to your app')).toBe(true);
    expect(hasText('Finish the Instagram sign-in setup')).toBe(true);
    expect(hasText('Add the sign-in address we show')).toBe(true);
    expect(hasText('Add them here')).toBe(true);
    expect(hasText('Instagram App ID')).toBe(true);
    expect(hasText('Instagram App Secret')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-app-id-input')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-app-secret-input')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-connect-btn')).toBe(true);
    expect(hasText('We check everything works the moment you connect.')).toBe(true);
  });

  it('shows the sign-in address from the shared callback module in the setup card', () => {
    const { hasText, hasAttribute } = render(
      <InstagramSettingsView subdomain="acme" initialCredentials={null} />
    );

    expect(hasText('One more step')).toBe(true);
    expect(
      hasText('Add this address to your Meta app so Instagram can bring you back here after you sign in.')
    ).toBe(true);
    expect(hasText('Sign-in address')).toBe(true);
    expect(hasText('/api/connect/instagram/callback')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-setup-address-signin')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-copy-signin-btn')).toBe(true);
  });

  it('renders the connected state with Copy, Show, Edit, Disconnect and the connected date', () => {
    const { hasText, hasAttribute } = render(
      <InstagramSettingsView subdomain="acme" initialCredentials={CONNECTED_IG} />
    );

    expect(hasText('Connected')).toBe(true);
    expect(hasText('Your Instagram app is linked and publishing is ready to go.')).toBe(true);
    expect(hasText('123456789012345')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-copy-app-id-btn')).toBe(true);
    expect(hasText('••••••••••••••••••••••••')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-state2-secret-toggle')).toBe(true);
    expect(hasText('Edit details')).toBe(true);
    expect(hasText('Disconnect')).toBe(true);
    expect(hasText('Connected on Oct 16, 2026.')).toBe(true);
    expect(hasAttribute('data-testid', 'instagram-one-more-step-card')).toBe(false);
    expect(hasAttribute('data-testid', 'instagram-setup-guide')).toBe(false);
  });

  it('renders the disconnect confirmation with the Instagram labels', () => {
    const { hasText, hasAttribute } = render(
      <InstagramSettingsView
        subdomain="acme"
        initialCredentials={CONNECTED_IG}
        initialShowDisconnectModal={true}
      />
    );

    expect(hasAttribute('data-testid', 'instagram-disconnect-modal')).toBe(true);
    expect(hasText('Disconnect Instagram?')).toBe(true);
    expect(hasText('remove your Instagram App ID and Instagram App Secret from this workspace')).toBe(true);
    expect(hasText('Keep connected')).toBe(true);
  });
});

describe('Spec 123 Part B: Threads credentials view', () => {
  beforeEach(() => {
    searchParamsState.current = new URLSearchParams();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  it('renders the not-connected guided form with Threads labels', () => {
    const { hasText, hasAttribute } = render(
      <ThreadsSettingsView subdomain="acme" initialCredentials={null} />
    );

    expect(hasText('Connect Threads')).toBe(true);
    expect(hasText('Threads App ID')).toBe(true);
    expect(hasText('Threads App Secret')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-app-id-input')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-app-secret-input')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-connect-btn')).toBe(true);
  });

  it('guide warns that Threads uses its own pair and names the main-pair mistake', () => {
    const { hasText } = render(<ThreadsSettingsView subdomain="acme" initialCredentials={null} />);

    expect(hasText('Use the Threads pair, not the main pair')).toBe(true);
    expect(hasText('Threads has its own App ID and App Secret')).toBe(true);
    expect(hasText('not under Settings → Basic')).toBe(true);
    expect(hasText('Using the main pair is the most common reason connecting')).toBe(true);
    expect(hasText('Copy your Threads App ID and Threads App Secret')).toBe(true);
  });

  it('shows all three callback addresses from the shared module', () => {
    const { hasText, hasAttribute } = render(
      <ThreadsSettingsView subdomain="acme" initialCredentials={null} />
    );

    expect(hasText('Sign-in callback address')).toBe(true);
    expect(hasText('/api/connect/threads/callback')).toBe(true);
    expect(hasText('Deauthorize callback address')).toBe(true);
    expect(hasText('/api/connect/threads/deauthorize')).toBe(true);
    expect(hasText('Data deletion callback address')).toBe(true);
    expect(hasText('/api/connect/threads/data-deletion')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-setup-address-signin')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-setup-address-deauthorize')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-setup-address-data-deletion')).toBe(true);
  });

  it('renders the connected state with the connected date', () => {
    const { hasText, hasAttribute } = render(
      <ThreadsSettingsView subdomain="acme" initialCredentials={CONNECTED_THREADS} />
    );

    expect(hasText('109876543210987')).toBe(true);
    expect(hasText('Connected on Oct 16, 2026.')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-edit-details-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-disconnect-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-one-more-step-card')).toBe(false);
  });

  it('edit mode re-opens the form pre-filled and shows the setup card again', () => {
    const { hasText, hasAttribute } = render(
      <ThreadsSettingsView
        subdomain="acme"
        initialCredentials={CONNECTED_THREADS}
        initialEditMode={true}
      />
    );

    expect(hasAttribute('value', '109876543210987')).toBe(true);
    expect(hasText('Cancel')).toBe(true);
    expect(hasAttribute('data-testid', 'threads-one-more-step-card')).toBe(true);
  });
});

describe('Spec 123 Part B: frozen credentials contract calls', () => {
  it('builds the per-platform settings address', () => {
    expect(buildPlatformCredentialsUrl('acme', 'instagram')).toBe(
      '/api/tenant/acme/settings/platform-credentials/instagram'
    );
    expect(buildPlatformCredentialsUrl('acme', 'threads')).toBe(
      '/api/tenant/acme/settings/platform-credentials/threads'
    );
  });

  it('GET reads the frozen contract shape', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        appId: '123456789012345',
        appSecret: 'shh',
        hasSecret: true,
        status: 'valid',
        lastTestedAt: '2026-10-16T10:00:00Z',
        connectedAt: '2026-10-16T12:00:00Z',
      }),
    });

    const state = await fetchPlatformCredentials('acme', 'instagram', fetchFn as never);
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/tenant/acme/settings/platform-credentials/instagram'
    );
    expect(state).toEqual({
      appId: '123456789012345',
      appSecret: 'shh',
      hasSecret: true,
      status: 'valid',
      lastTestedAt: '2026-10-16T10:00:00Z',
      connectedAt: '2026-10-16T12:00:00Z',
    });
  });

  it('Connect saves with PUT and the frozen body shape', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hasSecret: true,
        status: 'unverified',
        connectedAt: '2026-10-22T00:00:00.000Z',
      }),
    });

    const result = await savePlatformCredentials(
      'acme',
      'threads',
      { appId: '109876543210987', appSecret: 'threads-secret' },
      fetchFn as never
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/tenant/acme/settings/platform-credentials/threads');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      appId: '109876543210987',
      appSecret: 'threads-secret',
    });
    expect(result).toEqual({
      success: true,
      hasSecret: true,
      status: 'unverified',
      connectedAt: '2026-10-22T00:00:00.000Z',
    });
  });

  it('Connect omits the secret when it is left blank in edit mode', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        hasSecret: true,
        status: 'unverified',
        connectedAt: '2026-10-22T00:00:00.000Z',
      }),
    });

    await savePlatformCredentials('acme', 'instagram', { appId: '123456789012345' }, fetchFn as never);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ appId: '123456789012345' });
  });

  it('Disconnect calls DELETE on the same address', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    const result = await deletePlatformCredentials('acme', 'instagram', fetchFn as never);
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/tenant/acme/settings/platform-credentials/instagram',
      { method: 'DELETE' }
    );
    expect(result).toEqual({ success: true, disconnected: true });
  });

  it('validates the pair the same way the Facebook tab does', () => {
    const labels = {
      isEditMode: false,
      hasExistingSecret: false,
      appIdLabel: 'Instagram App ID',
      appSecretLabel: 'Instagram App Secret',
    };
    expect(validatePlatformCredentialsInput('', '', labels).valid).toBe(false);
    expect(validatePlatformCredentialsInput('abc', 'secret', labels).appIdError).toContain(
      'must be numeric'
    );
    expect(validatePlatformCredentialsInput('123456789012345', '', labels).appSecretError).toContain(
      'Please enter your Instagram App Secret.'
    );
    expect(validatePlatformCredentialsInput('123456789012345', 'secret', labels).valid).toBe(true);
    expect(
      validatePlatformCredentialsInput('123456789012345', '', {
        ...labels,
        isEditMode: true,
        hasExistingSecret: true,
      }).valid
    ).toBe(true);
  });
});

describe('Spec 123 Part B: YouTube, X and TikTok explanation tabs', () => {
  const cases = [
    {
      name: 'YouTube',
      view: YouTubeSettingsView,
      card: 'youtube-connect-info-card',
      link: 'youtube-accounts-link',
      text: 'You connect your YouTube channel through our publishing partner, so there is nothing to set up or paste here.',
    },
    {
      name: 'X',
      view: XSettingsView,
      card: 'x-connect-info-card',
      link: 'x-accounts-link',
      text: 'You simply sign in with X and approve the connection. There are no keys to create or paste here.',
    },
    {
      name: 'TikTok',
      view: TikTokSettingsView,
      card: 'tiktok-connect-info-card',
      link: 'tiktok-accounts-link',
      text: 'You connect your TikTok account through our publishing partner, so there is nothing to set up or paste here.',
    },
  ] as const;

  for (const c of cases) {
    it(`${c.name} tab has no form inputs and links to Accounts`, () => {
      const View = c.view;
      const { html, hasText, hasAttribute, getAttribute } = render(<View subdomain="acme" />);

      expect(html.match(/<input/g) || []).toHaveLength(0);
      expect(html.match(/<textarea/g) || []).toHaveLength(0);
      expect(html.match(/<select/g) || []).toHaveLength(0);
      expect(hasAttribute('data-testid', c.card)).toBe(true);
      expect(hasText(c.text)).toBe(true);
      expect(hasText('Go to Accounts')).toBe(true);
      expect(hasAttribute('data-testid', c.link)).toBe(true);
      expect(getAttribute('href')).toBe('/tenant/acme/accounts');
    });
  }
});

describe('Spec 123 Part B: shared callback addresses', () => {
  it('builds the three addresses on the given origin', () => {
    expect(getPlatformCallbackUrls('threads', 'https://app.example.com')).toEqual({
      signInCallback: 'https://app.example.com/api/connect/threads/callback',
      deauthorizeCallback: 'https://app.example.com/api/connect/threads/deauthorize',
      dataDeletionCallback: 'https://app.example.com/api/connect/threads/data-deletion',
    });
    expect(getPlatformCallbackUrl('instagram', 'signIn', 'https://app.example.com')).toBe(
      'https://app.example.com/api/connect/instagram/callback'
    );
  });

  it('falls back to the production origin outside the browser', () => {
    expect(getPlatformCallbackUrls('threads').signInCallback).toBe(
      'https://fbuploadpro.com/api/connect/threads/callback'
    );
  });
});

describe('Spec 123 Part B: plain-language lint over new user-facing copy', () => {
  beforeEach(() => {
    searchParamsState.current = new URLSearchParams();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );
  });

  const BANNED = ['oauth', 'scope', 'endpoint', 'api key', 'token'];

  it('no banned terms appear in any new tab copy', () => {
    const renders = [
      render(<InstagramSettingsView subdomain="acme" initialCredentials={null} />),
      render(<InstagramSettingsView subdomain="acme" initialCredentials={CONNECTED_IG} />),
      render(<ThreadsSettingsView subdomain="acme" initialCredentials={null} />),
      render(<ThreadsSettingsView subdomain="acme" initialCredentials={CONNECTED_THREADS} />),
      render(<YouTubeSettingsView subdomain="acme" />),
      render(<XSettingsView subdomain="acme" />),
      render(<TikTokSettingsView subdomain="acme" />),
    ];

    for (const { html } of renders) {
      const text = stripToVisibleText(html);
      for (const term of BANNED) {
        expect(text).not.toContain(term);
      }
      expect(text).not.toMatch(/\bapi\b/);
    }
  });
});
