/**
 * @file workspace-user-menu.test.tsx
 * @description Unit tests for WorkspaceUserMenu component (Spec 019 & Spec 025 / US3).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { SidebarProvider } from '@/components/ui';
import { WorkspaceUserMenu } from '@/components/workspace/workspace-user-menu';
import { render } from '../components/setup';

describe('WorkspaceUserMenu Component (Spec 019 & Spec 025)', () => {
  it('renders NavUser footer using SidebarMenuButton size="lg", avatar, user name/email, and ChevronsUpDown icon', () => {
    const { hasText, hasAttribute, html } = render(
      <SidebarProvider>
        <WorkspaceUserMenu
          user={{
            name: 'Alex Mercer',
            email: 'alex@example.com',
          }}
        />
      </SidebarProvider>
    );

    expect(hasAttribute('data-slot', 'sidebar-menu')).toBe(true);
    expect(hasAttribute('data-slot', 'sidebar-menu-item')).toBe(true);
    expect(hasAttribute('data-slot', 'sidebar-menu-button')).toBe(true);
    expect(hasAttribute('data-size', 'lg')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-user-caret')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-user-avatar')).toBe(true);
    expect(hasText('Alex Mercer')).toBe(true);
    expect(hasText('alex@example.com')).toBe(true);
    expect(hasText('AM')).toBe(true);
    // ChevronsUpDown SVG paths
    expect(html).toContain('m7 15 5 5 5-5');
    expect(html).toContain('m7 9 5-5 5 5');
  });

  it('renders user menu button with accessible ARIA attributes and collapsed 32x32 square geometry', () => {
    const { hasAttribute, hasStyle } = render(
      <SidebarProvider open={false}>
        <WorkspaceUserMenu
          user={{
            name: 'Alex Mercer',
            email: 'alex@example.com',
          }}
        />
      </SidebarProvider>
    );

    expect(hasAttribute('aria-label', 'User menu')).toBe(true);
    expect(hasAttribute('aria-haspopup', 'true')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-user-caret')).toBe(true);
    expect(hasAttribute('data-collapsed', 'true')).toBe(true);
    expect(hasStyle('width', '32px')).toBe(true);
    expect(hasStyle('height', '32px')).toBe(true);
    expect(hasStyle('padding', '0px')).toBe(true);
  });

  it('falls back to default user details when user prop is omitted', () => {
    const { hasText } = render(
      <SidebarProvider>
        <WorkspaceUserMenu />
      </SidebarProvider>
    );

    expect(hasText('Workspace User')).toBe(true);
    expect(hasText('user@example.com')).toBe(true);
    expect(hasText('WU')).toBe(true);
  });
});

