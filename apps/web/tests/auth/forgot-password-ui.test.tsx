import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { render } from '../components/setup';
import ForgotPasswordPage from '../../src/app/forgot-password/page';
import { POST as resendHandler } from '../../src/app/api/auth/forgot-password/resend/route';
import {
  createPasswordResetOtp,
  _resetOtpStore,
} from '../../src/lib/otp-service';
import { _resetRateLimiter } from '../../src/lib/rate-limiter';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe('Forgot Password Two-Step Flow & Resend (Spec 018 US3)', () => {
  beforeEach(() => {
    _resetOtpStore();
    _resetRateLimiter();
  });

  describe('Step 1 UI Elements', () => {
    it('renders email input, helper text, and Send Verification Code action', () => {
      const { hasText, hasAttribute, html } = render(<ForgotPasswordPage />);

      expect(hasText('Reset Password')).toBe(true);
      expect(hasText('Email Address')).toBe(true);
      expect(hasText('We will send a 6-digit verification code')).toBe(true);
      expect(hasText('Send Verification Code')).toBe(true);
      expect(hasAttribute('type', 'email')).toBe(true);
      expect(html).toContain('href="/login"');
    });

    it('contains no robotic developer slop or decorative status dots', () => {
      const { hasText } = render(<ForgotPasswordPage />);
      expect(hasText('Online')).toBe(false);
      expect(hasText('Ready')).toBe(false);
      expect(hasText('Operational')).toBe(false);
      expect(hasText('Database')).toBe(false);
    });
  });

  describe('API Route POST /api/auth/forgot-password/resend', () => {
    it('returns 400 when email is missing or non-Gmail', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad@yahoo.com' }),
      });

      const res = await resendHandler(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Only @gmail.com');
    });

    it('enforces 60-second cooldown on resend attempts', async () => {
      const email = 'cooldown.user@gmail.com';
      createPasswordResetOtp(email);

      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const res = await resendHandler(req);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toContain('Please wait');
      expect(body.cooldownSecondsRemaining).toBeGreaterThan(0);
    });
  });
});
