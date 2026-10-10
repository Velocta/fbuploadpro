import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleUpdateMedia } from '../../src/app/api/tenant/[subdomain]/media/[mediaId]/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Media Item Patch & Direct Caption Editing (PATCH /api/tenant/[subdomain]/media/[mediaId])', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const mediaId = '22222222-2222-4222-a222-222222222222';
  const folderId = '33333333-3333-4333-a333-333333333333';
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
    const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'updated.mp4' }),
    });
    const res = await handleUpdateMedia(req, 'acme', mediaId);
    expect(res.status).toBe(401);
  });

  it('rejects cross-tenant requests with 403 Forbidden', async () => {
    const req = new NextRequest(`http://localhost:3000/api/tenant/other/media/${mediaId}`, {
      method: 'PATCH',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({ name: 'updated.mp4' }),
    });
    const res = await handleUpdateMedia(req, 'other', mediaId);
    expect(res.status).toBe(403);
  });

  it('rejects invalid mediaId with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/not-a-uuid', {
      method: 'PATCH',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({ name: 'updated.mp4' }),
    });
    const res = await handleUpdateMedia(req, 'acme', 'not-a-uuid');
    expect(res.status).toBe(400);
  });

  it('returns 404 when media item is not found or belongs to another user', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT') && sql.includes('FROM media_items')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
      method: 'PATCH',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({ name: 'renamed.mp4' }),
    });

    const res = await handleUpdateMedia(req, 'acme', mediaId, mockDb as DatabaseClient);
    expect(res.status).toBe(404);
  });

  it('returns 404 when target folder does not exist for the user', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM media_items') && sql.includes('SELECT')) {
          return Promise.resolve([{ id: mediaId, user_id: userId }]);
        }
        if (sql.includes('FROM media_folders')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
      method: 'PATCH',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({ folderId }),
    });

    const res = await handleUpdateMedia(req, 'acme', mediaId, mockDb as DatabaseClient);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('FOLDER_NOT_FOUND');
  });

  it('updates media name, folder, and direct captionText', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM media_items') && sql.includes('SELECT')) {
          return Promise.resolve([{ id: mediaId, user_id: userId }]);
        }
        if (sql.includes('FROM media_folders')) {
          return Promise.resolve([{ id: folderId, user_id: userId }]);
        }
        if (sql.includes('UPDATE media_items')) {
          return Promise.resolve([
            {
              id: mediaId,
              user_id: userId,
              folder_id: folderId,
              name: 'new-name.mp4',
              file_size: '52428800',
              mime_type: 'video/mp4',
              media_type: 'video',
              storage_key: `tenants/acme/media/${mediaId}/new-name.mp4`,
              url: `https://pub-r2.example.com/tenants/acme/media/${mediaId}/new-name.mp4`,
              thumbnail_key: `tenants/acme/media/${mediaId}/thumb.webp`,
              thumbnail_url: `https://pub-r2.example.com/tenants/acme/media/${mediaId}/thumb.webp`,
              duration_seconds: '25.50',
              aspect_ratio: '9:16',
              caption_text: 'Updated direct caption for this video',
              created_at: new Date('2026-10-07T10:00:00Z'),
              updated_at: new Date('2026-10-07T11:00:00Z'),
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
      method: 'PATCH',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        name: 'new-name.mp4',
        folderId,
        captionText: 'Updated direct caption for this video',
      }),
    });

    const res = await handleUpdateMedia(req, 'acme', mediaId, mockDb as DatabaseClient);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe('new-name.mp4');
    expect(body.folderId).toBe(folderId);
    expect(body.captionText).toBe('Updated direct caption for this video');
  });

  it('unsets folder and captionText when passed null', async () => {
    const mockDb: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM media_items') && sql.includes('SELECT')) {
          return Promise.resolve([{ id: mediaId, user_id: userId }]);
        }
        if (sql.includes('UPDATE media_items')) {
          return Promise.resolve([
            {
              id: mediaId,
              user_id: userId,
              folder_id: null,
              name: 'existing.mp4',
              file_size: '52428800',
              mime_type: 'video/mp4',
              media_type: 'video',
              storage_key: `tenants/acme/media/${mediaId}/existing.mp4`,
              url: `https://pub-r2.example.com/tenants/acme/media/${mediaId}/existing.mp4`,
              thumbnail_key: null,
              thumbnail_url: null,
              duration_seconds: null,
              aspect_ratio: 'unknown',
              caption_text: null,
              created_at: new Date('2026-10-07T10:00:00Z'),
              updated_at: new Date('2026-10-07T11:00:00Z'),
            },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/${mediaId}`, {
      method: 'PATCH',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        folderId: null,
        captionText: null,
      }),
    });

    const res = await handleUpdateMedia(req, 'acme', mediaId, mockDb as DatabaseClient);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.folderId).toBeNull();
    expect(body.captionText).toBeNull();
  });
});
