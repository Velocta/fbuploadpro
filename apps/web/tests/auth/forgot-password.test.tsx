import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { render } from '../components/setup';
import ForgotPasswordPage from '../../src/app/forgot-password/page';
import LoginPage from '../../src/app/login/page';
import { POST as forgotPasswordHandler } from '../../src/app/api/auth/forgot-password/route';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('Password Recovery - Forgot Password (US1)', () => {
  describe('LoginPage Integration', () => {
    it('renders a Forgot password link directing to /forgot-password', () => {
      const { hasText, html } = render(<LoginPage />);

      expect(hasText('Forgot password?')).toBe(true);
      expect(html).toContain('href="/forgot-password"');
    });
  });

  describe('ForgotPasswordPage UI', () => {
    it('renders email input and submit button in AuthSplitLayout', () => {
      const { hasText, hasAttribute, html } = render(<ForgotPasswordPage />);

      expect(hasText('Reset Password')).toBe(true);
      expect(hasText('Email Address')).toBe(true);
      expect(hasText('Send Verification Code')).toBe(true);
      expect(hasAttribute('type', 'email')).toBe(true);
      expect(html).toContain('href="/login"');
    });

    it('contains no robotic developer slop or decorative status dots', () => {
      const { hasText } = render(<ForgotPasswordPage />);
      expect(hasText('Online')).toBe(false);
      expect(hasText('Ready')).toBe(false);
      expect(hasText('Database')).toBe(false);
    });
  });

  describe('API Route POST /api/auth/forgot-password', () => {
    it('returns 400 when email is missing or invalid', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('valid email address');
    });

    it('returns 400 when email is not a Gmail domain', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'operator@example.com' }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('Only @gmail.com');
    });

    it('returns 200 with confirmation message for valid email format', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'operator@gmail.com' }),
      });

      const res = await forgotPasswordHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.requiresOtp).toBe(true);
      expect(body.message).toBeDefined();
    });
  });
});
