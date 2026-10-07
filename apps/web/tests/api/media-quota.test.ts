import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleGetQuota } from '../../src/app/api/tenant/[subdomain]/media/quota/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Storage Quota Inspection (T088 - GET /api/tenant/[subdomain]/media/quota)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;

    const token = await signSessionToken(
      {
        userId,
        email: 'alex@acme.com',
        name: 'Alex Acme',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/quota');
    const res = await handleGetQuota(req, 'acme');

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('rejects cross-tenant requests with 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/media/quota', {
      headers: { cookie: validSessionCookie },
    });
    const res = await handleGetQuota(req, 'other-tenant');

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('returns storage quota and item counts for authenticated tenant user', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM user_storage_quotas')) {
          return Promise.resolve([
            {
              user_id: userId,
              total_bytes: '5368709120',
              used_bytes: '1073741824', // 1 GB used
            },
          ]);
        }
        if (sql.includes('FROM media_items')) {
          return Promise.resolve([
            {
              total_items: 5,
              video_items: 2,
              image_items: 3,
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/quota', {
      headers: { cookie: validSessionCookie },
    });
    const res = await handleGetQuota(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      userId,
      totalBytes: 5368709120,
      usedBytes: 1073741824,
      remainingBytes: 4294967296,
      utilizationPercentage: 20,
      totalItems: 5,
      videoItems: 2,
      imageItems: 3,
    });
  });

  it('defaults to baseline 5 GB quota when record is not yet initialized', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM user_storage_quotas')) {
          return Promise.resolve([]);
        }
        if (sql.includes('FROM media_items')) {
          return Promise.resolve([
            {
              total_items: 0,
              video_items: 0,
              image_items: 0,
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/quota', {
      headers: { cookie: validSessionCookie },
    });
    const res = await handleGetQuota(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totalBytes).toBe(5368709120);
    expect(data.usedBytes).toBe(0);
    expect(data.remainingBytes).toBe(5368709120);
    expect(data.utilizationPercentage).toBe(0);
    expect(data.totalItems).toBe(0);
  });
});
