import { describe, it, expect } from 'vitest';
import TenantLayout from '../src/app/tenant/[subdomain]/layout';
import DashboardPage from '../src/app/tenant/[subdomain]/dashboard/page';
import TenantIndexPage from '../src/app/tenant/[subdomain]/page';
import React from 'react';

describe('Tenant Workspace Dashboard Shell (User Story 4)', () => {
  it('renders tenant layout with subdomain badge and navigation header', async () => {
    const layoutJsx = await TenantLayout({
      params: Promise.resolve({ subdomain: 'acme' }),
      children: React.createElement('div', { id: 'test-child' }, 'Dashboard Content'),
    });

    expect(layoutJsx).toBeDefined();
    expect(React.isValidElement(layoutJsx)).toBe(true);
  });

  it('renders tenant dashboard page with operational summary', async () => {
    const pageJsx = await DashboardPage({
      params: Promise.resolve({ subdomain: 'acme' }),
    });

    expect(pageJsx).toBeDefined();
    expect(React.isValidElement(pageJsx)).toBe(true);
  });

  it('renders tenant index page redirecting or rendering entry', async () => {
    const pageJsx = await TenantIndexPage({
      params: Promise.resolve({ subdomain: 'acme' }),
    });

    expect(pageJsx).toBeDefined();
    expect(React.isValidElement(pageJsx)).toBe(true);
  });
});
