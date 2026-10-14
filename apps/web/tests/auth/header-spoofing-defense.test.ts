import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { signSessionToken } from '@fbuploadpro/contracts';
import { getServerSessionContext } from '../../src/lib/auth';
import { middleware } from '../../src/middleware';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Header Spoofing Defense (Audit Issue 01)', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = 'localhost:3000';
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  describe('getServerSessionContext', () => {
    it('cryptographically verifies cookie as primary source of truth, ignoring spoofed headers', async () => {
      const genuineToken = await signSessionToken(
        {
          userId: '11111111-1111-4111-a111-111111111111',
          email: 'genuine@example.com',
          name: 'Genuine User',
          subdomain: 'genuine-sub',
          role: 'user',
          status: 'active',
        },
        TEST_SECRET
      );

      vi.mocked(cookies).mockResolvedValue({
        get: (name: string) => (name === 'fbup_session' ? { name, value: genuineToken } : undefined),
      } as any);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          'x-user-id': 'spoofed-admin-id',
          'x-user-role': 'admin',
          'x-user-email': 'admin@spoofed.com',
          'x-user-subdomain': 'admin-sub',
        })
      );

      const session = await getServerSessionContext();
      expect(session).not.toBeNull();
      expect(session?.userId).toBe('11111111-1111-4111-a111-111111111111');
      expect(session?.role).toBe('user');
      expect(session?.email).toBe('genuine@example.com');
      expect(session?.subdomain).toBe('genuine-sub');
    });

    it('returns null when cookie token is invalid without falling back to headers', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: (name: string) => (name === 'fbup_session' ? { name, value: 'invalid.jwt.token' } : undefined),
      } as any);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          'x-user-id': 'attacker-id',
          'x-user-role': 'admin',
          'x-user-email': 'attacker@example.com',
          'x-user-subdomain': 'attacker',
        })
      );

      const session = await getServerSessionContext();
      expect(session).toBeNull();
    });

    it('returns null when no cookie is present, rejecting header spoofing even in test environment', async () => {
      vi.mocked(cookies).mockResolvedValue({
        get: () => undefined,
      } as any);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          'x-user-id': 'test-user-id',
          'x-user-role': 'admin',
          'x-user-email': 'test@example.com',
          'x-user-subdomain': 'test-sub',
        })
      );

      const session = await getServerSessionContext();
      expect(session).toBeNull();
    });

    it('rejects header fallback completely in production environment', async () => {
      (process.env as any).NODE_ENV = 'production';

      vi.mocked(cookies).mockResolvedValue({
        get: () => undefined,
      } as any);

      vi.mocked(headers).mockResolvedValue(
        new Headers({
          'x-user-id': 'attacker-id',
          'x-user-role': 'admin',
          'x-user-email': 'attacker@example.com',
          'x-user-subdomain': 'attacker',
        })
      );

      const session = await getServerSessionContext();
      expect(session).toBeNull();
    });
  });

  describe('middleware pass-through header stripping', () => {
    it('strips incoming client-supplied x-user-* headers on /api/* routes', async () => {
      const req = new NextRequest('http://localhost:3000/api/some-endpoint', {
        headers: {
          host: 'localhost:3000',
          'x-user-id': 'spoofed-id',
          'x-user-role': 'admin',
          'x-user-email': 'spoof@test.com',
          'x-user-subdomain': 'spoof-sub',
          'x-custom-header': 'keep-me',
        },
      });

      const res = await middleware(req);
      // Next.js middleware passes overridden headers via x-middleware-request- headers or overrides
      const overrideHeaders = res.headers.get('x-middleware-override-headers') || '';
      const customHeaderForwarded = res.headers.get('x-middleware-request-x-custom-header');
      const userIdForwarded = res.headers.get('x-middleware-request-x-user-id');
      const roleForwarded = res.headers.get('x-middleware-request-x-user-role');

      expect(customHeaderForwarded).toBe('keep-me');
      expect(userIdForwarded).toBeNull();
      expect(roleForwarded).toBeNull();
      expect(overrideHeaders).not.toContain('x-user-id');
      expect(overrideHeaders).not.toContain('x-user-role');
    });

    it('strips incoming client-supplied x-user-* headers on pass-through root routes', async () => {
      const req = new NextRequest('http://localhost:3000/login', {
        headers: {
          host: 'localhost:3000',
          'x-user-id': 'spoofed-id',
          'x-user-role': 'admin',
        },
      });

      const res = await middleware(req);
      expect(res.headers.get('x-middleware-request-x-user-id')).toBeNull();
      expect(res.headers.get('x-middleware-request-x-user-role')).toBeNull();
    });
  });
});
