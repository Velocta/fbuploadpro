import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATABASE_STATUS,
  HEALTH_STATUS,
  HEALTH_TIMEOUT_MS,
  HTTP_STATUS,
  GET,
  setDatabaseChecker,
} from '../src/app/api/health/route';

describe('GET /api/health (US-3 Health Probe)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    setDatabaseChecker(null);
    vi.useRealTimers();
  });

  it('returns HTTP 200 OK and connected status when database is reachable', async () => {
    setDatabaseChecker(async () => true);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(body).toEqual({
      status: HEALTH_STATUS.OK,
      timestamp: expect.any(String),
      database: DATABASE_STATUS.CONNECTED,
    });
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('returns HTTP 503 Service Unavailable when database check fails', async () => {
    setDatabaseChecker(async () => false);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(body).toEqual({
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: expect.any(String),
      database: DATABASE_STATUS.DISCONNECTED,
    });
  });

  it('returns HTTP 503 and sanitizes internal database errors and credentials', async () => {
    const sensitiveError = new Error(
      'connection error to postgresql://postgres:p%40ssw0rd@db.internal.net:5432/fbuploadpro_prod'
    );
    sensitiveError.stack = 'Error at connect (/internal/db/pool.ts:42:15)';

    setDatabaseChecker(async () => {
      throw sensitiveError;
    });

    const response = await GET();
    const rawText = await response.text();
    const body = JSON.parse(rawText);

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(body).toEqual({
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: expect.any(String),
      database: DATABASE_STATUS.DISCONNECTED,
    });
    expect(rawText).not.toContain('postgres:p%40ssw0rd');
    expect(rawText).not.toContain('db.internal.net');
    expect(rawText).not.toContain('Error at connect');
    expect(rawText).not.toContain('stack');
  });

  it('returns HTTP 503 when database health check exceeds 2000ms timeout budget', async () => {
    setDatabaseChecker(
      (_signal: AbortSignal) =>
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(true), HEALTH_TIMEOUT_MS + 500);
        })
    );

    const healthPromise = GET();
    await vi.advanceTimersByTimeAsync(HEALTH_TIMEOUT_MS + 100);

    const response = await healthPromise;
    const body = await response.json();

    expect(response.status).toBe(HTTP_STATUS.SERVICE_UNAVAILABLE);
    expect(body).toEqual({
      status: HEALTH_STATUS.UNHEALTHY,
      timestamp: expect.any(String),
      database: DATABASE_STATUS.DISCONNECTED,
    });
  });
});
