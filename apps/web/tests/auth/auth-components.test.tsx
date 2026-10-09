import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '../components/setup';
import { AuthSplitLayout } from '../../src/components/auth/auth-split-layout';
import { PasswordInput } from '../../src/components/auth/password-input';

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
      const { hasText, html } = render(
        <PasswordInput
          label="Password"
          error="Password too short"
          helperText="Must be 8+ characters"
        />
      );

      expect(hasText('Password too short')).toBe(true);
      expect(html).toContain('has-error');
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
      expect(hasText('Automate Facebook and Instagram')).toBe(true);
      expect(hasText('without ever giving away your credentials')).toBe(true);
      expect(hasText('Sign In')).toBe(true);
      expect(hasText('Enter your credentials.')).toBe(true);
      expect(hasText('Form Content')).toBe(true);
      expect(hasText('Footer Test')).toBe(true);
      expect(html).toContain('Zero Credential Sharing');
      expect(html).toContain('100% Cloud-Powered Automation');
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

    it('renders form panel on the left by default (Spec 022)', () => {
      const { html } = render(
        <AuthSplitLayout title="Sign In" description="Enter credentials">
          <div>Form Child</div>
        </AuthSplitLayout>
      );

      const formIndex = html.indexOf('class="auth-form-panel"');
      const showcaseIndex = html.indexOf('class="auth-showcase-panel auth-showcase-right"');

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

      const formIndex = html.indexOf('class="auth-form-panel"');
      const showcaseIndex = html.indexOf('class="auth-showcase-panel"');

      expect(formIndex).toBeGreaterThan(-1);
      expect(showcaseIndex).toBeGreaterThan(-1);
      expect(showcaseIndex).toBeLessThan(formIndex);
      expect(html).not.toContain('class="auth-showcase-panel auth-showcase-right"');
    });
  });
});
