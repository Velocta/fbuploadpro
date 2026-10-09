/**
 * @file workspace-sidebar.test.tsx
 * @description Unit tests for WorkspaceSidebar component (Spec 019 / US2).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { SidebarProvider } from '@/components/ui';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { THEME, PALETTE } from '@/lib/theme';
import { render } from '../components/setup';

vi.mock('next/navigation', () => ({
  usePathname: () => '/tenant/acme',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('WorkspaceSidebar Component (Spec 019)', () => {
  it('renders workspace branding and subdomain name in header', () => {
    const { hasText, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(hasText('acme')).toBe(true);
    expect(hasText('FBUploadPro')).toBe(true);
    expect(hasText('FB')).toBe(true);
    expect(html).toContain(PALETTE.primary);
  });

  it('renders Home item, SidebarSeparator, and Facebook Accounts section', () => {
    const { hasText, hasAttribute } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    // Primary items per user directive
    expect(hasText('Home')).toBe(true);
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Accounts')).toBe(true);

    // Separator line present
    expect(hasAttribute('data-sidebar', 'separator')).toBe(true);
  });

  it('marks Home as active when pathname matches tenant home', () => {
    const { html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    // Active state uses active surface and gold primary bar indicator
    expect(html).toContain(THEME.default.surfaces.active);
    expect(html).toContain('aria-current="page"');
  });

  it('renders user details and avatar initials in footer', () => {
    const { hasText } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(hasText('Jane Doe')).toBe(true);
    expect(hasText('jane@example.com')).toBe(true);
    expect(hasText('JD')).toBe(true);
  });
});
