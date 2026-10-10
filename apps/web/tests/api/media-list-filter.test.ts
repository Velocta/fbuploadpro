import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleListMedia } from '../../src/app/api/tenant/[subdomain]/media/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Media Items Listing & Filtering (GET /api/tenant/[subdomain]/media)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const folderId = '22222222-2222-4222-a222-222222222222';
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
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media');
    const res = await handleListMedia(req, 'acme');

    expect(res.status).toBe(401);
  });

  it('rejects cross-tenant requests with 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/media', {
      headers: { cookie: validSessionCookie },
    });
    const res = await handleListMedia(req, 'other-tenant');

    expect(res.status).toBe(403);
  });

  it('lists media items with default pagination', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve([{ total: 1 }]);
        }
        return Promise.resolve([
          {
            id: '33333333-3333-4333-a333-333333333333',
            user_id: userId,
            folder_id: null,
            name: 'reel1.mp4',
            file_size: '10485760',
            mime_type: 'video/mp4',
            media_type: 'video',
            storage_key: `users/${userId}/media/33333333-3333-4333-a333-333333333333/reel1.mp4`,
            url: `https://media.fbuploadpro.com/users/${userId}/media/33333333-3333-4333-a333-333333333333/reel1.mp4`,
            thumbnail_key: `users/${userId}/thumbnails/33333333-3333-4333-a333-333333333333.webp`,
            thumbnail_url: `https://media.fbuploadpro.com/users/${userId}/thumbnails/33333333-3333-4333-a333-333333333333.webp`,
            duration_seconds: '30.00',
            aspect_ratio: '9:16',
            caption_text: 'Promo copy',
            created_at: new Date('2026-10-07T12:00:00Z'),
            updated_at: new Date('2026-10-07T12:00:00Z'),
          },
        ]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media', {
      headers: { cookie: validSessionCookie },
    });
    const res = await handleListMedia(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe('reel1.mp4');
    expect(data.items[0].captionText).toBe('Promo copy');
  });

  it('filters media items by folderId, mediaType, and search', async () => {
    let capturedSql = '';
    let capturedParams: any[] = [];

    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string, params: any[]) => {
        capturedSql = sql;
        capturedParams = params;
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve([{ total: 0 }]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(
      `http://localhost:3000/api/tenant/acme/media?folderId=${folderId}&mediaType=video&search=spring`,
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleListMedia(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('folder_id =');
    expect(capturedSql).toContain('media_type =');
    expect(capturedSql).toContain('ILIKE');
    expect(capturedParams).toContain(folderId);
    expect(capturedParams).toContain('video');
  });

  it('filters unorganized items when folderId=unorganized', async () => {
    let capturedSql = '';

    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        capturedSql = sql;
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve([{ total: 0 }]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(
      'http://localhost:3000/api/tenant/acme/media?folderId=unorganized',
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleListMedia(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('folder_id IS NULL');
  });

  it('applies sortBy and sortOrder allowlist to ORDER BY', async () => {
    let capturedSql = '';

    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        capturedSql = sql;
        if (sql.includes('SELECT COUNT(*)')) {
          return Promise.resolve([{ total: 0 }]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(
      'http://localhost:3000/api/tenant/acme/media?sortBy=name&sortOrder=asc',
      { headers: { cookie: validSessionCookie } }
    );
    const res = await handleListMedia(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('ORDER BY LOWER(name) ASC');
  });
});
