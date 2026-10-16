/**
 * @file workspace-breadcrumb.test.tsx
 * @description Unit tests for WorkspaceBreadcrumb component and computeBreadcrumbs routine (Spec 052).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  WorkspaceBreadcrumb,
  computeBreadcrumbs,
} from '@/components/workspace/workspace-breadcrumb';
import { render } from '../components/setup';

let mockPathname = '/tenant/acme';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('WorkspaceBreadcrumb (Spec 052)', () => {
  it('computes correct breadcrumb trails across workspace routes', () => {
    expect(computeBreadcrumbs('/tenant/acme', 'acme')).toEqual([{ label: 'Home' }]);
    expect(computeBreadcrumbs('/tenant/acme/', 'acme')).toEqual([{ label: 'Home' }]);
    expect(computeBreadcrumbs('/tenant/acme/media', 'acme')).toEqual([{ label: 'Media Library' }]);
    expect(computeBreadcrumbs('/tenant/acme/downloader', 'acme')).toEqual([{ label: 'Downloader' }]);
    expect(computeBreadcrumbs('/tenant/acme/settings', 'acme')).toEqual([{ label: 'Settings' }]);
    expect(computeBreadcrumbs('/tenant/acme/accounts', 'acme')).toEqual([
      { label: 'Facebook' },
      { label: 'Accounts' },
    ]);
    expect(computeBreadcrumbs('/tenant/acme/pages', 'acme')).toEqual([
      { label: 'Facebook' },
      { label: 'Pages' },
    ]);
    expect(computeBreadcrumbs('/tenant/acme/pages/page-456', 'acme')).toEqual([
      { label: 'Facebook' },
      { label: 'Pages', href: '/tenant/acme/pages' },
      { label: 'Details' },
    ]);
    expect(computeBreadcrumbs('/tenant/acme/instagram/accounts', 'acme')).toEqual([
      { label: 'Instagram' },
      { label: 'Accounts' },
    ]);
    expect(computeBreadcrumbs('/tenant/acme/threads/accounts', 'acme')).toEqual([
      { label: 'Threads' },
      { label: 'Accounts' },
    ]);
    expect(computeBreadcrumbs('/tenant/acme/twitter/accounts', 'acme')).toEqual([
      { label: 'X (Twitter)' },
      { label: 'Accounts' },
    ]);
  });

  it('renders breadcrumb trail with accessible ARIA elements and chevron separators', () => {
    mockPathname = '/tenant/acme/pages/page-456';
    const { hasAttribute, hasText, html } = render(
      <WorkspaceBreadcrumb subdomain="acme" />
    );

    expect(hasAttribute('data-slot', 'workspace-breadcrumb')).toBe(true);
    expect(hasAttribute('data-testid', 'workspace-breadcrumb')).toBe(true);
    expect(hasAttribute('aria-label', 'Breadcrumbs')).toBe(true);
    expect(hasText('Facebook')).toBe(true);
    expect(hasText('Pages')).toBe(true);
    expect(hasText('Details')).toBe(true);
    // Chevron separator icon
    expect(html).toContain('m9 18 6-6-6-6');
    // Leaf item has aria-current="page"
    expect(html).toContain('aria-current="page"');
  });
});
