import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import TenantMediaPage from '../../src/app/tenant/[subdomain]/media/page';

describe('Tenant Media Library Dashboard Page (T110)', () => {
  beforeEach(() => {
    // Mock global fetch for SSR/tests
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/media/quota')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              userId: '11111111-1111-4111-a111-111111111111',
              totalBytes: 5368709120,
              usedBytes: 1073741824,
              remainingBytes: 4294967296,
              utilizationPercentage: 20,
              totalItems: 5,
              videoItems: 2,
              imageItems: 3,
            }),
        });
      }
      if (url.includes('/media/folders')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              folders: [],
              unorganizedCount: 5,
            }),
        });
      }
      if (url.includes('/media/captions')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url.includes('/media')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [],
              total: 0,
              limit: 50,
              offset: 0,
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders Media Library page header and primary call-to-actions', () => {
    const pageJsx = React.createElement(TenantMediaPage, {
      params: { subdomain: 'acme' },
    });

    const html = renderToString(pageJsx);
    expect(html).toContain('Media Library');
    expect(html).toContain('+ Upload Asset');
    expect(html).toContain('Caption Templates');
  });

  it('renders search input and media type filter controls', () => {
    const pageJsx = React.createElement(TenantMediaPage, {
      params: { subdomain: 'acme' },
    });

    const html = renderToString(pageJsx);
    expect(html).toContain('Search media...');
    expect(html).toContain('All Types');
    expect(html).toContain('Videos');
    expect(html).toContain('Images');
  });
});
