import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { render } from '../components/setup';
import ResetPasswordPage from '../../src/app/reset-password/page';
import { POST as resetPasswordHandler } from '../../src/app/api/auth/reset-password/route';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('Password Recovery - Reset Password (US2)', () => {
  describe('ResetPasswordPage UI', () => {
    it('renders password and confirm password inputs in AuthSplitLayout', () => {
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
        body: JSON.stringify({ password: 'short' }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toContain('8 characters');
    });

    it('returns 200 when valid password of 8+ characters is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'super-secure-password-123',
          email: 'test@example.com',
        }),
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('successfully updated');
    });
  });
});
