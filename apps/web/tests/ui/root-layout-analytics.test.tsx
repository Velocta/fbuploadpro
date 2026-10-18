/**
 * @file root-layout-analytics.test.tsx
 * @description UI & integration tests for RootLayout Vercel Analytics integration (Spec 067).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import RootLayout, { metadata } from '@/app/layout';
import { render } from '../components/setup';

// Mock @vercel/analytics/next to verify component invocation in RootLayout
vi.mock('@vercel/analytics/next', () => ({
  Analytics: (props: Record<string, unknown>) => (
    <div data-testid="vercel-analytics" data-props={JSON.stringify(props)} />
  ),
}));

describe('RootLayout Vercel Analytics Integration (Spec 067)', () => {
  it('exposes publishing automation platform metadata', () => {
    expect(metadata.title).toBe('FBUploadPro');
    expect(metadata.description).toBe('publishing automation platform');
  });

  it('renders children within the document main container', () => {
    const { hasText, hasTag } = render(
      <RootLayout>
        <div data-testid="test-content">Dashboard Content</div>
      </RootLayout>
    );

    expect(hasTag('main')).toBe(true);
    expect(hasText('Dashboard Content')).toBe(true);
  });

  it('mounts the Vercel Analytics component within the body tree', () => {
    const { hasAttribute } = render(
      <RootLayout>
        <div>Test Page</div>
      </RootLayout>
    );

    expect(hasAttribute('data-testid', 'vercel-analytics')).toBe(true);
  });
});
