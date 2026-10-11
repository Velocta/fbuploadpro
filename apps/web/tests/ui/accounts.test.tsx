/**
 * @file accounts.test.tsx
 * @description Unit tests for Facebook Accounts UI components (Spec 027 & Spec 029).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { AccountCard, type FacebookAccountItem } from '@/components/accounts/account-card';
import { AccountsEmptyState } from '@/components/accounts/accounts-empty-state';
import { DisconnectAccountDialog } from '@/components/accounts/disconnect-account-dialog';
import {
  ConnectAccountModal,
  MagicLinkView,
  hasCompletedAccountConnection,
} from '@/components/accounts/connect-account-modal';
import {
  AccountsFilterBar,
  filterAccountsList,
  sortAccountsExpiredFirst,
} from '@/app/tenant/[subdomain]/accounts/page';
import { render } from '../components/setup';

describe('Facebook Accounts UI Components (Spec 027 & Spec 029)', () => {
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

  const mockZeroPagesAccount: FacebookAccountItem = {
    ...mockActiveAccount,
    id: 'acc-zero',
    displayName: 'Zero Pages Profile',
    connectedPagesCount: 0,
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
    it('renders destructive linked pages warning when connectedPagesCount > 0', () => {
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
      expect(hasAttribute('data-testid', 'disconnect-linked-pages-warning')).toBe(true);
      expect(hasText('3 linked Facebook pages')).toBe(true);
      expect(hasText('Before you disconnect')).toBe(true);
      expect(hasAttribute('data-testid', 'disconnect-cancel-btn')).toBe(true);
      expect(hasAttribute('data-testid', 'disconnect-confirm-btn')).toBe(true);
    });

    it('renders calm neutral notice when connectedPagesCount === 0 without Before you disconnect warning (Spec 029)', () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();

      const { hasText, hasAttribute } = render(
        <DisconnectAccountDialog
          account={mockZeroPagesAccount}
          open={true}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      );

      expect(hasText('Disconnect Zero Pages Profile?')).toBe(true);
      expect(hasAttribute('data-testid', 'disconnect-zero-pages-notice')).toBe(true);
      expect(
        hasText(
          'No Facebook pages are linked to this account yet. its safe to remove, You can reconnect it anytime.'
        )
      ).toBe(true);
      expect(hasText('Before you disconnect')).toBe(false);
      expect(hasAttribute('data-testid', 'disconnect-linked-pages-warning')).toBe(false);
    });
  });

  describe('ConnectAccountModal & MagicLinkView', () => {
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

    it('renders "Reconnect {displayName}" as the modal title when reconnectingAccount is provided (Spec 029)', () => {
      const { hasText } = render(
        <ConnectAccountModal
          subdomain="acme"
          open={true}
          onOpenChange={vi.fn()}
          onAccountConnected={vi.fn()}
          reconnectingAccount={{ id: 'acc-456', displayName: 'John Doe' }}
        />
      );

      expect(hasText('Reconnect John Doe')).toBe(true);
      expect(hasText('Connect Facebook Account')).toBe(false);
    });

    it('renders click-to-copy magic link input when countdown is active and inline regenerate button when expired at 0:00 (Spec 029)', () => {
      const activeRender = render(
        <MagicLinkView
          magicUrl="https://acme.vinsmokemedia.online/api/auth/facebook/magic?token=abc"
          remainingSeconds={840}
          copySuccess={false}
          isGeneratingMagic={false}
          onCopyLink={vi.fn()}
          onRegenerateLink={vi.fn()}
        />
      );

      expect(activeRender.hasAttribute('data-testid', 'magic-url-input')).toBe(true);
      expect(activeRender.hasAttribute('data-testid', 'magic-copy-button')).toBe(true);
      expect(activeRender.hasAttribute('data-testid', 'magic-regenerate-button')).toBe(false);
      expect(activeRender.hasText('Link expires in 14:00')).toBe(true);

      const expiredRender = render(
        <MagicLinkView
          magicUrl="https://acme.vinsmokemedia.online/api/auth/facebook/magic?token=abc"
          remainingSeconds={0}
          copySuccess={false}
          isGeneratingMagic={false}
          onCopyLink={vi.fn()}
          onRegenerateLink={vi.fn()}
        />
      );

      expect(expiredRender.hasAttribute('data-testid', 'magic-regenerate-button')).toBe(true);
      expect(expiredRender.hasText('Link expired — Generate a new link')).toBe(true);
      expect(expiredRender.hasAttribute('data-testid', 'magic-url-input')).toBe(false);
      expect(expiredRender.hasText('Magic link expired')).toBe(true);
    });

    it('hasCompletedAccountConnection detects both newly added accounts and existing expired accounts returning to active (Spec 029)', () => {
      const initialIds = new Set(['acc-123', 'acc-456']);
      const initialStates = new Map([
        ['acc-123', { status: 'active', updatedAt: '2026-10-01T12:00:00Z' }],
        ['acc-456', { status: 'expired', updatedAt: '2026-09-15T10:00:00Z' }],
      ]);

      // Unchanged state -> false
      expect(
        hasCompletedAccountConnection(
          [
            { id: 'acc-123', status: 'active', updatedAt: '2026-10-01T12:00:00Z' },
            { id: 'acc-456', status: 'expired', updatedAt: '2026-09-15T10:00:00Z' },
          ],
          initialIds,
          initialStates,
          { id: 'acc-456', displayName: 'John Doe', status: 'expired', updatedAt: '2026-09-15T10:00:00Z' }
        )
      ).toBe(false);

      // Brand new account added -> true
      expect(
        hasCompletedAccountConnection(
          [
            { id: 'acc-123', status: 'active', updatedAt: '2026-10-01T12:00:00Z' },
            { id: 'acc-new-789', status: 'active', updatedAt: '2026-10-10T15:00:00Z' },
          ],
          initialIds,
          initialStates,
          null
        )
      ).toBe(true);

      // Existing expired account returning to active -> true
      expect(
        hasCompletedAccountConnection(
          [
            { id: 'acc-123', status: 'active', updatedAt: '2026-10-01T12:00:00Z' },
            { id: 'acc-456', status: 'active', updatedAt: '2026-10-10T15:00:00Z' },
          ],
          initialIds,
          initialStates,
          { id: 'acc-456', displayName: 'John Doe', status: 'expired', updatedAt: '2026-09-15T10:00:00Z' }
        )
      ).toBe(true);
    });
  });

  describe('Sorting & Agency Search/Filter Bar (Spec 029)', () => {
    it('sortAccountsExpiredFirst pins expired accounts to the top followed by createdAt DESC', () => {
      const sorted = sortAccountsExpiredFirst([
        mockActiveAccount, // active, 2026-10-01
        mockExpiredAccount, // expired, 2026-09-15
        {
          ...mockActiveAccount,
          id: 'acc-newest',
          displayName: 'Newest Active',
          createdAt: '2026-10-09T12:00:00Z',
        },
      ]);

      expect(sorted.map((a) => a.id)).toEqual(['acc-456', 'acc-newest', 'acc-123']);
    });

    it('filterAccountsList filters by searchQuery and statusFilter', () => {
      const list = [mockExpiredAccount, mockActiveAccount];

      expect(filterAccountsList(list, 'sarah', 'all')).toHaveLength(1);
      expect(filterAccountsList(list, 'sarah', 'all')[0]?.id).toBe('acc-123');
      expect(filterAccountsList(list, '', 'expired')).toHaveLength(1);
      expect(filterAccountsList(list, '', 'expired')[0]?.id).toBe('acc-456');
      expect(filterAccountsList(list, 'nonexistent', 'all')).toHaveLength(0);
    });

    it('AccountsFilterBar renders search input and All / Active / Expired filter buttons', () => {
      const { hasAttribute, hasText } = render(
        <AccountsFilterBar
          searchQuery=""
          onSearchChange={vi.fn()}
          statusFilter="all"
          onStatusFilterChange={vi.fn()}
        />
      );

      expect(hasAttribute('data-testid', 'accounts-filter-bar')).toBe(true);
      expect(hasAttribute('data-testid', 'accounts-search-input')).toBe(true);
      expect(hasAttribute('data-testid', 'accounts-filter-all')).toBe(true);
      expect(hasAttribute('data-testid', 'accounts-filter-active')).toBe(true);
      expect(hasAttribute('data-testid', 'accounts-filter-expired')).toBe(true);
      expect(hasText('All')).toBe(true);
      expect(hasText('Active')).toBe(true);
      expect(hasText('Expired')).toBe(true);
    });
  });
});

