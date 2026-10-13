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

describe('WorkspaceSidebar Component (Spec 019, Spec 025, Spec 029 & Spec 037)', () => {
  it('renders workspace identity header using shadcn TeamSwitcher pattern with monogram, subdomain, and ChevronsUpDown toggle', () => {
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
    expect(hasAttribute('data-testid', 'workspace-switcher-trigger')).toBe(true);
    expect(hasText('acme')).toBe(true);
    expect(hasText('AC')).toBe(true);
    expect(html).toContain(PALETTE.primary);

    // Multi-workspace switcher: header includes ChevronsUpDown toggle
    const headers = findTags('header');
    expect(headers.length).toBeGreaterThanOrEqual(1);
    expect(headers[0]?.outerHtml).toContain('m7 15 5 5 5-5');
    expect(headers[0]?.outerHtml).toContain('m7 9 5-5 5 5');
  });

  it('renders Settings in navigation content and marks it active on /tenant/acme/settings', () => {
    mockPathname = '/tenant/acme/settings';
    const { hasText, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(hasText('Settings')).toBe(true);
    expect(html).toContain('aria-current="page"');
  });

  it('renders Home, Media Library, and Downloader in the primary top group above SidebarSeparator, followed by Collapsible Facebook section', () => {
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
    expect(hasText('Downloader')).toBe(true);
    expect(hasText('Platform')).toBe(true);
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Accounts')).toBe(true);

    // Verify ordering: Home -> Media Library -> Downloader -> Separator -> Platform
    const homeIndex = html.indexOf('Home');
    const mediaIndex = html.indexOf('Media Library');
    const downloaderIndex = html.indexOf('Downloader');
    const separatorIndex = html.indexOf('data-sidebar="separator"');
    const platformIndex = html.indexOf('Platform');
    expect(homeIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeGreaterThan(homeIndex);
    expect(downloaderIndex).toBeGreaterThan(mediaIndex);
    expect(separatorIndex).toBeGreaterThan(downloaderIndex);
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

  it('marks Downloader as active when pathname starts with /tenant/acme/downloader', () => {
    mockPathname = '/tenant/acme/downloader';
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
    const activeDownloaderBtn = buttons.find(
      (b) => b.innerHTML.includes('Downloader') && b.attributes['data-active'] === 'true'
    );
    expect(activeDownloaderBtn).toBeDefined();
  });

  it('renders Pages directly below Accounts inside the collapsible Facebook sidebar menu and navigates to /tenant/{subdomain}/pages when clicked', () => {
    mockPathname = '/tenant/acme';
    mockPush.mockClear();

    let capturedTree: React.ReactElement | null = null;
    function CaptureSidebar() {
      capturedTree = WorkspaceSidebar({
        subdomain: 'acme',
        user: { name: 'Jane Doe', email: 'jane@example.com' },
      });
      return capturedTree;
    }

    const { hasText, html } = render(
      <SidebarProvider>
        <CaptureSidebar />
      </SidebarProvider>
    );

    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Accounts')).toBe(true);
    expect(hasText('Pages')).toBe(true);

    const facebookIdx = html.indexOf('Facebook');
    const accountsIdx = html.indexOf('Accounts');
    const pagesIdx = html.indexOf('Pages');
    expect(facebookIdx).toBeGreaterThan(-1);
    expect(accountsIdx).toBeGreaterThan(facebookIdx);
    expect(pagesIdx).toBeGreaterThan(accountsIdx);

    // Locate the Pages sub-button in the captured tree and invoke its onClick handler
    function findButtonByText(node: React.ReactNode, text: string): any {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const found = findButtonByText(item, text);
          if (found) return found;
        }
        return null;
      }
      if (React.isValidElement(node)) {
        const props = node.props as Record<string, any>;
        if (props.children === text && typeof props.onClick === 'function') {
          return node;
        }
        if (props.children) {
          return findButtonByText(props.children, text);
        }
      }
      return null;
    }

    const pagesSubBtn = findButtonByText(capturedTree, 'Pages');
    expect(pagesSubBtn).not.toBeNull();
    pagesSubBtn.props.onClick();
    expect(mockPush).toHaveBeenCalledWith('/tenant/acme/pages');
  });

  it('marks Pages as active when pathname is /tenant/acme/pages or /tenant/acme/pages/[pageId]', () => {
    mockPathname = '/tenant/acme/pages';
    const listRender = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    const listButtons = listRender.findTags('button');
    const activePagesBtnOnList = listButtons.find(
      (b) => b.innerHTML.includes('Pages') && b.attributes['data-active'] === 'true'
    );
    expect(activePagesBtnOnList).toBeDefined();
    expect(activePagesBtnOnList?.attributes['aria-current']).toBe('page');

    mockPathname = '/tenant/acme/pages/page-uuid-123';
    const detailRender = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    const detailButtons = detailRender.findTags('button');
    const activePagesBtnOnDetail = detailButtons.find(
      (b) => b.innerHTML.includes('Pages') && b.attributes['data-active'] === 'true'
    );
    const activeAccountsBtnOnDetail = detailButtons.find(
      (b) => b.innerHTML.includes('Accounts') && b.attributes['data-active'] === 'true'
    );
    expect(activePagesBtnOnDetail).toBeDefined();
    expect(activePagesBtnOnDetail?.attributes['aria-current']).toBe('page');
    expect(activeAccountsBtnOnDetail).toBeUndefined();
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



