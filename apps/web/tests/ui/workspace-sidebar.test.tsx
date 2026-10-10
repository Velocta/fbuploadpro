/**
 * @file workspace-sidebar.test.tsx
 * @description Unit tests for WorkspaceSidebar component (Spec 019 & Spec 025 / US2, US3).
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

describe('WorkspaceSidebar Component (Spec 019 & Spec 025)', () => {
  it('renders workspace identity header using SidebarMenuButton size="lg" with brand monogram FB, subdomain, and FBUploadPro without switcher chevrons', () => {
    const { hasText, hasAttribute, html, findTags } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(hasAttribute('data-slot', 'sidebar-header')).toBe(true);
    expect(hasAttribute('data-size', 'lg')).toBe(true);
    expect(hasText('acme')).toBe(true);
    expect(hasText('FBUploadPro')).toBe(true);
    expect(hasText('FB')).toBe(true);
    expect(html).toContain(PALETTE.primary);

    // Single workspace model: header has no switcher chevron arrows
    const headers = findTags('header');
    expect(headers.length).toBeGreaterThanOrEqual(1);
    expect(headers[0]?.outerHtml).not.toContain('m7 15 5 5 5-5');
    expect(headers[0]?.outerHtml).not.toContain('m7 9 5-5 5 5');
  });

  it('renders Home item, SidebarSeparator, and Collapsible Facebook section with SidebarMenuSub and SidebarMenuSubButton for Accounts', () => {
    const { hasText, hasAttribute, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    // Primary items per user directive
    expect(hasText('Home')).toBe(true);
    expect(hasText('Platform')).toBe(true);
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Accounts')).toBe(true);

    // Separator line present
    expect(hasAttribute('data-sidebar', 'separator')).toBe(true);

    // Collapsible + CollapsibleTrigger + SidebarMenuSub + SidebarMenuSubButton hierarchy
    expect(hasAttribute('data-slot', 'collapsible')).toBe(true);
    expect(hasAttribute('data-slot', 'collapsible-trigger')).toBe(true);
    expect(hasAttribute('data-slot', 'collapsible-content')).toBe(true);
    expect(hasAttribute('data-slot', 'sidebar-menu-sub')).toBe(true);
    expect(hasAttribute('data-slot', 'sidebar-menu-sub-item')).toBe(true);
    expect(hasAttribute('data-slot', 'sidebar-menu-sub-button')).toBe(true);
    // Rotating ChevronRight icon path
    expect(html).toContain('m9 18 6-6-6-6');
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

  it('renders user details and avatar initials in footer using NavUser pattern', () => {
    const { hasText, hasAttribute } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(hasAttribute('data-slot', 'sidebar-footer')).toBe(true);
    expect(hasText('Jane Doe')).toBe(true);
    expect(hasText('jane@example.com')).toBe(true);
    expect(hasText('JD')).toBe(true);
  });
});

