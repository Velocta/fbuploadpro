import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import type { DatabaseClient } from '@fbuploadpro/contracts';
import { handleDownloadMediaFromUrl } from '../../src/app/api/tenant/[subdomain]/media/downloader/route';
import { MockStorageProvider } from '../../src/lib/storage';
import { normalizeCloudDriveUrl } from '../../src/lib/media-downloader';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Cloud Media Downloader Endpoint (POST /api/tenant/[subdomain]/media/downloader)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const downloadsFolderId = '33333333-3333-4333-a333-333333333333';
  let validSessionCookie: string;
  let mockStorage: MockStorageProvider;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    delete process.env.DOWNLOADER_EXTRACTOR_API_URL;

    const token = await signSessionToken(
      {
        userId,
        email: 'alexander@gmail.com',
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

  function createMockDb(options?: { validFolderIds?: string[] }): {
    db: DatabaseClient;
    insertedParamsList: unknown[][];
  } {
    const validFolders = new Set(options?.validFolderIds ?? [downloadsFolderId]);
    const insertedParamsList: unknown[][] = [];

    const handleSql = async (sql: string, params: unknown[] = []) => {
      if (sql.includes('SELECT id FROM media_folders')) {
        const requestedFolderId = String(params[0] ?? '');
        const requestedUserId = String(params[1] ?? '');
        if (requestedUserId === userId && validFolders.has(requestedFolderId)) {
          return { rows: [{ id: requestedFolderId }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('INSERT INTO media_items')) {
        insertedParamsList.push(params);
        const now = new Date('2026-10-11T08:45:00.000Z');
        return {
          rows: [
            {
              id: params[0],
              user_id: params[1],
              folder_id: params[2],
              name: params[3],
              file_size: String(params[4]),
              mime_type: params[5],
              media_type: params[6],
              storage_key: params[7],
              url: params[8],
              thumbnail_key: params[9],
              thumbnail_url: params[10],
              duration_seconds: params[11] !== null ? String(params[11]) : null,
              aspect_ratio: params[12] ?? 'unknown',
              caption_text: params[13],
              created_at: now,
              updated_at: now,
            },
          ],
          rowCount: 1,
        };
      }

      return { rows: [], rowCount: 0 };
    };

    const db: Partial<DatabaseClient> = {
      query: vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
        const res = await handleSql(sql, params);
        return res.rows;
      }),
      withTransaction: vi.fn().mockImplementation(async (callback) => {
        const txClient = {
          query: vi.fn().mockImplementation((sql: string, params?: unknown[]) =>
            handleSql(sql, params)
          ),
        };
        return callback(txClient as never);
      }),
    };

    return { db: db as DatabaseClient, insertedParamsList };
  }

  it('rejects unauthenticated requests with 401 and cross-tenant requests with 403', async () => {
    const unauthReq = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://cdn.example.com/reel.mp4' }),
    });
    const unauthRes = await handleDownloadMediaFromUrl(unauthReq, 'acme');
    expect(unauthRes.status).toBe(401);

    const crossTenantReq = new NextRequest(
      'http://localhost:3000/api/tenant/other-workspace/media/downloader',
      {
        method: 'POST',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({ url: 'https://cdn.example.com/reel.mp4' }),
      }
    );
    const crossTenantRes = await handleDownloadMediaFromUrl(crossTenantReq, 'other-workspace');
    expect(crossTenantRes.status).toBe(403);
  });

  it('streams a direct MP4 link directly into R2 and defaults captionText to the stripped filename', async () => {
    const { db, insertedParamsList } = createMockDb();
    const fakeVideoBytes = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(fakeVideoBytes, {
        status: 200,
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(fakeVideoBytes.byteLength),
        },
      })
    );

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        url: 'https://cdn.example.com/assets/Summer_Launch_Reel.mp4',
        folderId: downloadsFolderId,
      }),
    });

    const res = await handleDownloadMediaFromUrl(
      req,
      'acme',
      db,
      mockStorage,
      mockFetch as unknown as typeof fetch
    );

    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.platform).toBe('direct');
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].name).toBe('Summer_Launch_Reel.mp4');
    expect(payload.items[0].fileSize).toBe(fakeVideoBytes.byteLength);
    expect(payload.items[0].mimeType).toBe('video/mp4');
    expect(payload.items[0].mediaType).toBe('video');
    expect(payload.items[0].folderId).toBe(downloadsFolderId);
    expect(payload.items[0].captionText).toBe('Summer_Launch_Reel');
    expect(insertedParamsList).toHaveLength(1);
    expect(mockStorage.uploadedObjects.get(payload.items[0].storageKey)).toEqual({
      contentType: 'video/mp4',
      byteLength: fakeVideoBytes.byteLength,
    });
  });

  it('extracts video, thumbnail, and original post caption from an OpenGraph social post', async () => {
    const { db } = createMockDb();
    const htmlPage = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="Creator Studio Reel" />
          <meta property="og:description" content="Morning routine for high output days &amp; focus #productivity" />
          <meta property="og:video:secure_url" content="https://v16.tiktokcdn.com/stream/morning_routine.mp4" />
          <meta property="og:image" content="https://p16.tiktokcdn.com/thumbs/morning_cover.jpeg" />
        </head>
        <body></body>
      </html>
    `;
    const videoBytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const thumbBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const targetUrl = String(input);
      if (targetUrl.includes('tiktok.com/@creator/video')) {
        return new Response(htmlPage, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (targetUrl.includes('morning_routine.mp4')) {
        return new Response(videoBytes, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        });
      }
      if (targetUrl.includes('morning_cover.jpeg')) {
        return new Response(thumbBytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        url: 'https://www.tiktok.com/@creator/video/7123456789',
        folderId: downloadsFolderId,
      }),
    });

    const res = await handleDownloadMediaFromUrl(
      req,
      'acme',
      db,
      mockStorage,
      mockFetch as unknown as typeof fetch
    );

    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.platform).toBe('tiktok');
    expect(payload.items).toHaveLength(1);
    const item = payload.items[0];
    expect(item.captionText).toBe('Morning routine for high output days & focus #productivity');
    expect(item.thumbnailKey).toContain(`users/${userId}/thumbnails/${item.id}.jpeg`);
    expect(item.thumbnailUrl).toContain(`users/${userId}/thumbnails/${item.id}.jpeg`);
    expect(mockStorage.uploadedObjects.has(item.storageKey)).toBe(true);
    expect(mockStorage.uploadedObjects.has(item.thumbnailKey)).toBe(true);
  });

  it('ingests all supported media assets from a multi-item carousel post via pluggable extractor or FxTwitter', async () => {
    const { db, insertedParamsList } = createMockDb();
    const clipBytes = new Uint8Array([11, 22, 33, 44]);
    const photoBytes = new Uint8Array([55, 66, 77, 88, 99]);

    const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const targetUrl = String(input);
      if (targetUrl === 'https://extractor.example.com/api/extract') {
        return new Response(
          JSON.stringify({
            caption: 'Carousel launch thread with video + poster',
            picker: [
              {
                type: 'video',
                url: 'https://video.twimg.com/ext_tw_video/101/pu/vid/clip_1.mp4',
              },
              {
                type: 'photo',
                url: 'https://pbs.twimg.com/media/poster_2.webp',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
      if (targetUrl.includes('clip_1.mp4')) {
        return new Response(clipBytes, {
          status: 200,
          headers: { 'content-type': 'video/mp4' },
        });
      }
      if (targetUrl.includes('poster_2.webp')) {
        return new Response(photoBytes, {
          status: 200,
          headers: { 'content-type': 'image/webp' },
        });
      }
      return new Response('Not Found', { status: 404 });
    });

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        url: 'https://x.com/creator/status/1800000000000000000',
        folderId: downloadsFolderId,
      }),
    });

    const res = await handleDownloadMediaFromUrl(
      req,
      'acme',
      db,
      mockStorage,
      mockFetch as unknown as typeof fetch,
      'https://extractor.example.com/api/extract'
    );

    expect(res.status).toBe(201);
    const payload = await res.json();
    expect(payload.platform).toBe('x');
    expect(payload.items).toHaveLength(2);
    expect(insertedParamsList).toHaveLength(2);

    expect(payload.items[0].mediaType).toBe('video');
    expect(payload.items[0].captionText).toBe('Carousel launch thread with video + poster');
    expect(payload.items[1].mediaType).toBe('image');
    expect(payload.items[1].mimeType).toBe('image/webp');
    expect(payload.items[1].thumbnailUrl).toBe(payload.items[1].url);
  });

  it('normalizes Google Drive and Dropbox share URLs into direct download stream URLs', () => {
    const gdriveUrl = new URL(
      'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing'
    );
    expect(normalizeCloudDriveUrl(gdriveUrl)).toBe(
      'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz'
    );

    const dropboxUrl = new URL('https://www.dropbox.com/s/abc123xyz/campaign_reel.mp4?dl=0');
    expect(normalizeCloudDriveUrl(dropboxUrl)).toBe(
      'https://www.dropbox.com/s/abc123xyz/campaign_reel.mp4?dl=1'
    );
  });

  it('blocks SSRF attempts targeting localhost, private IPs, or unsafe og:video redirect targets with 400 UNSAFE_URL', async () => {
    const { db } = createMockDb();
    const mockFetch = vi.fn();

    const privateIpReq = new NextRequest(
      'http://localhost:3000/api/tenant/acme/media/downloader',
      {
        method: 'POST',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({
          url: 'http://169.254.169.254/latest/meta-data/iam',
          folderId: null,
        }),
      }
    );

    const privateIpRes = await handleDownloadMediaFromUrl(
      privateIpReq,
      'acme',
      db,
      mockStorage,
      mockFetch as unknown as typeof fetch
    );
    expect(privateIpRes.status).toBe(400);
    const errBody = await privateIpRes.json();
    expect(errBody.error).toBe('UNSAFE_URL');
    expect(mockFetch).not.toHaveBeenCalled();

    // Also block if a public HTML page embeds an internal loopback og:video URL
    const maliciousHtmlFetch = vi.fn().mockResolvedValue(
      new Response(
        '<html><head><meta property="og:video" content="http://127.0.0.1:8080/internal.mp4" /></head></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      )
    );
    const ssrfHopReq = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        url: 'https://public-blog.example.com/post',
        folderId: null,
      }),
    });
    const ssrfHopRes = await handleDownloadMediaFromUrl(
      ssrfHopReq,
      'acme',
      db,
      mockStorage,
      maliciousHtmlFetch as unknown as typeof fetch
    );
    expect(ssrfHopRes.status).toBe(400);
    const hopBody = await ssrfHopRes.json();
    expect(hopBody.error).toBe('UNSAFE_URL');
  });

  it('rejects files exceeding the 500 MB limit with 400 FILE_TOO_LARGE', async () => {
    const { db } = createMockDb();
    const oversizedFetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          'content-type': 'video/mp4',
          'content-length': '524288001', // 500 MB + 1 byte
        },
      })
    );

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        url: 'https://cdn.example.com/huge_raw_video.mp4',
        folderId: downloadsFolderId,
      }),
    });

    const res = await handleDownloadMediaFromUrl(
      req,
      'acme',
      db,
      mockStorage,
      oversizedFetch as unknown as typeof fetch
    );
    expect(res.status).toBe(400);
    const errBody = await res.json();
    expect(errBody.error).toBe('FILE_TOO_LARGE');
    expect(mockStorage.uploadedObjects.size).toBe(0);
  });

  it('rejects unknown or cross-tenant folderId with 404 FOLDER_NOT_FOUND', async () => {
    const { db } = createMockDb({ validFolderIds: [downloadsFolderId] });
    const mockFetch = vi.fn();

    const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/downloader', {
      method: 'POST',
      headers: { cookie: validSessionCookie },
      body: JSON.stringify({
        url: 'https://cdn.example.com/video.mp4',
        folderId: '99999999-9999-4999-a999-999999999999',
      }),
    });

    const res = await handleDownloadMediaFromUrl(
      req,
      'acme',
      db,
      mockStorage,
      mockFetch as unknown as typeof fetch
    );
    expect(res.status).toBe(404);
    const errBody = await res.json();
    expect(errBody.error).toBe('FOLDER_NOT_FOUND');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
