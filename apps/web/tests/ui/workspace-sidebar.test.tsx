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

let mockPathname = '/tenant/acme';
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

describe('WorkspaceSidebar Component (Spec 019, Spec 025 & Spec 029)', () => {
  it('renders workspace identity header using SidebarMenuButton size="lg" with brand monogram FB, subdomain, and FBUploadPro without switcher chevrons', () => {
    mockPathname = '/tenant/acme';
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

  it('renders Home and Media Library in the primary top group above SidebarSeparator, followed by Collapsible Facebook section', () => {
    mockPathname = '/tenant/acme';
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
    expect(hasText('Media Library')).toBe(true);
    expect(hasText('Platform')).toBe(true);
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Accounts')).toBe(true);

    // Verify ordering: Home -> Media Library -> Separator -> Platform
    const homeIndex = html.indexOf('Home');
    const mediaIndex = html.indexOf('Media Library');
    const separatorIndex = html.indexOf('data-sidebar="separator"');
    const platformIndex = html.indexOf('Platform');
    expect(homeIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeGreaterThan(homeIndex);
    expect(separatorIndex).toBeGreaterThan(mediaIndex);
    expect(platformIndex).toBeGreaterThan(separatorIndex);

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
    mockPathname = '/tenant/acme';
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

  it('marks Media Library as active when pathname starts with /tenant/acme/media', () => {
    mockPathname = '/tenant/acme/media';
    const { html, findTags } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(html).toContain('aria-current="page"');
    const buttons = findTags('button');
    const activeMediaBtn = buttons.find(
      (b) => b.innerHTML.includes('Media Library') && b.attributes['data-active'] === 'true'
    );
    expect(activeMediaBtn).toBeDefined();
  });

  it('renders user details and avatar initials in footer using NavUser pattern', () => {
    mockPathname = '/tenant/acme';
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


