/**
 * @file desktop-titlebar.test.tsx
 * @description Unit tests for DesktopTitleBar component (Spec 035).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { DesktopTitleBar } from '@/components/desktop';
import { render } from '../components/setup';

describe('DesktopTitleBar Component (Spec 035)', () => {
  it('renders nothing by default in standard browser / SSR mode', () => {
    const { html } = render(<DesktopTitleBar />);
    expect(html).toBe('');
  });

  it('renders Windows/Linux frameless titlebar with drag region and controls when forceVisible is true', () => {
    const { hasTag, hasAttribute, hasText, html } = render(
      <DesktopTitleBar forceVisible platformOverride="windows" />
    );

    expect(hasTag('header')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-titlebar')).toBe(true);
    expect(hasAttribute('data-tauri-drag-region')).toBe(true);
    expect(hasText('FBUploadPro')).toBe(true);
    expect(hasAttribute('aria-label', 'FBUploadPro')).toBe(true);

    // Controls
    expect(hasAttribute('data-testid', 'desktop-minimize-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-maximize-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-close-btn')).toBe(true);

    // Non-drag attribute on buttons
    expect(hasAttribute('data-tauri-drag-region', 'false')).toBe(true);
    expect(hasAttribute('aria-label', 'Close window')).toBe(true);
    expect(hasAttribute('aria-label', 'Minimize window')).toBe(true);
    expect(hasAttribute('aria-label', 'Maximize or restore window')).toBe(true);
  });

  it('renders macOS traffic lights layout when platformOverride is mac', () => {
    const { hasAttribute, hasText } = render(
      <DesktopTitleBar forceVisible platformOverride="mac" />
    );

    expect(hasAttribute('data-testid', 'desktop-titlebar')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-traffic-lights')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-close-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-minimize-btn')).toBe(true);
    expect(hasAttribute('data-testid', 'desktop-maximize-btn')).toBe(true);
    expect(hasText('FBUploadPro')).toBe(true);
  });
});
