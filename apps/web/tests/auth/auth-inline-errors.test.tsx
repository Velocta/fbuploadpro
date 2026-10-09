import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../components/setup';
import SignupPage from '../../src/app/signup/page';
import LoginPage from '../../src/app/login/page';
import ForgotPasswordPage from '../../src/app/forgot-password/page';
import ResetPasswordPage from '../../src/app/reset-password/page';
import { Input } from '../../src/components/ui';
import { PasswordInput } from '../../src/components/auth/password-input';
import { FormErrorCallout } from '../../src/components/auth/form-error-callout';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Auth Inline Error Highlighting & Edge Cases (Spec 016)', () => {
  describe('SignupPage Inline Validation & Edge Cases', () => {
    it('does not render PasswordStrengthMeter or strength bars anywhere in signup form', () => {
      const { html, hasText } = render(<SignupPage />);

      // PasswordStrengthMeter elements must be absent
      expect(hasText('Password strength:')).toBe(false);
      expect(hasText('Weak')).toBe(false);
      expect(hasText('Fair')).toBe(false);
      expect(hasText('Strong')).toBe(false);
      expect(hasText('At least one symbol')).toBe(false);
      expect(html).not.toContain('fbu-password-meter');
    });

    it('does not render top-level Alert error box on initial render', () => {
      const { html } = render(<SignupPage />);
      expect(html).not.toContain('fbu-alert-error');
      expect(html).not.toContain("Couldn't create account");
    });

    it('renders clean helper text without robotic jargon', () => {
      const { hasText } = render(<SignupPage />);
      expect(hasText('Include country code starting with + (e.g. +1... or +92...)')).toBe(true);
      expect(hasText('Only @gmail.com accounts are supported')).toBe(true);
      expect(hasText('Minimum 8 characters')).toBe(true);
    });
  });

  describe('FormErrorCallout Component', () => {
    it('returns null when message is null or empty', () => {
      const { html: htmlNull } = render(<FormErrorCallout message={null} />);
      expect(htmlNull).toBe('');

      const { html: htmlUndefined } = render(<FormErrorCallout message={undefined} />);
      expect(htmlUndefined).toBe('');
    });

    it('renders compact alert with theme styling when message is provided', () => {
      const { html, hasText } = render(
        <FormErrorCallout message="Invalid email or password. Please try again." />
      );

      expect(hasText('Invalid email or password. Please try again.')).toBe(true);
      expect(html).toContain('role="alert"');
      expect(html).toContain('fbu-form-error-callout');
      // Must use theme error accent (accent-3 / #F6465D)
      expect(html.toLowerCase()).toContain('#f6465d');
    });
  });

  describe('LoginPage Inline Validation', () => {
    it('does not render top-level Alert error box on initial render', () => {
      const { html } = render(<LoginPage />);
      expect(html).not.toContain('fbu-alert-error');
      expect(html).not.toContain("Couldn't sign you in");
    });
  });

  describe('ForgotPasswordPage Inline Validation', () => {
    it('does not render top-level Alert error box on initial render', () => {
      const { html } = render(<ForgotPasswordPage />);
      expect(html).not.toContain('fbu-alert-error');
      expect(html).not.toContain("Couldn't send recovery link");
    });
  });

  describe('Input and PasswordInput Error States', () => {
    it('Input renders aria-invalid, has-error class, and inline role="alert" message when error prop is provided', () => {
      const { html, hasText, hasAttribute } = render(
        <Input label="Phone Number" error="Please enter a complete, valid international phone number." />
      );

      expect(hasText('Phone Number')).toBe(true);
      expect(hasText('Please enter a complete, valid international phone number.')).toBe(true);
      expect(hasAttribute('aria-invalid', 'true')).toBe(true);
      expect(html).toContain('has-error');
      expect(html).toContain('role="alert"');
      expect(html.toLowerCase()).toContain('#f6465d');
    });

    it('PasswordInput renders aria-invalid, has-error class, and inline role="alert" message when error prop is provided', () => {
      const { html, hasText, hasAttribute } = render(
        <PasswordInput label="Confirm Password" error="Passwords do not match. Please verify both password fields." />
      );

      expect(hasText('Confirm Password')).toBe(true);
      expect(hasText('Passwords do not match. Please verify both password fields.')).toBe(true);
      expect(hasAttribute('aria-invalid', 'true')).toBe(true);
      expect(html).toContain('has-error');
      expect(html).toContain('role="alert"');
      expect(html.toLowerCase()).toContain('#f6465d');
    });
  });

  describe('ResetPasswordPage Inline Validation', () => {
    it('does not render top-level Alert error box on initial render', () => {
      const { html } = render(<ResetPasswordPage />);
      expect(html).not.toContain('fbu-alert-error');
      expect(html).not.toContain("Couldn't reset password");
    });
  });
});
