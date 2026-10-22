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

describe('WorkspaceSidebar Component (Spec 019, Spec 025, Spec 029, Spec 037 & Spec 052)', () => {
  it('renders FBUploadPro branding in SidebarHeader and Option A studio footer card in SidebarFooter (Spec 052)', () => {
    mockPathname = '/tenant/acme';
    const { hasText, hasAttribute, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    // Top Section: FBUploadPro Logo & Branding
    expect(hasAttribute('data-slot', 'sidebar-header')).toBe(true);
    expect(hasAttribute('data-testid', 'sidebar-branding-link')).toBe(true);
    expect(hasText('FBUploadPro')).toBe(true);
    expect(hasText('Studio')).toBe(true);
    expect(html).toContain(PALETTE.primary);
    expect(html).toContain(PALETTE.accent1);
    expect(html).toContain('fill-opacity="0.35"');

    // Bottom Section: Option A Unified Studio Footer
    expect(hasAttribute('data-slot', 'sidebar-footer')).toBe(true);
    expect(hasAttribute('data-size', 'lg')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-switcher-trigger')).toBe(true);
    expect(hasText('acme')).toBe(true);
    expect(hasText('AC')).toBe(true);
    expect(html).toContain('m7 15 5 5 5-5');
    expect(html).toContain('m7 9 5-5 5 5');
  });

  it('integrates Option A studio footer at bottom with workspace identity and user profile (Spec 052)', () => {
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
    expect(hasText('acme')).toBe(true);
    expect(hasText('jane@example.com')).toBe(true);
    expect(hasText('AC')).toBe(true);
  });

  it('renders Home, Media Library, Downloader, and Fdola Studio in the primary top group above SidebarSeparator, followed by Collapsible Facebook section', () => {
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
    expect(hasText('Fdola Studio')).toBe(true);
    expect(hasText('Platform')).toBe(true);
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Accounts')).toBe(true);

    // Verify ordering: Home -> Media Library -> Downloader -> Fdola Studio -> Separator -> Platform
    const homeIndex = html.indexOf('Home');
    const mediaIndex = html.indexOf('Media Library');
    const downloaderIndex = html.indexOf('Downloader');
    const fdolaIndex = html.indexOf('Fdola Studio');
    const separatorIndex = html.indexOf('data-sidebar="separator"');
    const platformIndex = html.indexOf('Platform');
    expect(homeIndex).toBeGreaterThan(-1);
    expect(mediaIndex).toBeGreaterThan(homeIndex);
    expect(downloaderIndex).toBeGreaterThan(mediaIndex);
    expect(fdolaIndex).toBeGreaterThan(downloaderIndex);
    expect(separatorIndex).toBeGreaterThan(fdolaIndex);
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
    const anchors = findTags('a');
    const activeMediaBtn = anchors.find(
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
    const anchors = findTags('a');
    const activeDownloaderBtn = anchors.find(
      (b) => b.innerHTML.includes('Downloader') && b.attributes['data-active'] === 'true'
    );
    expect(activeDownloaderBtn).toBeDefined();
  });

  it('marks Fdola Studio as active when pathname starts with /tenant/acme/fdola-studio', () => {
    mockPathname = '/tenant/acme/fdola-studio';
    const { html, findTags } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(html).toContain('aria-current="page"');
    const anchors = findTags('a');
    const activeFdolaBtn = anchors.find(
      (b) => b.innerHTML.includes('Fdola Studio') && b.attributes['data-active'] === 'true'
    );
    expect(activeFdolaBtn).toBeDefined();
  });

  it('renders Pages directly below Accounts inside the collapsible Facebook sidebar menu as a real anchor to /tenant/{subdomain}/pages (Spec 110)', () => {
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

    const { hasText, html, findTags } = render(
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

    // Spec 110: the Pages leaf is a real anchor whose href IS the navigation
    // target — a single click navigates via the anchor's default action.
    const anchors = findTags('a');
    const pagesAnchor = anchors.find(
      (a) => a.attributes['href'] === '/tenant/acme/pages' && a.attributes['data-sidebar'] === 'menu-sub-button'
    );
    expect(pagesAnchor).toBeDefined();

    // Locate the Pages leaf in the captured tree: it must carry the href and
    // its click handler must neither preventDefault nor substitute a
    // router.push (either would re-break single-click navigation).
    function findLeafByText(node: React.ReactNode, text: string): any {
      if (!node || typeof node !== 'object') return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const found = findLeafByText(item, text);
          if (found) return found;
        }
        return null;
      }
      if (React.isValidElement(node)) {
        const props = node.props as Record<string, any>;
        if (props.children === text && typeof props.href === 'string') {
          return node;
        }
        if (props.children) {
          return findLeafByText(props.children, text);
        }
      }
      return null;
    }

    const pagesLeaf = findLeafByText(capturedTree, 'Pages');
    expect(pagesLeaf).not.toBeNull();
    expect(pagesLeaf.props.href).toBe('/tenant/acme/pages');
    const preventDefault = vi.fn();
    pagesLeaf.props.onClick({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
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

    const listAnchors = listRender.findTags('a');
    const activePagesBtnOnList = listAnchors.find(
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

    const detailAnchors = detailRender.findTags('a');
    const activePagesBtnOnDetail = detailAnchors.find(
      (b) => b.innerHTML.includes('Pages') && b.attributes['data-active'] === 'true'
    );
    const activeAccountsBtnOnDetail = detailAnchors.find(
      (b) => b.innerHTML.includes('Accounts') && b.attributes['data-active'] === 'true'
    );
    expect(activePagesBtnOnDetail).toBeDefined();
    expect(activePagesBtnOnDetail?.attributes['aria-current']).toBe('page');
    expect(activeAccountsBtnOnDetail).toBeUndefined();
  });

  it('renders user details and active workspace in studio footer (Spec 052)', () => {
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
    expect(hasText('acme')).toBe(true);
    expect(hasText('jane@example.com')).toBe(true);
    expect(hasText('AC')).toBe(true);
  });

  it('renders all upcoming platforms (Instagram, Threads, X (Twitter), TikTok, YouTube) in the Platform group below Facebook', () => {
    mockPathname = '/tenant/acme';
    const { hasText, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    // Verify Facebook and all 5 upcoming platforms are present
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Instagram')).toBe(true);
    expect(hasText('Threads')).toBe(true);
    expect(hasText('X (Twitter)')).toBe(true);
    expect(hasText('TikTok')).toBe(true);
    expect(hasText('YouTube')).toBe(true);

    // Verify ordering in HTML
    const fbIdx = html.indexOf('Facebook');
    const igIdx = html.indexOf('Instagram');
    const thIdx = html.indexOf('Threads');
    const xIdx = html.indexOf('X (Twitter)');
    const ttIdx = html.indexOf('TikTok');
    const ytIdx = html.indexOf('YouTube');

    expect(fbIdx).toBeGreaterThan(-1);
    expect(igIdx).toBeGreaterThan(fbIdx);
    expect(thIdx).toBeGreaterThan(igIdx);
    expect(xIdx).toBeGreaterThan(thIdx);
    expect(ttIdx).toBeGreaterThan(xIdx);
    expect(ytIdx).toBeGreaterThan(ttIdx);
  });

  it('displays the Accounts sub-button and testing placeholder note when an upcoming platform is active', () => {
    mockPathname = '/tenant/acme/instagram/accounts';
    const { hasText, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    expect(hasText('Instagram')).toBe(true);
    expect(hasText('Accounts')).toBe(true);
    expect(hasText('Being tested — not available for public use')).toBe(true);
    expect(html).toContain('sidebar-testing-note-instagram');
  });

  it('renders upcoming platform Accounts sub-items as real anchors to /tenant/{subdomain}/{platform}/accounts (Spec 110)', () => {
    mockPathname = '/tenant/acme/threads/accounts';
    mockPush.mockClear();

    let capturedTree: React.ReactElement | null = null;
    function CaptureSidebar() {
      capturedTree = WorkspaceSidebar({
        subdomain: 'acme',
        user: { name: 'Jane Doe', email: 'jane@example.com' },
      });
      return capturedTree;
    }

    const { hasText } = render(
      <SidebarProvider>
        <CaptureSidebar />
      </SidebarProvider>
    );

    expect(hasText('Threads')).toBe(true);
    expect(hasText('Being tested — not available for public use')).toBe(true);

    function findAllLeavesByText(node: React.ReactNode, text: string, list: any[] = []): any[] {
      if (!node || typeof node !== 'object') return list;
      if (Array.isArray(node)) {
        for (const item of node) {
          findAllLeavesByText(item, text, list);
        }
        return list;
      }
      if (React.isValidElement(node)) {
        const props = node.props as Record<string, any>;
        if (props.children === text && typeof props.href === 'string') {
          list.push(node);
        }
        if (props.children) {
          findAllLeavesByText(props.children, text, list);
        }
      }
      return list;
    }

    const allAccountsLeaves = findAllLeavesByText(capturedTree, 'Accounts');
    expect(allAccountsLeaves.length).toBe(6);

    // Index 0: Facebook, Index 1: Instagram, Index 2: Threads, Index 3: X, Index 4: TikTok, Index 5: YouTube
    // Spec 110: navigation target lives in the anchor href; the click handler
    // must not preventDefault or substitute a router.push.
    expect(allAccountsLeaves[0].props.href).toBe('/tenant/acme/accounts');
    expect(allAccountsLeaves[1].props.href).toBe('/tenant/acme/instagram/accounts');
    expect(allAccountsLeaves[2].props.href).toBe('/tenant/acme/threads/accounts');

    const preventDefault = vi.fn();
    allAccountsLeaves[2].props.onClick({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders every primary leaf item as a real anchor with its tenant href and keeps the Facebook parent as a collapsible toggle button (Spec 110)', () => {
    mockPathname = '/tenant/acme';
    const { findTags, html } = render(
      <SidebarProvider>
        <WorkspaceSidebar
          subdomain="acme"
          user={{ name: 'Jane Doe', email: 'jane@example.com' }}
        />
      </SidebarProvider>
    );

    const anchorHrefs = findTags('a').map((a) => a.attributes['href']);
    expect(anchorHrefs).toContain('/tenant/acme/');
    expect(anchorHrefs).toContain('/tenant/acme/media');
    expect(anchorHrefs).toContain('/tenant/acme/downloader');
    expect(anchorHrefs).toContain('/tenant/acme/fdola-studio');
    expect(anchorHrefs).toContain('/tenant/acme/accounts');
    expect(anchorHrefs).toContain('/tenant/acme/pages');

    // The Facebook parent is a genuine toggle, not a route: it stays a
    // <button> wired to the collapsible trigger, initially expanded.
    expect(html).toContain('data-slot="collapsible-trigger"');
    expect(html).toContain('aria-expanded="true"');
    const buttons = findTags('button');
    const facebookToggle = buttons.find((b) => b.innerHTML.includes('Facebook'));
    expect(facebookToggle).toBeDefined();
    expect(facebookToggle?.attributes['data-slot']).toBe('collapsible-trigger');
    expect(facebookToggle?.attributes['type']).toBe('button');
  });
});




