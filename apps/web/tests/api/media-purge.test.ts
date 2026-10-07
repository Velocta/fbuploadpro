import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  handleGetMedia,
  handleDeleteMedia,
} from '../../src/app/api/tenant/[subdomain]/media/[mediaId]/route';
import { MockStorageProvider } from '../../src/lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Media Inspection & Purging (T101, T102, T103)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const mediaId = '22222222-2222-4222-a222-222222222222';
  let validSessionCookie: string;
  let mockStorage: MockStorageProvider;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    mockStorage = new MockStorageProvider();

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

  describe('GET /api/tenant/[subdomain]/media/[mediaId] (T102)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`);
      const res = await handleGetMedia(req, 'acme', mediaId);
      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant requests with 403 Forbidden', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/other/media/${mediaId}`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetMedia(req, 'other', mediaId);
      expect(res.status).toBe(403);
    });

    it('rejects invalid mediaId with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/not-a-valid-uuid', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetMedia(req, 'acme', 'not-a-valid-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 when media item is not found or belongs to another user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetMedia(req, 'acme', mediaId, mockDb as DatabaseClient);
      expect(res.status).toBe(404);
    });

    it('returns media asset details with technical metadata', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([
          {
            id: mediaId,
            user_id: userId,
            folder_id: null,
            name: 'product-reel.mp4',
            file_size: '52428800',
            mime_type: 'video/mp4',
            media_type: 'video',
            storage_key: `tenants/acme/media/${mediaId}/product-reel.mp4`,
            url: `https://pub-r2.example.com/tenants/acme/media/${mediaId}/product-reel.mp4`,
            thumbnail_key: `tenants/acme/media/${mediaId}/thumb.webp`,
            thumbnail_url: `https://pub-r2.example.com/tenants/acme/media/${mediaId}/thumb.webp`,
            duration_seconds: '15.50',
            aspect_ratio: '9:16',
            tags: ['reel', 'product'],
            caption_template_id: null,
            caption_text: 'Check out our new launch!',
            created_at: new Date('2026-10-07T10:00:00Z'),
            updated_at: new Date('2026-10-07T10:00:00Z'),
          },
        ]),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleGetMedia(req, 'acme', mediaId, mockDb as DatabaseClient);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.id).toBe(mediaId);
      expect(body.name).toBe('product-reel.mp4');
      expect(body.fileSize).toBe(52428800);
      expect(body.mimeType).toBe('video/mp4');
      expect(body.mediaType).toBe('video');
      expect(body.aspectRatio).toBe('9:16');
      expect(body.durationSeconds).toBe(15.5);
      expect(body.tags).toEqual(['reel', 'product']);
    });
  });

  describe('DELETE /api/tenant/[subdomain]/media/[mediaId] (T103)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
        method: 'DELETE',
      });
      const res = await handleDeleteMedia(req, 'acme', mediaId);
      expect(res.status).toBe(401);
    });

    it('rejects cross-tenant requests with 403 Forbidden', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/other/media/${mediaId}`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await handleDeleteMedia(req, 'other', mediaId);
      expect(res.status).toBe(403);
    });

    it('rejects invalid mediaId with 400 Bad Request', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/invalid-uuid', {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await handleDeleteMedia(req, 'acme', 'invalid-uuid');
      expect(res.status).toBe(400);
    });

    it('returns 404 when media item is not found or belongs to another user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await handleDeleteMedia(
        req,
        'acme',
        mediaId,
        mockDb as DatabaseClient,
        mockStorage
      );
      expect(res.status).toBe(404);
    });

    it('deletes asset from R2, purges DB record, and decrements storage quota atomically', async () => {
      const primaryKey = `tenants/acme/media/${mediaId}/clip.mp4`;
      const thumbKey = `tenants/acme/media/${mediaId}/clip_thumb.webp`;
      const fileSize = 50000000;

      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('SELECT') && sql.includes('FROM media_items')) {
            return Promise.resolve([
              {
                id: mediaId,
                user_id: userId,
                storage_key: primaryKey,
                thumbnail_key: thumbKey,
                file_size: fileSize.toString(),
              },
            ]);
          }
          if (sql.includes('DELETE FROM media_items')) {
            return Promise.resolve([]);
          }
          if (sql.includes('UPDATE user_storage_quotas')) {
            return Promise.resolve([
              {
                total_bytes: '5368709120',
                used_bytes: '100000000',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });

      const res = await handleDeleteMedia(
        req,
        'acme',
        mediaId,
        mockDb as DatabaseClient,
        mockStorage
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.mediaId).toBe(mediaId);
      expect(body.reclaimedBytes).toBe(fileSize);
      expect(body.remainingQuotaBytes).toBe(5368709120 - 100000000);

      // Verify storage objects were deleted
      expect(mockStorage.deletedKeys.has(primaryKey)).toBe(true);
      expect(mockStorage.deletedKeys.has(thumbKey)).toBe(true);
    });
  });
});
