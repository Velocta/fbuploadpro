/**
 * @file workspace-switcher.test.tsx
 * @description Unit tests for WorkspaceSwitcher and CreateWorkspaceModal components (Spec 037).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SidebarProvider } from '@/components/ui';
import { WorkspaceSwitcher } from '@/components/workspace/workspace-switcher';
import { CreateWorkspaceModal } from '@/components/workspace/create-workspace-modal';
import { render } from '../components/setup';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/tenant/acme',
}));

describe('WorkspaceSwitcher & CreateWorkspaceModal (Spec 037)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          workspaces: [
            { id: 'ws-1', name: 'Acme Media', subdomain: 'acme' },
            { id: 'ws-2', name: 'Beta Agency', subdomain: 'beta' },
          ],
        }),
      })
    );
  });

  it('renders trigger button with monogram, active workspace name, subdomain and ChevronsUpDown icon', () => {
    const { hasAttribute, hasText, html } = render(
      <SidebarProvider>
        <WorkspaceSwitcher currentSubdomain="acme" />
      </SidebarProvider>
    );

    expect(hasAttribute('data-testid', 'workspace-switcher-trigger')).toBe(true);
    expect(hasAttribute('data-size', 'lg')).toBe(true);
    expect(hasText('acme')).toBe(true);
    // ChevronsUpDown toggle paths
    expect(html).toContain('m7 15 5 5 5-5');
    expect(html).toContain('m7 9 5-5 5 5');
  });

  it('renders CreateWorkspaceModal dialog with workspace name input, auto-creation notice, and action buttons', () => {
    const handleClose = vi.fn();
    const { hasAttribute, hasText, html } = render(
      <CreateWorkspaceModal isOpen={true} onClose={handleClose} />
    );

    expect(hasAttribute('role', 'dialog')).toBe(true);
    expect(hasAttribute('aria-modal', 'true')).toBe(true);
    expect(hasText('Create Workspace')).toBe(true);
    expect(hasText('Workspace Name')).toBe(true);
    expect(hasText('A unique subdomain will be automatically created')).toBe(true);
    expect(hasAttribute('data-testid', 'create-workspace-submit')).toBe(true);
    expect(html).toContain('Cancel');
  });

  it('does not render CreateWorkspaceModal when isOpen is false', () => {
    const { html } = render(
      <CreateWorkspaceModal isOpen={false} onClose={vi.fn()} />
    );
    expect(html).toBe('');
  });
});
