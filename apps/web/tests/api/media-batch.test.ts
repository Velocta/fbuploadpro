import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleBatchMedia } from '../../src/app/api/tenant/[subdomain]/media/batch/route';
import { MockStorageProvider } from '../../src/lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Media Batch Operations (POST /api/tenant/[subdomain]/media/batch)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const folderId = '22222222-2222-4222-a222-222222222222';
  const mediaId1 = '33333333-3333-4333-a333-333333333333';
  const mediaId2 = '44444444-4444-4444-a444-444444444444';
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

  it('rejects unauthenticated requests with 401 and cross-tenant requests with 403', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/tenant/acme/media/batch', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', mediaIds: [mediaId1] }),
    });
    expect((await handleBatchMedia(unauthReq, 'acme')).status).toBe(401);

    const crossReq = new NextRequest('http://localhost:3000/api/tenant/other/media/batch', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({ action: 'delete', mediaIds: [mediaId1] }),
    });
    expect((await handleBatchMedia(crossReq, 'other')).status).toBe(403);
  });

  it('moves multiple media items into a target folder owned by user', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT id FROM media_folders')) {
          return Promise.resolve([{ id: folderId }]);
        }
        if (sql.includes('UPDATE media_items')) {
          return Promise.resolve([{ id: mediaId1 }, { id: mediaId2 }]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/batch', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        action: 'move',
        mediaIds: [mediaId1, mediaId2],
        folderId,
      }),
    });

    const res = await handleBatchMedia(req, 'acme', mockDb as DatabaseClient);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      action: 'move',
      affectedCount: 2,
    });
  });

  it('returns 404 FOLDER_NOT_FOUND when moving media to a folder not owned by user', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockResolvedValue([]),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/batch', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        action: 'move',
        mediaIds: [mediaId1],
        folderId,
      }),
    });

    const res = await handleBatchMedia(req, 'acme', mockDb as DatabaseClient);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('FOLDER_NOT_FOUND');
  });

  it('updates captionText in batch for multiple media items', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockResolvedValue([{ id: mediaId1 }, { id: mediaId2 }]),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/batch', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        action: 'caption',
        mediaIds: [mediaId1, mediaId2],
        captionText: 'Unified campaign caption',
      }),
    });

    const res = await handleBatchMedia(req, 'acme', mockDb as DatabaseClient);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      action: 'caption',
      affectedCount: 2,
    });
  });

  it('deletes multiple media items and purges R2 storage_key and thumbnail_key', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT id, storage_key, thumbnail_key')) {
          return Promise.resolve([
            {
              id: mediaId1,
              storage_key: 'users/111/media/1.mp4',
              thumbnail_key: 'users/111/thumbnails/1.webp',
            },
            {
              id: mediaId2,
              storage_key: 'users/111/media/2.png',
              thumbnail_key: null,
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/batch', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        action: 'delete',
        mediaIds: [mediaId1, mediaId2],
      }),
    });

    const res = await handleBatchMedia(req, 'acme', mockDb as DatabaseClient, mockStorage);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      success: true,
      action: 'delete',
      affectedCount: 2,
    });
    expect(mockStorage.deletedKeys.has('users/111/media/1.mp4')).toBe(true);
    expect(mockStorage.deletedKeys.has('users/111/thumbnails/1.webp')).toBe(true);
    expect(mockStorage.deletedKeys.has('users/111/media/2.png')).toBe(true);
  });
});
