import { describe, it, expect, vi } from 'vitest';
import { sanitizeAuthErrorMessage, formatAuthErrorResponse } from '../../src/lib/auth-errors';

describe('Auth Error Sanitization & Zero Leakage (T001, T002)', () => {
  describe('sanitizeAuthErrorMessage', () => {
    it('scrubs connection refused errors and returns safe fallback', () => {
      const leaked = 'connect ECONNREFUSED 127.0.0.1:5432';
      const clean = sanitizeAuthErrorMessage(leaked);
      expect(clean).toBe('Unable to complete your request at this moment. Please try again shortly.');
      expect(clean).not.toContain('ECONNREFUSED');
      expect(clean).not.toContain('127.0.0.1');
      expect(clean).not.toContain('5432');
    });

    it('scrubs raw SQL syntax and relation errors', () => {
      const leaked = 'relation "users" does not exist at character 15 in SELECT * FROM users';
      const clean = sanitizeAuthErrorMessage(leaked);
      expect(clean).toBe('Unable to complete your request at this moment. Please try again shortly.');
      expect(clean).not.toContain('SELECT');
      expect(clean).not.toContain('users');
    });

    it('scrubs socket timeout and stack trace dumps', () => {
      const leaked = 'Socket timed out after 5000ms at PgPool.connect';
      const clean = sanitizeAuthErrorMessage(leaked);
      expect(clean).toBe('Unable to complete your request at this moment. Please try again shortly.');
      expect(clean).not.toContain('socket');
      expect(clean).not.toContain('PgPool');
    });

    it('preserves clean, customer-safe error messages', () => {
      const safe = 'Please enter a valid email address.';
      expect(sanitizeAuthErrorMessage(safe)).toBe(safe);
    });

    it('uses custom fallback message if provided', () => {
      const leaked = 'connect ECONNREFUSED 127.0.0.1:5432';
      const clean = sanitizeAuthErrorMessage(leaked, 'Unable to sign in at this moment. Please try again shortly.');
      expect(clean).toBe('Unable to sign in at this moment. Please try again shortly.');
    });
  });

  describe('formatAuthErrorResponse', () => {
    it('returns 500 with sanitized message when given an ECONNREFUSED error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const dbError = new Error('connect ECONNREFUSED 127.0.0.1:5432');

      const response = formatAuthErrorResponse(dbError, {
        fallbackMessage: 'Unable to sign in at this moment. Please try again shortly.',
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Unable to sign in at this moment. Please try again shortly.');
      expect(data.error).not.toContain('ECONNREFUSED');
      expect(data.error).not.toContain('127.0.0.1');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('returns 401 with clean message for invalid credentials', async () => {
      const credError = new Error('Invalid email or password');
      const response = formatAuthErrorResponse(credError);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Invalid email or password');
    });

    it('returns 403 with redirectUrl for suspended accounts', async () => {
      const suspendedError = new Error('Account is suspended');
      (suspendedError as unknown as { code: string }).code = 'ACCOUNT_SUSPENDED';

      const response = formatAuthErrorResponse(suspendedError);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Account is suspended');
      expect(data.redirectUrl).toBe('/account-suspended');
    });

    it('returns 409 for already registered emails', async () => {
      const dupError = new Error('Email is already registered');
      const response = formatAuthErrorResponse(dupError);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('Email is already registered');
    });
  });
});
