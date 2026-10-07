import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleCreateUploadUrl } from '../../src/app/api/tenant/[subdomain]/media/upload-url/route';
import { MockStorageProvider } from '../../src/lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Presigned Upload URL Endpoint (T086, T089, T090 - POST /api/tenant/[subdomain]/media/upload-url)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  let validSessionCookie: string;
  let mockStorage: MockStorageProvider;

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
    mockStorage = new MockStorageProvider();
  });

  it('rejects unauthenticated requests with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: 'reel.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4',
      }),
    });
    const res = await handleCreateUploadUrl(req, 'acme');

    expect(res.status).toBe(401);
  });

  it('rejects cross-tenant requests with 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/media/upload-url', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        fileName: 'reel.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4',
      }),
    });
    const res = await handleCreateUploadUrl(req, 'other-tenant');

    expect(res.status).toBe(403);
  });

  it('rejects unsupported MIME types with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/upload-url', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        fileName: 'script.exe',
        fileSize: 1024,
        mimeType: 'application/x-msdownload',
      }),
    });
    const res = await handleCreateUploadUrl(req, 'acme');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_REQUEST');
  });

  it('rejects files exceeding 500 MB limit with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/upload-url', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        fileName: 'huge.mp4',
        fileSize: 524288001, // 500 MB + 1 byte
        mimeType: 'video/mp4',
      }),
    });
    const res = await handleCreateUploadUrl(req, 'acme');

    expect(res.status).toBe(400);
  });

  it('rejects upload request when user storage quota is exceeded with 403 INSUFFICIENT_STORAGE_QUOTA', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM user_storage_quotas')) {
          return Promise.resolve([
            {
              total_bytes: '5368709120',
              used_bytes: '5368700000', // Only ~9120 bytes left
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/upload-url', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        fileName: 'video.mp4',
        fileSize: 50000000, // 50 MB
        mimeType: 'video/mp4',
      }),
    });
    const res = await handleCreateUploadUrl(req, 'acme', mockDb as DatabaseClient, mockStorage);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('INSUFFICIENT_STORAGE_QUOTA');
    expect(body.message).toContain('Storage quota exceeded');
  });

  it('generates presigned PUT URLs with hierarchical isolation and valid response contract', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM user_storage_quotas')) {
          return Promise.resolve([
            {
              total_bytes: '5368709120',
              used_bytes: '1073741824', // 1 GB used, plenty of space
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/upload-url', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        fileName: 'summer vacation promo.mp4',
        fileSize: 20971520, // 20 MB
        mimeType: 'video/mp4',
        thumbnailMimeType: 'image/webp',
      }),
    });
    const res = await handleCreateUploadUrl(req, 'acme', mockDb as DatabaseClient, mockStorage);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.mediaId).toBeDefined();
    expect(data.mediaKey).toBe(
      `users/${userId}/media/${data.mediaId}/summer_vacation_promo.mp4`
    );
    expect(data.mediaUploadUrl).toContain('mock-r2.fbuploadpro.com/upload/');
    expect(data.thumbnailKey).toBe(`users/${userId}/thumbnails/${data.mediaId}.webp`);
    expect(data.thumbnailUploadUrl).toContain('mock-r2.fbuploadpro.com/upload/');
    expect(data.publicMediaUrl).toBe(
      `https://media.fbuploadpro.com/users/${userId}/media/${data.mediaId}/summer_vacation_promo.mp4`
    );
    expect(data.publicThumbnailUrl).toBe(
      `https://media.fbuploadpro.com/users/${userId}/thumbnails/${data.mediaId}.webp`
    );
    expect(data.expiresInSeconds).toBe(900);
  });
});
