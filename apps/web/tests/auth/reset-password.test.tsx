import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { render } from '../components/setup';
import ResetPasswordPage from '../../src/app/reset-password/page';
import { POST as resetPasswordHandler } from '../../src/app/api/auth/reset-password/route';
import {
  _setResetTokenForTesting,
  _resetAuthStores,
} from '../../src/lib/supabase-auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Password Recovery - Reset Password (US2)', () => {
  const originalWindow = (global as unknown as { window?: unknown }).window;

  beforeEach(() => {
    _resetAuthStores();
  });

  afterEach(() => {
    if (originalWindow !== undefined) {
      (global as unknown as { window: unknown }).window = originalWindow;
    } else {
      delete (global as unknown as { window?: unknown }).window;
    }
  });

  describe('ResetPasswordPage UI Guard & States', () => {
    it('renders "Recovery Link Required" alert when token parameter is missing', () => {
      (global as unknown as { window: unknown }).window = {
        location: {
          search: '',
          hash: '',
        },
      };

      const { hasText, html } = render(<ResetPasswordPage />);

      expect(hasText('Recovery Link Required')).toBe(true);
      expect(hasText('Password reset requires a valid recovery link')).toBe(true);
      expect(html).toContain('href="/forgot-password"');
    });

    it('renders password and confirm password inputs when valid token query parameter is present', () => {
      (global as unknown as { window: unknown }).window = {
        location: {
          search: '?token=test-recovery-token-xyz',
          hash: '',
        },
      };

      const { hasText, hasAttribute, html } = render(<ResetPasswordPage />);

      expect(hasText('Set New Password')).toBe(true);
      expect(hasText('New Password')).toBe(true);
      expect(hasText('Confirm New Password')).toBe(true);
      expect(hasText('Update Password')).toBe(true);
      expect(hasAttribute('type', 'password')).toBe(true);
      expect(html).toContain('href="/login"');
    });

    it('contains no robotic developer slop or decorative status dots', () => {
      const { hasText } = render(<ResetPasswordPage />);
      expect(hasText('Online')).toBe(false);
      expect(hasText('Ready')).toBe(false);
      expect(hasText('Operational')).toBe(false);
    });
  });

  describe('API Route POST /api/auth/reset-password', () => {
    it('returns 400 when password is under 8 characters', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'some-token',
          password: 'short',
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('8 characters');
    });

    it('returns 400 when token is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'super-secure-password-123',
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('recovery link or token is required');
    });

    it('returns 200 when valid token and password are provided', async () => {
      const token = 'valid-token-abc-123';
      _setResetTokenForTesting(token, {
        email: 'user@gmail.com',
        expiresAt: Date.now() + 3600000,
      });

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.1',
        },
        body: JSON.stringify({
          token,
          password: 'super-secure-password-123',
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('successfully updated');
    });

    it('rejects reused reset tokens (single-use token enforcement)', async () => {
      const token = 'single-use-token-456';
      _setResetTokenForTesting(token, {
        email: 'user@gmail.com',
        expiresAt: Date.now() + 3600000,
      });

      // First use succeeds
      const req1 = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.2',
        },
        body: JSON.stringify({
          token,
          password: 'super-secure-password-123',
        }),
      });

      const res1 = await resetPasswordHandler(req1);
      expect(res1.status).toBe(200);

      // Second use with identical token must fail
      const req2 = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.2',
        },
        body: JSON.stringify({
          token,
          password: 'another-secure-password-456',
        }),
      });

      const res2 = await resetPasswordHandler(req2);
      expect(res2.status).toBe(400);
      const body2 = await res2.json();
      expect(body2.error).toContain('Invalid or expired');
    });

    it('enforces IP rate limiting after 5 attempts per minute', async () => {
      const clientIp = '203.0.113.99';

      for (let i = 0; i < 5; i++) {
        const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': clientIp,
          },
          body: JSON.stringify({
            token: `token-${i}`,
            password: 'super-secure-password-123',
          }),
        });
        await resetPasswordHandler(req);
      }

      // 6th attempt should trigger 429
      const req6 = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': clientIp,
        },
        body: JSON.stringify({
          token: 'token-6',
          password: 'super-secure-password-123',
        }),
      });

      const res6 = await resetPasswordHandler(req6);
      expect(res6.status).toBe(429);
      const body6 = await res6.json();
      expect(body6.error).toContain('Too many password reset attempts');
    });
  });
});
