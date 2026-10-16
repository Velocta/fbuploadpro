import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '../components/setup';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import LoginPage from '@/app/login/page';
import { PALETTE } from '@/lib/theme';

describe('Login Showcase Panel Redesign (Spec 061)', () => {
  it('renders brand row with logo mark, bold title, and muted tagline', () => {
    const { hasText, html } = render(<LoginShowcasePanel />);

    expect(hasText('FBUploadPro')).toBe(true);
    expect(hasText('Content automation for creators')).toBe(true);
    // Verifies BrandMark presence via SVG aria-label
    expect(html).toContain('aria-label="FBUploadPro"');
  });

  it('renders unboxed eyebrow label in accent color with wide letter-spacing', () => {
    const { hasText, html } = render(<LoginShowcasePanel />);

    expect(hasText('CREATE · SCHEDULE · GROW')).toBe(true);
    expect(html).toContain('letter-spacing:0.12em');
    expect(html).toContain('text-transform:uppercase');
    expect(html).toContain(PALETTE.primary);
  });

  it('renders three-line headline with line breaks and accent highlight on third line', () => {
    const { hasText, html } = render(<LoginShowcasePanel />);

    expect(hasText('Your pages,')).toBe(true);
    expect(hasText('posting themselves —')).toBe(true);
    expect(hasText('100% on the cloud.')).toBe(true);
    // Assert line break presence
    expect(html).toContain('Your pages,<br/>posting themselves —<br/>');
    expect(html).toContain(`color:${PALETTE.primary}`);
  });

  it('renders exact subtext with constrained max-width', () => {
    const { hasText, html } = render(<LoginShowcasePanel />);

    expect(
      hasText(
        'Schedule reels and posts across Facebook, Instagram, TikTok, YouTube, Threads, and X — they go live while you sleep, even when your laptop is closed.'
      )
    ).toBe(true);
    expect(html).toContain('max-width:420px');
  });

  it('renders all three feature list rows with hairline dividers and accent line icons', () => {
    const { hasText, html } = render(<LoginShowcasePanel />);

    // Row 1
    expect(hasText('Post from anywhere')).toBe(true);
    expect(
      hasText('Schedule from your phone or laptop — your posts publish from the cloud.')
    ).toBe(true);

    // Row 2
    expect(hasText('Every platform, one dashboard')).toBe(true);
    expect(
      hasText('Connect each account once, then run everything from a single place.')
    ).toBe(true);

    // Row 3
    expect(hasText('Your accounts stay yours')).toBe(true);
    expect(
      hasText(
        'You sign in through each platform directly — your passwords never leave them.'
      )
    ).toBe(true);

    // SVG line icons with accent stroke and no fill
    expect(html).toContain(`stroke="${PALETTE.primary}"`);
    expect(html).toContain('fill="none"');

    // Hairline divider
    expect(html).toContain('border-bottom:1px solid var(--border-subtle, #1f242d)');
  });

  it('renders platform line and trust footer with zero forbidden links or emojis', () => {
    const { hasText, html } = render(<LoginShowcasePanel />);

    expect(
      hasText('Facebook · Instagram · TikTok · YouTube · Threads · X')
    ).toBe(true);
    expect(
      hasText('Official platform logins · Encrypted end-to-end')
    ).toBe(true);

    // Strictly forbidden elements
    expect(hasText('See how it works')).toBe(false);
    expect(html).not.toContain('See how it works');
    // Ensure zero emoji unicode characters
    expect(/[\u{1F300}-\u{1F9FF}]/u.test(html)).toBe(false);
  });

  it('renders inside LoginPage with updated card subtext and showcase panel', () => {
    const { hasText, html } = render(<LoginPage />);

    // Left card subtext
    expect(
      hasText(
        'Welcome back! Sign in to keep your content flowing across every platform.'
      )
    ).toBe(true);

    // Right showcase panel within login page
    expect(hasText('CREATE · SCHEDULE · GROW')).toBe(true);
    expect(hasText('Your pages,')).toBe(true);
    expect(hasText('posting themselves —')).toBe(true);
    expect(hasText('100% on the cloud.')).toBe(true);
    expect(hasText('Post from anywhere')).toBe(true);
    expect(hasText('Every platform, one dashboard')).toBe(true);
    expect(hasText('Your accounts stay yours')).toBe(true);

    // Responsive styles check: showcase stacks above form on narrow screens
    expect(html).toContain('order: 1 !important');
    expect(html).toContain('order: 2 !important');
  });
});
