import { describe, expect, it, vi } from 'vitest';
import {
  resolveRemoteCandidates,
  persistDownloadedMediaItem,
  tryUploadVideoThumbnailToR2,
  failStuckDownloadJobs,
} from '../src/index.js';

describe('Worker Downloader Engine (Spec 046 Remediation)', () => {
  describe('resolveRemoteCandidates', () => {
    it('bypasses Google Drive virus scan warning using resolveGoogleDriveDirectUrl', async () => {
      const gDriveHtml = `
        <!DOCTYPE html>
        <html>
          <body>
            <div>Google Drive can't scan this file for viruses.</div>
            <a href="/download?id=1AbCdEfGhIjKlMnOpQrStUvWxYz&confirm=t_token123">Download anyway</a>
          </body>
        </html>
      `;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/html; charset=utf-8',
        }),
        text: vi.fn().mockResolvedValue(gDriveHtml),
        url: 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUvWxYz',
      });

      const candidates = await resolveRemoteCandidates(
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view',
        {},
        mockFetch as unknown as typeof fetch
      );

      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.streamUrl).toContain('drive.usercontent.google.com/download');
      expect(candidates[0]?.streamUrl).toContain('id=1AbCdEfGhIjKlMnOpQrStUvWxYz');
      expect(candidates[0]?.streamUrl).toContain('confirm=');
    });

    it('extracts OpenGraph video candidates and metadata from HTML page', async () => {
      const ogHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta property="og:video" content="https://cdn.social.com/video_1080p.mp4" />
            <meta property="og:image" content="https://cdn.social.com/poster.jpg" />
            <meta property="og:description" content="My viral post caption with hashtags" />
          </head>
          <body></body>
        </html>
      `;

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'text/html; charset=utf-8',
        }),
        text: vi.fn().mockResolvedValue(ogHtml),
        url: 'https://social.com/reel/12345',
      });

      const candidates = await resolveRemoteCandidates(
        'https://social.com/reel/12345',
        {},
        mockFetch as unknown as typeof fetch
      );

      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.streamUrl).toBe('https://cdn.social.com/video_1080p.mp4');
      expect(candidates[0]?.thumbnailUrl).toBe('https://cdn.social.com/poster.jpg');
      expect(candidates[0]?.caption).toBe('My viral post caption with hashtags');
    });
  });

  describe('persistDownloadedMediaItem', () => {
    it('persists thumbnail, duration, aspect ratio, custom caption, and carousel mediaIds array', async () => {
      const mediaInserts: any[] = [];
      const jobUpdates: any[] = [];

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === 'media_items') {
            return {
              insert: vi.fn((vals: any) => {
                mediaInserts.push(vals);
                return Promise.resolve({ data: vals, error: null });
              }),
            };
          }
          if (table === 'media_download_jobs') {
            return {
              update: vi.fn((vals: any) => {
                jobUpdates.push(vals);
                return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) };
              }),
            };
          }
          return {};
        }),
      };

      const mediaId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
      const secondaryId = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

      await persistDownloadedMediaItem({
        db: mockDb,
        jobId: 'job-123',
        userId: 'user-456',
        targetFolderId: 'folder-789',
        mediaId,
        fileName: 'clip.mp4',
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: `users/user-456/media/${mediaId}/clip.mp4`,
        publicUrl: `https://media.fbuploadpro.com/users/user-456/media/${mediaId}/clip.mp4`,
        downloadedBytes: 15_000_000,
        thumbnailKey: `users/user-456/thumbnails/${mediaId}.webp`,
        thumbnailUrl: `https://media.fbuploadpro.com/users/user-456/thumbnails/${mediaId}.webp`,
        durationSeconds: 32.5,
        aspectRatio: '9:16',
        captionText: 'Extracted viral reel caption!',
        allMediaIds: [mediaId, secondaryId],
      });

      expect(mediaInserts).toHaveLength(1);
      const inserted = mediaInserts[0];
      expect(inserted.thumbnail_key).toBe(`users/user-456/thumbnails/${mediaId}.webp`);
      expect(inserted.thumbnail_url).toBe(`https://media.fbuploadpro.com/users/user-456/thumbnails/${mediaId}.webp`);
      expect(inserted.duration_seconds).toBe(32.5);
      expect(inserted.aspect_ratio).toBe('9:16');
      expect(inserted.caption_text).toBe('Extracted viral reel caption!');

      const completedJobUpdate = jobUpdates.find((u) => u.status === 'completed');
      expect(completedJobUpdate).toBeDefined();
      expect(completedJobUpdate.media_id).toBe(mediaId);
      expect(completedJobUpdate.metadata).toEqual({
        media_ids: [mediaId, secondaryId],
        total_items: 2,
      });
    });
  });

  describe('tryUploadVideoThumbnailToR2', () => {
    it('fetches remote thumbnail and writes to R2 bucket', async () => {
      const mockPut = vi.fn().mockResolvedValue({});
      const env = {
        MEDIA_BUCKET: { put: mockPut },
        R2_PUBLIC_URL: 'https://media.fbuploadpro.com',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'image/jpeg',
        }),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([255, 216, 255]));
            controller.close();
          },
        }),
      });

      const res = await tryUploadVideoThumbnailToR2({
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        userId: 'u1',
        mediaId: 'm1',
        env,
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(res.thumbnailKey).toBe('users/u1/thumbnails/m1.jpg');
      expect(res.thumbnailUrl).toBe('https://media.fbuploadpro.com/users/u1/thumbnails/m1.jpg');
      expect(mockPut).toHaveBeenCalled();
    });
  });

  describe('failStuckDownloadJobs', () => {
    it('invokes RPC with 15 minute timeout', async () => {
      const mockDb = {
        rpc: vi.fn().mockResolvedValue({ data: 2, error: null }),
      };

      const result = await failStuckDownloadJobs(mockDb);
      expect(result).toBe(2);
      expect(mockDb.rpc).toHaveBeenCalledWith('fail_stuck_download_jobs', { p_timeout_minutes: 15 });
    });
  });
});
