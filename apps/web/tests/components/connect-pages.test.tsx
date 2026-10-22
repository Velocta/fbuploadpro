/**
 * @file connect-pages.test.tsx
 * @description Spec 123 Part C: the picker landing page (server component,
 * fed by the signed pending cookie) and the dedicated-section destination
 * landing page (client component shell — spec 128 builds its internals).
 */
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { signPendingDestinations } from '@/lib/connect/state';
import { render } from './setup';

const TEST_SECRET = 'test_session_secret_at_least_32_chars_long_value';

const cookieStore: { value: string | null } = { value: null };

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'fbup_connect_pending' && cookieStore.value
        ? { name, value: cookieStore.value }
        : undefined,
  }),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ subdomain: 'acme', destinationId: 'dest-row-1' }),
  useRouter: () => ({ push: () => undefined }),
}));

import ConnectPickerPage from '@/app/tenant/[subdomain]/connect/[platform]/page';
import DestinationSectionPage, {
  DestinationSummary,
  loadDestinationDetail,
} from '@/app/tenant/[subdomain]/destinations/[destinationId]/page';
import {
  SocialAccountsList,
  SocialAccountsListView,
} from '@/components/accounts/social-accounts-list';
import InstagramAccountsPage from '@/app/tenant/[subdomain]/instagram/accounts/page';
import ThreadsAccountsPage from '@/app/tenant/[subdomain]/threads/accounts/page';
import YouTubeAccountsPage from '@/app/tenant/[subdomain]/youtube/accounts/page';
import TikTokAccountsPage from '@/app/tenant/[subdomain]/tiktok/accounts/page';
import XTwitterAccountsPage from '@/app/tenant/[subdomain]/x/accounts/page';

describe('Connect picker page', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SECRET;
    cookieStore.value = null;
  });

  it('renders the picker with the destinations from the pending cookie', async () => {
    cookieStore.value = await signPendingDestinations(
      {
        accountId: 'acct-1',
        workspaceId: 'ws-1',
        tenantSubdomain: 'acme',
        platform: 'instagram',
        destinations: [
          { externalDestinationId: 'dest-1001', name: 'My Brand', handle: 'mybrand' },
          { externalDestinationId: 'dest-2002', name: 'Second', handle: 'second' },
        ],
        exp: Math.floor(Date.now() / 1000) + 900,
      },
      TEST_SECRET
    );

    const element = await ConnectPickerPage({
      params: Promise.resolve({ subdomain: 'acme', platform: 'instagram' }),
      searchParams: Promise.resolve({}),
    });
    const { html, hasText } = render(element);
    expect(html).toContain('data-testid="connect-picker-page"');
    expect(hasText('Choose what to add')).toBe(true);
    expect(hasText('My Brand')).toBe(true);
    expect(hasText('Second')).toBe(true);
    expect(html).toContain('data-testid="destination-picker"');
  });

  it('shows the plain-language denial message when the notice is denied', async () => {
    const element = await ConnectPickerPage({
      params: Promise.resolve({ subdomain: 'acme', platform: 'instagram' }),
      searchParams: Promise.resolve({ notice: 'denied' }),
    });
    const { html, hasText } = render(element);
    expect(hasText('Connection canceled. No changes were made.')).toBe(true);
    expect(hasText('Go to Accounts')).toBe(true);
    expect(html).toContain('/tenant/acme/accounts');
    expect(html).not.toMatch(/oauth|scope|endpoint/i);
  });

  it('shows the expired message when there is no pending cookie', async () => {
    const element = await ConnectPickerPage({
      params: Promise.resolve({ subdomain: 'acme', platform: 'instagram' }),
      searchParams: Promise.resolve({}),
    });
    const { hasText } = render(element);
    expect(
      hasText('This connection link has expired. Please start again from Accounts.')
    ).toBe(true);
  });
});

describe('Destination dedicated-section landing page', () => {
  it('renders the back link and loading state before data arrives', () => {
    const { html, hasText } = render(<DestinationSectionPage />);
    expect(html).toContain('data-testid="destination-section-page"');
    expect(hasText('Back to Accounts')).toBe(true);
    expect(html).toContain('/tenant/acme/accounts');
  });

  it('renders the destination summary with its real data', () => {
    const { html, hasText } = render(
      <DestinationSummary
        destination={{
          id: 'dest-row-1',
          externalDestinationId: 'dest-1001',
          name: 'My Brand',
          handle: 'mybrand',
          avatarUrl: null,
          timezone: 'UTC',
          status: 'active',
          platform: 'instagram',
          account: {
            id: 'acct-1',
            displayName: 'Fixture Creator',
            platform: 'instagram',
            status: 'active',
          },
        }}
      />
    );
    expect(html).toContain('data-testid="destination-name"');
    expect(hasText('My Brand')).toBe(true);
    expect(hasText('Instagram')).toBe(true);
    expect(hasText('Fixture Creator')).toBe(true);
    expect(hasText('@mybrand')).toBe(true);
    expect(hasText('Posting timezone:')).toBe(true);
    expect(hasText('Connected')).toBe(true);
  });
});

describe('loadDestinationDetail', () => {
  function fakeResponse(ok: boolean, body: unknown, status = 200): Response {
    return { ok, status, json: async () => body } as Response;
  }

  it('returns the destination on success', async () => {
    const fetcher = async () =>
      fakeResponse(true, { destination: { id: 'd1', name: 'My Brand' } });
    const result = await loadDestinationDetail(
      'acme',
      'd1',
      fetcher as typeof fetch
    );
    expect(result.destination?.name).toBe('My Brand');
  });

  it('reports not found for a 404 and for an empty payload', async () => {
    const notFound = async () => fakeResponse(false, {}, 404);
    const missing = await loadDestinationDetail(
      'acme',
      'nope',
      notFound as typeof fetch
    );
    expect(missing.error).toContain("couldn't find");

    const empty = async () => fakeResponse(true, {});
    const emptyResult = await loadDestinationDetail(
      'acme',
      'd1',
      empty as typeof fetch
    );
    expect(emptyResult.error).toContain("couldn't find");
  });

  it('reports a plain retry message for other failures', async () => {
    const failing = async () => fakeResponse(false, {}, 500);
    const failed = await loadDestinationDetail(
      'acme',
      'd1',
      failing as typeof fetch
    );
    expect(failed.error).toContain('try again');

    const throwing = async () => {
      throw new Error('offline');
    };
    const thrown = await loadDestinationDetail(
      'acme',
      'd1',
      throwing as unknown as typeof fetch
    );
    expect(thrown.error).toContain('try again');
  });
});

describe('Per-platform accounts pages', () => {
  it('renders the gated Instagram connect action', () => {
    const { html, hasText } = render(<InstagramAccountsPage />);
    expect(hasText('Instagram Accounts')).toBe(true);
    expect(html).toContain('data-testid="instagram-connect-link"');
    expect(html).toContain('/api/connect/instagram?subdomain=acme');
  });

  it('renders the gated Threads connect action', () => {
    const { html, hasText } = render(<ThreadsAccountsPage />);
    expect(hasText('Threads Accounts')).toBe(true);
    expect(html).toContain('data-testid="threads-connect-link"');
    expect(html).toContain('/api/connect/threads?subdomain=acme');
  });

  it('explains the YouTube connect model with no keys to paste', () => {
    const { hasText } = render(<YouTubeAccountsPage />);
    expect(hasText('through our publishing partner')).toBe(true);
    expect(hasText('nothing to set up or paste here')).toBe(true);
  });

  it('explains the TikTok connect model with no keys to paste', () => {
    const { hasText } = render(<TikTokAccountsPage />);
    expect(hasText('through our publishing partner')).toBe(true);
  });

  it('explains the X connect model as a simple sign-in', () => {
    const { hasText } = render(<XTwitterAccountsPage />);
    expect(hasText('Simply sign in with X and approve the connection')).toBe(
      true
    );
    expect(hasText('no keys to create or paste')).toBe(true);
  });

  it('the unified list container renders nothing before data loads', () => {
    const { html } = render(<SocialAccountsList subdomain="acme" />);
    expect(html).toBe('');
  });
});

describe('Unified social accounts list view', () => {
  it('lists accounts across platforms with platform labels and destination links', () => {
    const { html, hasText } = render(
      <SocialAccountsListView
        subdomain="acme"
        accounts={[
          {
            id: 'acct-1',
            platform: 'instagram',
            externalAccountId: 'ext-1',
            displayName: 'Fixture Creator',
            avatarUrl: null,
            status: 'active',
            tokenExpiresAt: null,
            destinations: [
              {
                id: 'dest-row-1',
                externalDestinationId: 'dest-1001',
                name: 'My Brand',
                handle: 'mybrand',
                avatarUrl: null,
                timezone: 'UTC',
                status: 'active',
              },
            ],
          },
          {
            id: 'acct-2',
            platform: 'youtube',
            externalAccountId: 'ext-2',
            displayName: 'Channel Owner',
            avatarUrl: null,
            status: 'expired',
            tokenExpiresAt: null,
            destinations: [],
          },
        ]}
      />
    );
    expect(html).toContain('data-testid="social-accounts-list"');
    expect(hasText('Fixture Creator')).toBe(true);
    expect(hasText('Instagram')).toBe(true);
    expect(hasText('YouTube')).toBe(true);
    expect(hasText('My Brand')).toBe(true);
    expect(hasText('@mybrand')).toBe(true);
    expect(html).toContain('/tenant/acme/destinations/dest-row-1');
    expect(hasText('No destinations added yet.')).toBe(true);
    expect(hasText('Session expired')).toBe(true);
  });
});
