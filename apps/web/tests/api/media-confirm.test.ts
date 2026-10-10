import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleConfirmUpload } from '../../src/app/api/tenant/[subdomain]/media/confirm/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Media Upload Confirmation (POST /api/tenant/[subdomain]/media/confirm)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const mediaId = '22222222-2222-4222-a222-222222222222';
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
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/confirm', {
      method: 'POST',
      body: JSON.stringify({
        mediaId,
        name: 'video.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: `users/${userId}/media/${mediaId}/video.mp4`,
        url: `https://media.fbuploadpro.com/users/${userId}/media/${mediaId}/video.mp4`,
      }),
    });
    const res = await handleConfirmUpload(req, 'acme');

    expect(res.status).toBe(401);
  });

  it('rejects cross-tenant requests with 403 Forbidden', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/other-tenant/media/confirm', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        mediaId,
        name: 'video.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: `users/${userId}/media/${mediaId}/video.mp4`,
        url: `https://media.fbuploadpro.com/users/${userId}/media/${mediaId}/video.mp4`,
      }),
    });
    const res = await handleConfirmUpload(req, 'other-tenant');

    expect(res.status).toBe(403);
  });

  it('rejects invalid request payloads with 400 Bad Request', async () => {
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/confirm', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        mediaId: 'not-a-uuid',
      }),
    });
    const res = await handleConfirmUpload(req, 'acme');

    expect(res.status).toBe(400);
  });

  it('persists media record and defaults captionText to filename with extension stripped when omitted', async () => {
    let capturedInsertParams: any[] = [];
    const mockDb: Partial<DatabaseClient> = {
      withTransaction: vi.fn().mockImplementation(async (callback) => {
        const txClient = {
          query: vi.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes('INSERT INTO media_items')) {
              capturedInsertParams = params;
              return {
                rows: [
                  {
                    id: mediaId,
                    user_id: userId,
                    folder_id: null,
                    name: 'My Viral Reel.mp4',
                    file_size: '10485760',
                    mime_type: 'video/mp4',
                    media_type: 'video',
                    storage_key: `users/${userId}/media/${mediaId}/My_Viral_Reel.mp4`,
                    url: `https://media.fbuploadpro.com/users/${userId}/media/${mediaId}/My_Viral_Reel.mp4`,
                    thumbnail_key: `users/${userId}/thumbnails/${mediaId}.webp`,
                    thumbnail_url: `https://media.fbuploadpro.com/users/${userId}/thumbnails/${mediaId}.webp`,
                    duration_seconds: '45.50',
                    aspect_ratio: '9:16',
                    caption_text: params[13],
                    created_at: new Date('2026-10-07T12:00:00Z'),
                    updated_at: new Date('2026-10-07T12:00:00Z'),
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        };
        return callback(txClient as any);
      }),
    };

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/confirm', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        mediaId,
        name: 'My Viral Reel.mp4',
        fileSize: 10485760,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: `users/${userId}/media/${mediaId}/My_Viral_Reel.mp4`,
        url: `https://media.fbuploadpro.com/users/${userId}/media/${mediaId}/My_Viral_Reel.mp4`,
        thumbnailKey: `users/${userId}/thumbnails/${mediaId}.webp`,
        thumbnailUrl: `https://media.fbuploadpro.com/users/${userId}/thumbnails/${mediaId}.webp`,
        durationSeconds: 45.5,
        aspectRatio: '9:16',
      }),
    });
    const res = await handleConfirmUpload(req, 'acme', mockDb as DatabaseClient);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(mediaId);
    expect(data.userId).toBe(userId);
    expect(data.name).toBe('My Viral Reel.mp4');
    expect(data.fileSize).toBe(10485760);
    expect(data.mediaType).toBe('video');
    expect(data.durationSeconds).toBe(45.5);
    expect(capturedInsertParams[13]).toBe('My Viral Reel');
    expect(data.captionText).toBe('My Viral Reel');
  });
});
