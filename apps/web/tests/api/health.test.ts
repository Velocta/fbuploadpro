import { describe, expect, it, vi } from 'vitest';
import { probeHealth } from '../../src/app/api/health/route.js';
import { GET as liveGET } from '../../src/app/api/live/route.js';
import type { DatabaseClient } from '@fbuploadpro/contracts';

const VALID_TOKEN_KEY =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

const healthyDeps = {
  checkAuth: async () => true,
  checkConfig: () => true,
};

function healthyDb(): Partial<DatabaseClient> {
  return { query: vi.fn().mockResolvedValue([{ '?column?': 1 }]) };
}

describe('Web Application Health Probe (/api/health)', () => {
  it('returns 200 OK when database, auth, and config checks all pass', async () => {
    const res = await probeHealth(healthyDb() as DatabaseClient, 2000, healthyDeps);
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('ok');
    expect(res.payload.checks).toEqual({ database: true, auth: true, config: true });
    expect(new Date(res.payload.timestamp).getTime()).not.toBeNaN();
  });

  it('public payload contains enums/booleans only (snapshot-asserted shape)', async () => {
    const res = await probeHealth(healthyDb() as DatabaseClient, 2000, healthyDeps);
    expect(Object.keys(res.payload).sort()).toEqual(['checks', 'status', 'timestamp']);
    expect(Object.keys(res.payload.checks).sort()).toEqual(['auth', 'config', 'database']);
    for (const value of Object.values(res.payload.checks)) {
      expect(typeof value).toBe('boolean');
    }
    expect(['ok', 'degraded', 'unhealthy']).toContain(res.payload.status);
  });

  it('returns 503 and sanitizes credentials when database fails', async () => {
    const sensitiveError = new Error(
      'connection error to postgres://superadmin:supersecretpassword@10.0.0.1:5432/fbuploadpro'
    );
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockRejectedValue(sensitiveError),
    };

    const res = await probeHealth(mockDb as DatabaseClient, 2000, healthyDeps);
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.checks.database).toBe(false);

    const jsonString = JSON.stringify(res.payload);
    expect(jsonString).not.toContain('supersecretpassword');
    expect(jsonString).not.toContain('superadmin');
    expect(jsonString).not.toContain('10.0.0.1');
    expect(jsonString).not.toContain('postgres://');
    expect(jsonString).not.toContain('stack');
  });

  it('returns 503 when probe exceeds timeout budget', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
    };

    const res = await probeHealth(mockDb as DatabaseClient, 50, healthyDeps);
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.checks.database).toBe(false);
  });

  it('returns 503 when the Auth probe fails', async () => {
    const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
      checkAuth: async () => false,
      checkConfig: () => true,
    });
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.checks).toEqual({ database: true, auth: false, config: true });
  });

  it('returns 503 when the config check fails', async () => {
    const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
      checkAuth: async () => true,
      checkConfig: () => false,
    });
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.checks).toEqual({ database: true, auth: true, config: false });
  });

  describe('real config + auth checks (env-injected)', () => {
    const baseEnv: Record<string, string | undefined> = {
      NODE_ENV: 'production',
      SESSION_SECRET: 'session-secret-value-that-is-long-enough-123456',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-value',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
      R2_ACCOUNT_ID: 'r2-account',
      R2_ACCESS_KEY_ID: 'r2-access',
      R2_SECRET_ACCESS_KEY: 'r2-secret',
      R2_BUCKET_NAME: 'media-bucket',
      R2_PUBLIC_URL: 'https://cdn.example.com',
    };

    it('probes the Supabase Auth health endpoint with the anon key', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true });
      const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
        env: { ...baseEnv, TOKEN_ENCRYPTION_KEY: VALID_TOKEN_KEY },
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      expect(res.statusCode).toBe(200);
      expect(res.payload.checks).toEqual({ database: true, auth: true, config: true });
      expect(fetchFn).toHaveBeenCalledTimes(1);
      const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://example.supabase.co/auth/v1/health');
      expect((init.headers as Record<string, string>).apikey).toBe('anon-key-value');
      // No env value or host leaks into the public payload beyond the shape.
      const jsonString = JSON.stringify(res.payload);
      expect(jsonString).not.toContain('anon-key-value');
      expect(jsonString).not.toContain(VALID_TOKEN_KEY);
      expect(jsonString).not.toContain('example.supabase.co');
    });

    it('flips to unhealthy when TOKEN_ENCRYPTION_KEY is removed', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true });
      const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
        env: { ...baseEnv },
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      expect(res.statusCode).toBe(503);
      expect(res.payload.status).toBe('unhealthy');
      expect(res.payload.checks.config).toBe(false);
      expect(res.payload.checks.database).toBe(true);
      expect(res.payload.checks.auth).toBe(true);
    });

    it('flips to unhealthy when TOKEN_ENCRYPTION_KEY is malformed', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true });
      const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
        env: { ...baseEnv, TOKEN_ENCRYPTION_KEY: 'too-short' },
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      expect(res.statusCode).toBe(503);
      expect(res.payload.checks.config).toBe(false);
    });

    it('flips to unhealthy when the Auth endpoint is unreachable', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 502 });
      const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
        env: { ...baseEnv, TOKEN_ENCRYPTION_KEY: VALID_TOKEN_KEY },
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      expect(res.statusCode).toBe(503);
      expect(res.payload.checks.auth).toBe(false);
      expect(res.payload.checks.config).toBe(true);
    });

    it('flips to unhealthy when SESSION_SECRET is invalid', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true });
      const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
        env: { ...baseEnv, SESSION_SECRET: 'short', TOKEN_ENCRYPTION_KEY: VALID_TOKEN_KEY },
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      expect(res.statusCode).toBe(503);
      expect(res.payload.checks.config).toBe(false);
    });

    it('flips to unhealthy when R2 is not configured', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true });
      const env: Record<string, string | undefined> = {
        ...baseEnv,
        TOKEN_ENCRYPTION_KEY: VALID_TOKEN_KEY,
      };
      delete env.R2_BUCKET_NAME;
      const res = await probeHealth(healthyDb() as DatabaseClient, 2000, {
        env,
        fetchFn: fetchFn as unknown as typeof fetch,
      });
      expect(res.statusCode).toBe(503);
      expect(res.payload.checks.config).toBe(false);
    });
  });
});

describe('Web Application Liveness Probe (/api/live)', () => {
  it('returns static ok with no dependencies', async () => {
    const res = liveGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
