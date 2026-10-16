/**
 * @file workspace-studio-footer.test.tsx
 * @description Unit tests for WorkspaceStudioFooter component and sign-out resilience (Spec 056 & Spec 052).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidebarProvider } from '@/components/ui';
import {
  WorkspaceStudioFooter,
  PopoverActionsList,
  broadcastLogout,
  getMonogram,
} from '@/components/workspace/workspace-studio-footer';
import { render } from '../components/setup';

describe('WorkspaceStudioFooter Component (Spec 056 & Spec 052)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('computes monograms accurately for single and multi-word names', () => {
    expect(getMonogram('Alex Mercer')).toBe('AM');
    expect(getMonogram('SingleWord')).toBe('S');
    expect(getMonogram('Three Word Name')).toBe('TW');
    expect(getMonogram('')).toBe('W');
  });

  it('renders studio footer trigger with workspace identity, email, and user avatar', () => {
    const { hasText, hasAttribute } = render(
      <SidebarProvider>
        <WorkspaceStudioFooter
          subdomain="acme"
          user={{
            name: 'Jane Doe',
            email: 'jane@example.com',
          }}
        />
      </SidebarProvider>
    );

    expect(hasAttribute('data-slot', 'sidebar-menu')).toBe(true);
    expect(hasAttribute('data-slot', 'sidebar-menu-button')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-switcher-trigger')).toBe(true);
    expect(hasText('acme')).toBe(true);
    expect(hasText('jane@example.com')).toBe(true);
    expect(hasText('JD')).toBe(true);
  });

  it('renders collapsed 32x32 geometry when sidebar is collapsed', () => {
    const { hasAttribute } = render(
      <SidebarProvider open={false}>
        <WorkspaceStudioFooter
          subdomain="acme"
          user={{
            name: 'Jane Doe',
            email: 'jane@example.com',
          }}
        />
      </SidebarProvider>
    );

    expect(hasAttribute('data-collapsed', 'true')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-switcher-trigger')).toBe(true);
  });

  it('dispatches cross-tab logout event when broadcastLogout is called', () => {
    const postMessage = vi.fn();
    const close = vi.fn();
    class MockBroadcastChannel {
      postMessage = postMessage;
      close = close;
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    const mockLocalStorage = { setItem: vi.fn(), removeItem: vi.fn() };
    vi.stubGlobal('localStorage', mockLocalStorage);

    broadcastLogout();

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOGOUT' })
    );
  });

  describe('PopoverActionsList & Sign-Out Resilience (Spec 056)', () => {
    it('renders normal Sign Out button with active styling when isSigningOut is false', () => {
      const onSignOut = vi.fn();
      const { hasText, hasAttribute, hasStyle } = render(
        <PopoverActionsList
          currentSubdomain="acme"
          isThemeDark={true}
          isSettingsActive={false}
          isSigningOut={false}
          onOpenSettings={vi.fn()}
          onToggleTheme={vi.fn()}
          onSignOut={onSignOut}
        />
      );

      expect(hasText('Sign Out')).toBe(true);
      expect(hasText('Signing out...')).toBe(false);
      expect(hasAttribute('data-testid', 'logout-button')).toBe(true);
      expect(hasStyle('cursor', 'pointer')).toBe(true);
      expect(hasStyle('opacity', '1')).toBe(true);
    });

    it('renders disabled "Signing out..." state with reduced opacity when isSigningOut is true', () => {
      const onSignOut = vi.fn();
      const { hasText, hasAttribute, hasStyle } = render(
        <PopoverActionsList
          currentSubdomain="acme"
          isThemeDark={true}
          isSettingsActive={false}
          isSigningOut={true}
          onOpenSettings={vi.fn()}
          onToggleTheme={vi.fn()}
          onSignOut={onSignOut}
        />
      );

      expect(hasText('Signing out...')).toBe(true);
      expect(hasText('Sign Out')).toBe(false);
      expect(hasAttribute('data-testid', 'logout-button')).toBe(true);
      expect(hasAttribute('aria-disabled', 'true')).toBe(true);
      expect(hasStyle('cursor', 'not-allowed')).toBe(true);
      expect(hasStyle('opacity', '0.6')).toBe(true);
    });

    it('invokes onSignOut callback when logout button is clicked', () => {
      const onSignOut = vi.fn();
      const tree = PopoverActionsList({
        currentSubdomain: 'acme',
        isThemeDark: true,
        isSettingsActive: false,
        isSigningOut: false,
        onOpenSettings: vi.fn(),
        onToggleTheme: vi.fn(),
        onSignOut,
      });

      // Find logout button in children
      const children = React.Children.toArray(tree.props.children);
      const logoutBtn = children.find(
        (child: any) => child?.props?.['data-testid'] === 'logout-button'
      ) as React.ReactElement<any>;

      expect(logoutBtn).toBeDefined();
      logoutBtn.props.onClick();
      expect(onSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
