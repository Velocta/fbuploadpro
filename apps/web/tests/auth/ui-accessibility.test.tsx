import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '../components/setup';
import LoginPage from '../../src/app/login/page';
import SignupPage from '../../src/app/signup/page';
import ForgotPasswordPage from '../../src/app/forgot-password/page';
import ResetPasswordPage from '../../src/app/reset-password/page';
import { Input } from '../../src/components/ui/input';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('WCAG 2.2 AA Accessibility & Usability (AUTH-08 to AUTH-15 / Spec 017 US5)', () => {
  describe('LoginPage Accessibility (AUTH-08, AUTH-09)', () => {
    it('associates Password label with password input using htmlFor and id', () => {
      const { html, hasAttribute } = render(<LoginPage />);
      expect(html).toContain('for="login-password"');
      expect(html).toContain('id="login-password"');
      expect(hasAttribute('autoComplete', 'current-password')).toBe(true);
    });

    it('displays proactive helper text indicating supported Gmail accounts', () => {
      const { hasText } = render(<LoginPage />);
      expect(hasText('Only @gmail.com accounts are supported')).toBe(true);
    });
  });

  describe('SignupPage Accessibility & Form Preservation (AUTH-10, AUTH-11)', () => {
    it('renders Terms and Privacy links opening in new tab with noopener noreferrer', () => {
      const { html } = render(<SignupPage />);
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener noreferrer"');
    });

    it('contains no generic or broken links', () => {
      const { html } = render(<SignupPage />);
      expect(html).not.toContain('href="#"');
    });
  });

  describe('ForgotPasswordPage Accessibility (AUTH-12, AUTH-13)', () => {
    it('provides autoComplete="email" on email input for autofill assist', () => {
      const { hasAttribute } = render(<ForgotPasswordPage />);
      expect(hasAttribute('autoComplete', 'email')).toBe(true);
    });

    it('provides accessible helper text describing recovery dispatch', () => {
      const { hasText } = render(<ForgotPasswordPage />);
      expect(hasText('We will send a 6-digit verification code to your registered Gmail address.')).toBe(true);
    });
  });

  describe('ResetPasswordPage Accessibility (AUTH-14)', () => {
    it('provides accessible redirection guidance to unified recovery flow', () => {
      const { html, hasText } = render(<ResetPasswordPage />);
      expect(hasText('Redirecting to Password Recovery')).toBe(true);
      expect(html).toContain('href="/forgot-password"');
    });
  });

  describe('Password Toggle Focus Styling (AUTH-15)', () => {
    it('renders toggle button with fbu-password-toggle class and focus-visible styling', () => {
      const { html, hasClass } = render(<Input isPassword={true} label="Secret" />);
      expect(hasClass('fbu-password-toggle')).toBe(true);
      expect(html).toContain('.fbu-password-toggle:focus-visible');
    });
  });
});
