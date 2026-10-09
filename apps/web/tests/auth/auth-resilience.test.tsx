import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginHandler } from '../../src/app/api/auth/login/route';
import { POST as signupHandler } from '../../src/app/api/auth/signup/route';
import { POST as forgotPasswordHandler } from '../../src/app/api/auth/forgot-password/route';
import { POST as resetPasswordHandler } from '../../src/app/api/auth/reset-password/route';
import { sanitizeAuthErrorMessage } from '../../src/lib/auth-errors';
import { render } from '../components/setup';
import { Alert } from '../../src/components/ui';

describe('Auth Security Leak Prevention & Fault-Tolerant Resilience (Spec 012 / T007)', () => {
  describe('Zero Technical Plumbing Leaks in API Routes', () => {
    it('masks ECONNREFUSED 127.0.0.1:5432 in /api/auth/login with a clean human message', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Request that triggers connection refusal or credentials test
      const req = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'operator@fbuploadpro.com',
          password: 'Password123!',
        }),
      });

      const res = await loginHandler(req);
      const data = await res.json();

      // Assert zero infrastructure terms are leaked
      expect(data.error).toBeDefined();
      expect(data.error).not.toContain('ECONNREFUSED');
      expect(data.error).not.toContain('127.0.0.1');
      expect(data.error).not.toContain('5432');
      expect(data.error).not.toContain('postgres');
      expect(data.error).not.toContain('socket');

      consoleSpy.mockRestore();
    });

    it('masks ECONNREFUSED in /api/auth/signup with zero leakage', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Jane Operator',
          phone: '+15551234567',
          email: 'newuser@fbuploadpro.com',
          password: 'Password123!',
        }),
      });

      const res = await signupHandler(req);
      const data = await res.json();

      expect(data.error || '').not.toContain('ECONNREFUSED');
      expect(data.error || '').not.toContain('127.0.0.1');
      expect(data.error || '').not.toContain('5432');
      expect(data.error || '').not.toContain('postgres');

      consoleSpy.mockRestore();
    });

    it('masks connection failure in /api/auth/forgot-password with zero leakage', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'forgot@fbuploadpro.com',
        }),
      });

      const res = await forgotPasswordHandler(req);
      const data = await res.json();

      expect(data.error || data.message || '').not.toContain('ECONNREFUSED');
      expect(data.error || data.message || '').not.toContain('127.0.0.1');
      expect(data.error || data.message || '').not.toContain('5432');

      consoleSpy.mockRestore();
    });

    it('masks connection failure in /api/auth/reset-password with zero leakage', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const req = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'new-valid-password-1234',
        }),
      });

      const res = await resetPasswordHandler(req);
      const data = await res.json();

      expect(data.error || data.message || '').not.toContain('ECONNREFUSED');
      expect(data.error || data.message || '').not.toContain('127.0.0.1');
      expect(data.error || data.message || '').not.toContain('5432');

      consoleSpy.mockRestore();
    });
  });

  describe('UI Component Level Defensive Scrubbing', () => {
    it('ensures Alert component renders clean copy when sanitized', () => {
      const leaked = 'connect ECONNREFUSED 127.0.0.1:5432';
      const cleanMessage = sanitizeAuthErrorMessage(leaked);

      const { hasText, html } = render(
        <Alert
          severity="error"
          title="Couldn't sign you in"
          message={cleanMessage}
        />
      );

      expect(html.toLowerCase()).toContain('sign you in');
      expect(hasText('Unable to complete your request at this moment. Please try again shortly.')).toBe(true);
      expect(html).not.toContain('ECONNREFUSED');
      expect(html).not.toContain('127.0.0.1');
      expect(html).not.toContain('5432');
    });
  });
});
