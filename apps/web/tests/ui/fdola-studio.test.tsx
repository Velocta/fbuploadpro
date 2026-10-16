/**
 * @file fdola-studio.test.tsx
 * @description Unit tests for Fdola Studio components:
 * - FdolaStudioGate (Web browser desktop-only notice)
 * - FdolaStudioWorkspace (Empty desktop app workspace)
 * - FdolaStudioView (Environment-adaptive container)
 * (Spec 057)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../components/setup';
import {
  FdolaStudioGate,
  FdolaStudioWorkspace,
  FdolaStudioView,
} from '@/components/studio';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useParams: () => ({ subdomain: 'acme' }),
}));

describe('FdolaStudioGate Component (Web Browser)', () => {
  it('renders centered desktop-only message with zero links or buttons', () => {
    const { hasAttribute, hasText, html } = render(
      <FdolaStudioGate subdomain="acme" />
    );

    expect(hasAttribute('data-testid', 'fdola-studio-gate')).toBe(true);
    expect(hasText('Fdola Studio')).toBe(true);
    expect(hasAttribute('data-testid', 'fdola-gate-message')).toBe(true);
    expect(
      hasText('This feature is only available on desktop. Please download the desktop app.')
    ).toBe(true);

    // Verify zero download or external launch links and zero buttons
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href');
    expect(html).not.toContain('<button');

    // Verify theme-reactive CSS variables
    expect(html).toContain('var(--bg-panel');
    expect(html).toContain('var(--shadow-card');
    expect(html).toContain('var(--text-sub');
  });
});

describe('FdolaStudioWorkspace Component (Desktop App Empty View)', () => {
  it('renders empty desktop workspace placeholder with theme-reactive styles', () => {
    const { hasAttribute, hasText, html } = render(
      <FdolaStudioWorkspace subdomain="acme" />
    );

    expect(hasAttribute('data-testid', 'fdola-studio-workspace')).toBe(true);
    expect(hasText('Fdola Studio')).toBe(true);
    expect(hasAttribute('data-testid', 'fdola-desktop-workspace-empty')).toBe(true);

    // Verify theme-reactive CSS variables
    expect(html).toContain('var(--bg-panel');
    expect(html).toContain('var(--shadow-card');
    expect(html).toContain('var(--text-sub');
  });
});

describe('FdolaStudioView Container', () => {
  it('renders FdolaStudioGate when accessed via web browser', () => {
    const { hasAttribute, hasText } = render(
      <FdolaStudioView subdomain="acme" forceDesktop={false} />
    );

    expect(hasAttribute('data-testid', 'fdola-studio-view')).toBe(true);
    expect(hasAttribute('data-testid', 'fdola-studio-gate')).toBe(true);
    expect(
      hasText('This feature is only available on desktop. Please download the desktop app.')
    ).toBe(true);
  });

  it('renders FdolaStudioWorkspace when running inside desktop app', () => {
    const { hasAttribute } = render(
      <FdolaStudioView subdomain="acme" forceDesktop={true} />
    );

    expect(hasAttribute('data-testid', 'fdola-studio-view')).toBe(true);
    expect(hasAttribute('data-testid', 'fdola-studio-workspace')).toBe(true);
  });
});
