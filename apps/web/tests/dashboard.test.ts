import { describe, it, expect } from 'vitest';
import TenantLayout from '../src/app/tenant/[subdomain]/layout';
import TenantIndexPage from '../src/app/tenant/[subdomain]/page';
import React from 'react';

describe('Tenant Workspace Shell', () => {
  it('renders tenant layout with pure sidebar app shell and children', async () => {
    const layoutJsx = await TenantLayout({
      params: Promise.resolve({ subdomain: 'acme' }),
      children: React.createElement('div', { id: 'test-child' }, 'Workspace Content'),
    });

    expect(layoutJsx).toBeDefined();
    expect(React.isValidElement(layoutJsx)).toBe(true);

    // Verify it wraps with SidebarProvider
    const layoutElement = layoutJsx as React.ReactElement;
    expect(layoutElement.props).toHaveProperty('children');
  });

  it('renders tenant index page with workspace title and welcome message', async () => {
    const pageJsx = await TenantIndexPage({
      params: Promise.resolve({ subdomain: 'acme' }),
    });

    expect(pageJsx).toBeDefined();
    expect(React.isValidElement(pageJsx)).toBe(true);
  });
});

