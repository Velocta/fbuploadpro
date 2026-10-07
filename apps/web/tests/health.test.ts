import { describe, expect, it, vi } from 'vitest';
import { probeHealth } from '../src/app/api/health/route.js';
import type { DatabaseClient } from '@fbuploadpro/database';

describe('Web Application Health Probe (/api/health)', () => {
  it('returns 200 OK with connected database status on healthy probe', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const res = await probeHealth(mockDb as DatabaseClient);
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('ok');
    expect(res.payload.database).toBe('connected');
    expect(new Date(res.payload.timestamp).getTime()).not.toBeNaN();
  });

  it('returns 503 degraded status and sanitizes credentials when database fails', async () => {
    const sensitiveError = new Error(
      'connection error to postgres://superadmin:supersecretpassword@10.0.0.1:5432/fbuploadpro'
    );
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockRejectedValue(sensitiveError),
    };

    const res = await probeHealth(mockDb as DatabaseClient);
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.database).toBe('disconnected');

    const jsonString = JSON.stringify(res.payload);
    expect(jsonString).not.toContain('supersecretpassword');
    expect(jsonString).not.toContain('superadmin');
    expect(jsonString).not.toContain('10.0.0.1');
    expect(jsonString).not.toContain('postgres://');
    expect(jsonString).not.toContain('stack');
  });

  it('returns 503 degraded status when probe exceeds timeout budget', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 500))
      ),
    };

    // Use a small timeout budget to test timeout rejection quickly
    const res = await probeHealth(mockDb as DatabaseClient, 50);
    expect(res.statusCode).toBe(503);
    expect(res.payload.status).toBe('unhealthy');
    expect(res.payload.database).toBe('disconnected');
  });
});
