/**
 * @file workspace-user-menu.test.tsx
 * @description Unit tests for WorkspaceUserMenu component (Spec 019 / US3).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { SidebarProvider } from '@/components/ui';
import { WorkspaceUserMenu } from '@/components/workspace/workspace-user-menu';
import { render } from '../components/setup';

describe('WorkspaceUserMenu Component (Spec 019)', () => {
  it('renders user initials, display name, and canonical email', () => {
    const { hasText, hasAttribute } = render(
      <SidebarProvider>
        <WorkspaceUserMenu
          user={{
            name: 'Alex Mercer',
            email: 'alex@example.com',
          }}
        />
      </SidebarProvider>
    );

    expect(hasText('Alex Mercer')).toBe(true);
    expect(hasText('alex@example.com')).toBe(true);
    expect(hasText('AM')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-user-avatar')).toBe(true);
  });

  it('renders chevron-up action button with accessible ARIA attributes', () => {
    const { hasAttribute } = render(
      <SidebarProvider>
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
