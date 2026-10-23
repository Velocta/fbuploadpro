/**
 * Tenant shell contract tests (spec 130 PR-130-1, replacing the former
 * JSX-existence assertions per spec 137 §4.1 duty 8).
 *
 * - Null server session: the layout must resolve via redirect to login
 *   and must NEVER render a shell with fabricated identity data
 *   (spec 137 §4.4 — the fabricated-email fallback is deleted).
 * - Real session: the frame tree carries the session's real identity,
 *   the skip link, the content region, the header, the Banner slot and
 *   the Toaster mount.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

const mockGetSession = vi.fn();
vi.mock('@/lib/auth', () => ({
  getServerSessionContext: () => mockGetSession(),
}));

vi.mock('../../src/app/tenant/[subdomain]/workspace-display-name', () => ({
  getWorkspaceDisplayName: vi.fn(async () => 'Acme Corp'),
}));

import TenantLayout, { generateMetadata } from '../../src/app/tenant/[subdomain]/layout';
import TenantIndexPage from '../../src/app/tenant/[subdomain]/page';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { Toaster } from '@/components/shared/ui/toast';

const SESSION = {
  userId: 'user-1',
  email: 'owner@example.com',
  role: 'owner',
  subdomain: 'acme',
};

type AnyElement = React.ReactElement<Record<string, unknown>>;

function collectElements(node: unknown, out: AnyElement[] = []): AnyElement[] {
  if (Array.isArray(node)) {
    for (const child of node) collectElements(child, out);
    return out;
  }
  if (React.isValidElement(node)) {
    const el = node as AnyElement;
    out.push(el);
    collectElements(el.props.children, out);
  }
  return out;
}

async function renderLayout() {
  return TenantLayout({
    params: Promise.resolve({ subdomain: 'acme' }),
    children: React.createElement('div', { id: 'test-child' }, 'Workspace Content'),
  });
}

describe('Tenant Workspace Shell', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
  });

  it('redirects to login on a null session — never renders a fabricated user', async () => {
    mockGetSession.mockResolvedValue(null);

    let thrown: unknown;
    try {
      await renderLayout();
    } catch (error) {
      thrown = error;
    }

    // Next's redirect() throws a NEXT_REDIRECT error carrying the target.
    expect(thrown).toBeDefined();
    const digest = (thrown as { digest?: string }).digest ?? String(thrown);
    expect(digest).toContain('NEXT_REDIRECT');
    expect(digest).toContain('/login?returnUrl=');
    expect(digest).toContain(encodeURIComponent('/tenant/acme'));
  });

  it('renders the frame with the real session identity and shell chrome', async () => {
    mockGetSession.mockResolvedValue(SESSION);

    const layoutJsx = await renderLayout();
    const elements = collectElements(layoutJsx);

    // The sidebar receives the REAL session identity — no invented address.
    const sidebar = elements.find((el) => el.type === WorkspaceSidebar);
    expect(sidebar).toBeDefined();
    const user = sidebar?.props.user as { name: string; email: string };
    expect(user.email).toBe('owner@example.com');
    expect(user.email).not.toContain('@fbuploadpro.com');
    expect(sidebar?.props.workspaceName).toBe('Acme Corp');

    // Skip link targets the content region and is the first link in the tree.
    const firstAnchor = elements.find((el) => el.type === 'a');
    expect(firstAnchor?.props.href).toBe('#tenant-content');
    expect(firstAnchor?.props.children).toBe('Skip to content');

    // Content region carries the skip-link target id and is focusable.
    const inset = elements.find((el) => el.props.id === 'tenant-content');
    expect(inset).toBeDefined();
    expect(inset?.props.tabIndex).toBe(-1);

    // Header with the workspace topbar contract is present.
    const header = elements.find((el) => el.props['data-testid'] === 'workspace-topbar');
    expect(header).toBeDefined();

    // Banner slot region sits in the frame.
    const bannerSlot = elements.find((el) => el.props.id === 'tenant-banner-slot');
    expect(bannerSlot).toBeDefined();

    // The one Toaster system is mounted in the frame.
    const toaster = elements.find((el) => el.type === Toaster);
    expect(toaster).toBeDefined();

    // Children render inside the frame.
    const child = elements.find((el) => el.props.id === 'test-child');
    expect(child).toBeDefined();
  });

  it('composes metadata through the workspace-name template', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ subdomain: 'acme' }),
    });
    expect(metadata.title).toEqual({
      template: '%s · Acme Corp',
      default: 'Acme Corp',
    });
  });

  it('renders tenant index page with workspace title and welcome message', async () => {
    const pageJsx = await TenantIndexPage({
      params: Promise.resolve({ subdomain: 'acme' }),
    });

    expect(pageJsx).toBeDefined();
    expect(React.isValidElement(pageJsx)).toBe(true);
    const elements = collectElements(pageJsx);
    const heading = elements.find((el) => el.type === 'h1');
    expect(heading?.props.children).toEqual(['Workspace: ', 'Acme Corp']);
  });
});
