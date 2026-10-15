/**
 * @file platform-placeholder-accounts.test.tsx
 * @description Unit tests for PlatformPlaceholderAccounts component (Spec 047).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../components/setup';
import {
  PlatformPlaceholderAccounts,
} from '@/components/workspace/platform-placeholder-accounts';
import {
  InstagramIcon,
  ThreadsIcon,
  XTwitterIcon,
  TikTokIcon,
  YouTubeIcon,
  TESTING_PLACEHOLDER_TEXT,
} from '@/components/workspace/platform-nav-config';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('PlatformPlaceholderAccounts Component (Spec 047)', () => {
  it('renders platform heading and the exact testing placeholder notice', () => {
    const { hasText, hasAttribute } = render(
      <PlatformPlaceholderAccounts
        platformName="Instagram"
        subdomain="acme"
        icon={<InstagramIcon />}
      />
    );

    expect(hasAttribute('data-testid', 'platform-placeholder-accounts')).toBe(true);
    expect(hasText('Instagram Accounts')).toBe(true);
    expect(hasText(TESTING_PLACEHOLDER_TEXT)).toBe(true);
    expect(hasText('Return to Overview')).toBe(true);
    expect(hasAttribute('data-slot', 'platform-icon-container')).toBe(true);
  });

  it('renders correctly for Threads with ThreadsIcon', () => {
    const { hasText, hasAttribute } = render(
      <PlatformPlaceholderAccounts
        platformName="Threads"
        subdomain="acme"
        icon={<ThreadsIcon />}
      />
    );

    expect(hasText('Threads Accounts')).toBe(true);
    expect(hasText(TESTING_PLACEHOLDER_TEXT)).toBe(true);
    expect(hasAttribute('data-slot', 'platform-icon-container')).toBe(true);
  });

  it('renders correctly for X (Twitter) with XTwitterIcon', () => {
    const { hasText, hasAttribute } = render(
      <PlatformPlaceholderAccounts
        platformName="X (Twitter)"
        subdomain="acme"
        icon={<XTwitterIcon />}
      />
    );

    expect(hasText('X (Twitter) Accounts')).toBe(true);
    expect(hasText(TESTING_PLACEHOLDER_TEXT)).toBe(true);
    expect(hasAttribute('data-slot', 'platform-icon-container')).toBe(true);
  });

  it('renders correctly for TikTok with TikTokIcon', () => {
    const { hasText, hasAttribute } = render(
      <PlatformPlaceholderAccounts
        platformName="TikTok"
        subdomain="acme"
        icon={<TikTokIcon />}
      />
    );

    expect(hasText('TikTok Accounts')).toBe(true);
    expect(hasText(TESTING_PLACEHOLDER_TEXT)).toBe(true);
    expect(hasAttribute('data-slot', 'platform-icon-container')).toBe(true);
  });

  it('renders correctly for YouTube with YouTubeIcon', () => {
    const { hasText, hasAttribute } = render(
      <PlatformPlaceholderAccounts
        platformName="YouTube"
        subdomain="acme"
        icon={<YouTubeIcon />}
      />
    );

    expect(hasText('YouTube Accounts')).toBe(true);
    expect(hasText(TESTING_PLACEHOLDER_TEXT)).toBe(true);
    expect(hasAttribute('data-slot', 'platform-icon-container')).toBe(true);
  });
});
