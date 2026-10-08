/**
 * @file button.test.tsx
 * @description Unit and accessibility tests for Button component (T005 / US1).
 * Tests all variants, contrast compliance, sizes, loading aria-busy, disabled state, and icon slots.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { Button } from '@/components/ui';
import { PALETTE } from '@/lib/theme';
import { render } from './setup';

describe('Button Component (US1 / T005)', () => {
  describe('Variants & Theme Compliance', () => {
    it('renders primary variant with Gold background and Black text satisfying WCAG AAA contrast', () => {
      const { html, hasClass, hasStyle, hasText } = render(
        <Button variant="primary">Confirm Action</Button>
      );

      expect(hasText('Confirm Action')).toBe(true);
      expect(hasClass('fbu-btn-primary')).toBe(true);
      // Primary gold background #fad734 on pitch black text #000000 achieves 14.86:1 contrast (WCAG AAA >= 7:1)
      expect(hasStyle('background-color', PALETTE.primary)).toBe(true);
      expect(hasStyle('color', PALETTE.background)).toBe(true);
      expect(html).toContain('button');
    });

    it('renders secondary variant with 1px hairline border framing', () => {
      const { hasClass, hasStyle, hasText } = render(
        <Button variant="secondary">Cancel</Button>
      );

      expect(hasText('Cancel')).toBe(true);
      expect(hasClass('fbu-btn-secondary')).toBe(true);
      expect(hasStyle('background-color', 'transparent')).toBe(true);
      expect(hasStyle('border', '1px solid var(--border-subtle)')).toBe(true);
      expect(hasStyle('color', 'var(--text-main)')).toBe(true);
    });

    it('renders ghost variant with transparent background and transparent border', () => {
      const { hasClass, hasStyle, hasText } = render(
        <Button variant="ghost">Dismiss</Button>
      );

      expect(hasText('Dismiss')).toBe(true);
      expect(hasClass('fbu-btn-ghost')).toBe(true);
      expect(hasStyle('background-color', 'transparent')).toBe(true);
      expect(hasStyle('border', '1px solid transparent')).toBe(true);
    });

    it('renders danger variant with Rose accent background and white text', () => {
      const { hasClass, hasStyle, hasText } = render(
        <Button variant="danger">Delete Account</Button>
      );

      expect(hasText('Delete Account')).toBe(true);
      expect(hasClass('fbu-btn-danger')).toBe(true);
      expect(hasStyle('background-color', PALETTE.accent3)).toBe(true);
      expect(hasStyle('color', PALETTE.text)).toBe(true);
    });

    it('renders link variant with Accent1 highlight color and auto height', () => {
      const { hasClass, hasStyle, hasText } = render(
        <Button variant="link">Learn More</Button>
      );

      expect(hasText('Learn More')).toBe(true);
      expect(hasClass('fbu-btn-link')).toBe(true);
      expect(hasStyle('color', PALETTE.accent1)).toBe(true);
      expect(hasStyle('height', 'auto')).toBe(true);
      expect(hasStyle('background-color', 'transparent')).toBe(true);
    });

    it('defaults to primary variant when no variant prop is provided', () => {
      const { hasClass } = render(<Button>Default Button</Button>);
      expect(hasClass('fbu-btn-primary')).toBe(true);
    });
  });

  describe('Sizes', () => {
    it('renders sm size with 30px height and compact padding', () => {
      const { hasStyle } = render(<Button size="sm">Small</Button>);
      expect(hasStyle('height', '30px')).toBe(true);
      expect(hasStyle('font-size', '0.75rem')).toBe(true);
    });

    it('renders md size with 38px standard height (default)', () => {
      const { hasStyle } = render(<Button size="md">Medium</Button>);
      expect(hasStyle('height', '38px')).toBe(true);
      expect(hasStyle('font-size', '0.875rem')).toBe(true);
    });

    it('renders lg size with 44px touch-accessible height', () => {
      const { hasStyle } = render(<Button size="lg">Large</Button>);
      expect(hasStyle('height', '44px')).toBe(true);
      expect(hasStyle('font-size', '1rem')).toBe(true);
    });

    it('defaults to md size when no size prop is specified', () => {
      const { hasStyle } = render(<Button>Unspecified Size</Button>);
      expect(hasStyle('height', '38px')).toBe(true);
    });
  });

  describe('Loading State & Accessibility', () => {
    it('sets aria-busy="true" and disables the button when isLoading is true', () => {
      const { hasAria, hasAttribute, hasTag, hasStyle } = render(
        <Button isLoading>Processing</Button>
      );

      expect(hasAria('busy', 'true')).toBe(true);
      expect(hasAttribute('disabled')).toBe(true);
      expect(hasAria('disabled', 'true')).toBe(true);
      expect(hasTag('svg')).toBe(true);
      expect(hasStyle('cursor', 'not-allowed')).toBe(true);
    });

    it('renders SVG spinner with spin animation inside loading button', () => {
      const { html } = render(<Button isLoading>Submitting</Button>);
      expect(html).toContain('<svg');
      expect(html).toContain('animation:spin 0.75s linear infinite');
      expect(html).toContain('aria-hidden="true"');
    });

    it('hides left and right icons when isLoading is active to prevent layout crowding', () => {
      const { html } = render(
        <Button
          isLoading
          leftIcon={<span id="left-icon">L</span>}
          rightIcon={<span id="right-icon">R</span>}
        >
          Loading with Icons
        </Button>
      );

      expect(html).not.toContain('id="left-icon"');
      expect(html).not.toContain('id="right-icon"');
      expect(html).toContain('Loading with Icons');
    });

    it('does not set aria-busy when isLoading is false', () => {
      const { hasAria } = render(<Button isLoading={false}>Idle</Button>);
      expect(hasAria('busy')).toBe(false);
    });
  });

  describe('Disabled State', () => {
    it('applies disabled attribute, aria-disabled, not-allowed cursor, and reduced opacity', () => {
      const { hasAttribute, hasAria, hasStyle } = render(
        <Button disabled>Disabled Action</Button>
      );

      expect(hasAttribute('disabled')).toBe(true);
      expect(hasAria('disabled', 'true')).toBe(true);
      expect(hasStyle('cursor', 'not-allowed')).toBe(true);
      expect(hasStyle('opacity', '0.45')).toBe(true);
    });

    it('remains disabled when both disabled and isLoading are true', () => {
      const { hasAttribute, hasAria } = render(
        <Button disabled isLoading>Double Disabled</Button>
      );

      expect(hasAttribute('disabled')).toBe(true);
      expect(hasAria('busy', 'true')).toBe(true);
      expect(hasAria('disabled', 'true')).toBe(true);
    });
  });

  describe('Icon Slots', () => {
    it('renders left icon with aria-hidden slot', () => {
      const { html, hasText } = render(
        <Button leftIcon={<span id="arrow-left">←</span>}>Back</Button>
      );

      expect(hasText('Back')).toBe(true);
      expect(html).toContain('id="arrow-left"');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders right icon with aria-hidden slot', () => {
      const { html, hasText } = render(
        <Button rightIcon={<span id="arrow-right">→</span>}>Next</Button>
      );

      expect(hasText('Next')).toBe(true);
      expect(html).toContain('id="arrow-right"');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders both left and right icons concurrently in correct order', () => {
      const { html } = render(
        <Button
          leftIcon={<span id="check-icon">✓</span>}
          rightIcon={<span id="chev-icon">▾</span>}
        >
          Options
        </Button>
      );

      const leftPos = html.indexOf('id="check-icon"');
      const textPos = html.indexOf('Options');
      const rightPos = html.indexOf('id="chev-icon"');

      expect(leftPos).toBeGreaterThan(-1);
      expect(textPos).toBeGreaterThan(leftPos);
      expect(rightPos).toBeGreaterThan(textPos);
    });
  });

  describe('HTML Attributes & Styling Overrides', () => {
    it('supports button type override to submit', () => {
      const { getAttribute } = render(<Button type="submit">Submit Form</Button>);
      expect(getAttribute('type')).toBe('submit');
    });

    it('defaults type attribute to button to avoid accidental form submissions', () => {
      const { getAttribute } = render(<Button>Click</Button>);
      expect(getAttribute('type')).toBe('button');
    });

    it('appends custom className while preserving base class', () => {
      const { hasClass } = render(<Button className="custom-test-btn">Custom</Button>);
      expect(hasClass('fbu-btn')).toBe(true);
      expect(hasClass('custom-test-btn')).toBe(true);
    });

    it('includes focus ring style with var(--ring-focus)', () => {
      const { html } = render(<Button>Focus Target</Button>);
      expect(html).toContain('box-shadow: 0 0 0 3px var(--ring-focus) !important');
    });
  });
});
