import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from './setup';
import SignupPage from '../../src/app/signup/page';
import LoginPage from '../../src/app/login/page';
import { PALETTE } from '@/lib/theme';

describe('Auth Pages UI (Spec 009)', () => {
  describe('SignupPage', () => {
    it('renders all required registration inputs with labels and helper text', () => {
      const { hasText, hasAttribute, html } = render(<SignupPage />);

      expect(hasText('Create Account')).toBe(true);
      expect(hasText('Full Name')).toBe(true);
      expect(hasText('Phone Number')).toBe(true);
      expect(hasText('Email Address')).toBe(true);
      expect(hasText('Password')).toBe(true);
      expect(hasText('Workspace URL:')).toBe(true);
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
  });
});
