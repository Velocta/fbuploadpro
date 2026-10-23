import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '../components/setup';
import { AuthSplitLayout } from '../../src/components/auth/auth-split-layout';
import { PasswordInput } from '../../src/components/auth/password-input';
import { PALETTE } from '../../src/lib/theme';

describe('Auth Redesign Components (Spec 010)', () => {
  describe('PasswordInput', () => {
    it('renders with masked password type and show/hide toggle button', () => {
      const { hasAttribute, html } = render(
        <PasswordInput label="Test Password" placeholder="Enter password" />
      );

      expect(hasAttribute('type', 'password')).toBe(true);
      expect(html).toContain('aria-label="Show password"');
      expect(html).toContain('Test Password');
    });

    it('renders error state and helper text correctly', () => {
      // Spec 136 PR-136B: the rebuilt control carries its error state via
      // aria-invalid + an inline role="alert" message on tokens — the
      // legacy `has-error` class is gone with the legacy Input.
      const { hasText, hasAttribute, html } = render(
        <PasswordInput
          label="Password"
          error="Password too short"
          helperText="Must be 8+ characters"
        />
      );

      expect(hasText('Password too short')).toBe(true);
      expect(hasText('Must be 8+ characters')).toBe(true);
      expect(hasAttribute('aria-invalid', 'true')).toBe(true);
      expect(html).toContain('role="alert"');
    });
  });

  describe('AuthSplitLayout', () => {
    it('renders brand showcase and form panel with title, description, and user-mandated copy', () => {
      const { hasText, html } = render(
        <AuthSplitLayout
          title="Sign In"
          description="Enter your credentials."
          footer={<span>Footer Test</span>}
        >
          <div data-testid="form-child">Form Content</div>
        </AuthSplitLayout>
      );

      expect(hasText('FBUploadPro')).toBe(true);
      expect(hasText('CREATE · SCHEDULE · GROW')).toBe(true);
      expect(hasText('100% on the cloud.')).toBe(true);
      expect(hasText('Sign In')).toBe(true);
      expect(hasText('Enter your credentials.')).toBe(true);
      expect(hasText('Form Content')).toBe(true);
      expect(hasText('Footer Test')).toBe(true);
      expect(html).toContain('Post from anywhere');
      expect(html).toContain('Every platform, one dashboard');
      expect(html).toContain('Your accounts stay yours');
      expect(html).toContain(PALETTE.primary);
      expect(html).toContain('fill-opacity="0.35"');
    });

    it('contains no technical plumbing jargon or fake status badges', () => {
      const { hasText } = render(
        <AuthSplitLayout title="Test" description="Test desc">
          <div>Child</div>
        </AuthSplitLayout>
      );

      // Asserts that technical jargon has been purged per user request
      expect(hasText('Multi-tenant data isolation')).toBe(false);
      expect(hasText('Cloud-Native Publishing Engine')).toBe(false);
      expect(hasText('Direct R2 Storage Ingestion')).toBe(false);
      expect(hasText('Native Graph API v26.0 Delivery')).toBe(false);

      // Asserts that fake status badges are absent
      expect(hasText('Online')).toBe(false);
      expect(hasText('Ready')).toBe(false);
      expect(hasText('Operational Status')).toBe(false);
    });

    // Spec 136 PR-136A: the layout was rebuilt on token utilities and
    // its legacy class hooks were deleted with the old implementation,
    // so panel order is asserted on the semantic elements (the form
    // panel is the <main>, the showcase is the <section>) instead of
    // class names. The expectations are unchanged.
    it('renders form panel on the left by default (Spec 022)', () => {
      const { html } = render(
        <AuthSplitLayout title="Sign In" description="Enter credentials">
          <div>Form Child</div>
        </AuthSplitLayout>
      );

      const formIndex = html.indexOf('<main');
      const showcaseIndex = html.indexOf('<section');

      expect(formIndex).toBeGreaterThan(-1);
      expect(showcaseIndex).toBeGreaterThan(-1);
      expect(formIndex).toBeLessThan(showcaseIndex);
    });

    it('renders showcase on the left when formPosition="right" is explicitly configured', () => {
      const { html } = render(
        <AuthSplitLayout
          title="Sign In"
          description="Enter credentials"
          formPosition="right"
        >
          <div>Form Child</div>
        </AuthSplitLayout>
      );

      const formIndex = html.indexOf('<main');
      const showcaseIndex = html.indexOf('<section');

      expect(formIndex).toBeGreaterThan(-1);
      expect(showcaseIndex).toBeGreaterThan(-1);
      expect(showcaseIndex).toBeLessThan(formIndex);
    });
  });
});
