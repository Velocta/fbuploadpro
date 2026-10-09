import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from './setup';
import SignupPage from '../../src/app/signup/page';
import LoginPage from '../../src/app/login/page';
import { PALETTE } from '@/lib/theme';

describe('Auth Pages UI (Spec 009 & Spec 010)', () => {
  describe('SignupPage', () => {
    it('renders all required registration inputs without subdomain preview', () => {
      const { hasText, hasAttribute, html } = render(<SignupPage />);

      expect(hasText('Create Account')).toBe(true);
      expect(hasText('Full Name')).toBe(true);
      expect(hasText('Phone Number')).toBe(true);
      expect(hasText('Email Address')).toBe(true);
      expect(hasText('Password')).toBe(true);
      // Per Spec 010 user directive, subdomain preview is removed
      expect(hasText('Workspace URL:')).toBe(false);
      expect(hasText('Create Workspace')).toBe(true);

      expect(hasAttribute('type', 'email')).toBe(true);
      expect(hasAttribute('type', 'tel')).toBe(true);
      expect(hasAttribute('type', 'password')).toBe(true);
      expect(html).toContain('href="/login"');
    });

    it('applies primary brand styling to submit action button', () => {
      const { html } = render(<SignupPage />);
      expect(html).toContain(`background-color:${PALETTE.primary}`);
    });

    it('does not contain robotic developer slop or decorative operational status dots', () => {
      const { hasText, html } = render(<SignupPage />);
      expect(html).not.toContain('Dots and plus tags');
      expect(html).not.toContain('Deploy your automated');
      expect(hasText('Ready')).toBe(false);
    });
  });

  describe('LoginPage', () => {
    it('renders credentials inputs and sign-in button', () => {
      const { hasText, hasAttribute, html } = render(<LoginPage />);

      expect(hasText('Sign In')).toBe(true);
      expect(hasText('Email Address')).toBe(true);
      expect(hasText('Password')).toBe(true);
      expect(hasAttribute('type', 'email')).toBe(true);
      expect(hasAttribute('type', 'password')).toBe(true);
      expect(html).toContain('href="/signup"');
    });

    it('applies primary brand styling to submit action button', () => {
      const { html } = render(<LoginPage />);
      expect(html).toContain(`background-color:${PALETTE.primary}`);
    });

    it('does not contain robotic developer slop or decorative operational status dots', () => {
      const { hasText, html } = render(<LoginPage />);
      expect(html).not.toContain('isolated workspace');
      expect(html).not.toContain('Gateway');
      expect(hasText('Online')).toBe(false);
    });
  });
});
