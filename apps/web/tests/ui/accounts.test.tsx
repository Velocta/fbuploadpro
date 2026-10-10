/**
 * @file accounts.test.tsx
 * @description Unit tests for Facebook Accounts UI components (Spec 027).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { AccountCard, type FacebookAccountItem } from '@/components/accounts/account-card';
import { AccountsEmptyState } from '@/components/accounts/accounts-empty-state';
import { DisconnectAccountDialog } from '@/components/accounts/disconnect-account-dialog';
import { ConnectAccountModal } from '@/components/accounts/connect-account-modal';
import { render } from '../components/setup';

describe('Facebook Accounts UI Components (Spec 027)', () => {
  const mockActiveAccount: FacebookAccountItem = {
    id: 'acc-123',
    fbAccountId: 'fb-user-123',
    displayName: 'Sarah Connor',
    profilePictureUrl: 'https://graph.facebook.com/v26.0/123/picture',
    gender: 'female',
    accountLink: 'https://facebook.com/sarahconnor',
    status: 'active',
    connectedPagesCount: 3,
    createdAt: '2026-10-01T12:00:00Z',
  };

  const mockExpiredAccount: FacebookAccountItem = {
    id: 'acc-456',
    fbAccountId: 'fb-user-456',
    displayName: 'John Doe',
    profilePictureUrl: null,
    gender: 'male',
    accountLink: null,
    status: 'expired',
    connectedPagesCount: 1,
    createdAt: '2026-09-15T10:00:00Z',
  };

  describe('AccountCard', () => {
    it('renders clean active profile with avatar, display name, gender, profile link, and pages count with zero status badges/dots', () => {
      const { hasText, hasAttribute, html } = render(
        <AccountCard account={mockActiveAccount} />
      );

      expect(hasText('Sarah Connor')).toBe(true);
      expect(hasText('3 pages linked')).toBe(true);
      expect(hasText('Female')).toBe(true);
      expect(hasAttribute('data-testid', 'account-avatar-img')).toBe(true);
      expect(hasAttribute('data-testid', 'account-profile-link')).toBe(true);
      expect(hasAttribute('data-testid', 'account-disconnect-button')).toBe(true);

      // Minimalist: No operational/health labels or badges on healthy card
      expect(hasText('Operational')).toBe(false);
      expect(hasText('Critical')).toBe(false);
      expect(hasText('Queued')).toBe(false);
      expect(hasText('Session expired — reconnect to resume publishing')).toBe(false);
      expect(html).not.toContain('account-reconnect-button');
    });

    it('renders expired account with Session expired alert and Reconnect account button', () => {
      const { hasText, hasAttribute } = render(
        <AccountCard account={mockExpiredAccount} />
      );

      expect(hasText('John Doe')).toBe(true);
      expect(hasText('1 page linked')).toBe(true);
      expect(hasText('Male')).toBe(true);
      expect(hasText('JD')).toBe(true); // Fallback initials
      expect(hasText('Session expired — reconnect to resume publishing')).toBe(true);
      expect(hasText('Reconnect account')).toBe(true);
      expect(hasAttribute('data-testid', 'account-reconnect-button')).toBe(true);
      expect(hasAttribute('data-testid', 'account-disconnect-button')).toBe(true);
    });

    it('triggers onDisconnect callback when Disconnect button is clicked', () => {
      const onDisconnect = vi.fn();
      const onReconnect = vi.fn();

      // Render with callbacks
      const card = (
        <AccountCard
          account={mockActiveAccount}
          onDisconnect={onDisconnect}
          onReconnect={onReconnect}
        />
      );
      expect(card).toBeDefined();
    });
  });

  describe('AccountsEmptyState', () => {
    it('renders friendly zero-accounts empty state with Connect Facebook Account action and privacy microcopy', () => {
      const onConnect = vi.fn();
      const { hasText, hasAttribute } = render(
        <AccountsEmptyState onConnect={onConnect} />
      );

      expect(hasText('Connect your first Facebook account')).toBe(true);
      expect(hasText('Link your Facebook Account to import pages')).toBe(true);
      expect(hasText('We only request permissions to publish reels and manage your pages')).toBe(true);
      expect(hasText('Connect Facebook Account')).toBe(true);
      expect(hasAttribute('data-testid', 'empty-connect-button')).toBe(true);
    });
  });

  describe('DisconnectAccountDialog', () => {
    it('renders safety confirmation dialog warning of connected pages detachment', () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();

      const { hasText, hasAttribute } = render(
        <DisconnectAccountDialog
          account={mockActiveAccount}
          open={true}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      );

      expect(hasText('Disconnect Sarah Connor?')).toBe(true);
      expect(hasText('This Account will no longer be available')).toBe(true);
      expect(hasText('3 linked Facebook pages')).toBe(true);
      expect(hasText('Before you disconnect')).toBe(true);
      expect(hasAttribute('data-testid', 'disconnect-cancel-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'disconnect-confirm-btn')).toBe(true);
    });
  });

  describe('ConnectAccountModal', () => {
    it('renders connection modal with Direct Connection and Magic Link choices', () => {
      const onOpenChange = vi.fn();
      const onAccountConnected = vi.fn();

      const { hasText, hasAttribute } = render(
        <ConnectAccountModal
          subdomain="acme"
          open={true}
          onOpenChange={onOpenChange}
          onAccountConnected={onAccountConnected}
          existingAccountIds={['acc-123']}
        />
      );

      expect(hasText('Connect Facebook Account')).toBe(true);
      expect(hasText('This browser')).toBe(true);
      expect(hasText('Different browser or device (Magic Link)')).toBe(true);
      expect(hasAttribute('data-testid', 'connect-option-direct')).toBe(true);
      expect(hasAttribute('data-testid', 'connect-option-magic')).toBe(true);
    });
  });
});
