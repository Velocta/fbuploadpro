/**
 * @file fdola-studio.test.tsx
 * @description Behavioural tests for Fdola Studio (spec 141 §3/§6):
 * - FdolaStudioGate (web browser: coming-soon notice per OD-141-3(c), zero links/buttons)
 * - FdolaStudioWorkspace (desktop app placeholder)
 * - FdolaStudioView (environment-adaptive container)
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  FdolaStudioGate,
  FdolaStudioWorkspace,
  FdolaStudioView,
} from '@/components/studio';

describe('FdolaStudioGate Component (Web Browser)', () => {
  it('renders the coming-soon notice with zero links or buttons', () => {
    const { container } = render(<FdolaStudioGate subdomain="acme" />);

    expect(screen.getByTestId('fdola-studio-gate')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fdola Studio' })).toBeTruthy();
    expect(screen.getByTestId('fdola-gate-message').textContent).toBe(
      'Fdola Studio is coming soon.'
    );

    // The retired download instruction must not survive anywhere.
    expect(container.textContent).not.toContain('download the desktop app');

    // Zero download or external launch links and zero buttons (OD-141-3(c)
    // keeps this assertion — the copy changed, no action was added).
    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('FdolaStudioWorkspace Component (Desktop App Empty View)', () => {
  it('renders the desktop workspace placeholder', () => {
    render(<FdolaStudioWorkspace subdomain="acme" />);

    expect(screen.getByTestId('fdola-studio-workspace')).toBeTruthy();
    expect(screen.getByText('Fdola Studio')).toBeTruthy();
    expect(screen.getByTestId('fdola-desktop-workspace-empty')).toBeTruthy();
    expect(screen.getByText('Desktop Workspace')).toBeTruthy();
  });
});

describe('FdolaStudioView Container', () => {
  it('renders FdolaStudioGate when accessed via web browser', async () => {
    render(<FdolaStudioView subdomain="acme" forceDesktop={false} />);

    expect(screen.getByTestId('fdola-studio-view')).toBeTruthy();
    expect(await screen.findByTestId('fdola-studio-gate')).toBeTruthy();
    expect(screen.getByTestId('fdola-gate-message').textContent).toBe(
      'Fdola Studio is coming soon.'
    );
  });

  it('renders FdolaStudioWorkspace when running inside desktop app', () => {
    render(<FdolaStudioView subdomain="acme" forceDesktop={true} />);

    expect(screen.getByTestId('fdola-studio-view')).toBeTruthy();
    expect(screen.getByTestId('fdola-studio-workspace')).toBeTruthy();
  });
});
