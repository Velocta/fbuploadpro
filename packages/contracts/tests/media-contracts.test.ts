import { describe, it, expect } from 'vitest';
import {
  UploadUrlRequestSchema,
  ConfirmUploadRequestSchema,
  CreateFolderRequestSchema,
  MediaListQuerySchema,
  DeleteMediaItemResponseSchema,
  DeleteFolderResponseSchema,
  deriveDefaultCaptionFromFilename,
} from '../src/index.js';

describe('Media Domain Contracts', () => {
  describe('UploadUrlRequestSchema', () => {
    it('accepts valid MP4 video upload request under 500 MB', () => {
      const res = UploadUrlRequestSchema.safeParse({
        fileName: 'reel_vertical.mp4',
        fileSize: 45000000,
        mimeType: 'video/mp4',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.thumbnailMimeType).toBe('image/webp');
      }
    });

    it('accepts valid JPEG image upload request', () => {
      const res = UploadUrlRequestSchema.safeParse({
        fileName: 'cover.jpg',
        fileSize: 5000000,
        mimeType: 'image/jpeg',
      });
      expect(res.success).toBe(true);
    });

    it('rejects unsupported MIME types', () => {
      const res = UploadUrlRequestSchema.safeParse({
        fileName: 'script.sh',
        fileSize: 1000,
        mimeType: 'application/x-sh',
      });
      expect(res.success).toBe(false);
    });

    it('rejects files exceeding 500 MB limit', () => {
      const res = UploadUrlRequestSchema.safeParse({
        fileName: 'huge_raw.mov',
        fileSize: 524288001,
        mimeType: 'video/quicktime',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('ConfirmUploadRequestSchema & deriveDefaultCaptionFromFilename', () => {
    it('validates complete video confirmation payload without tags or captionTemplateId', () => {
      const res = ConfirmUploadRequestSchema.safeParse({
        mediaId: '11111111-1111-4111-a111-111111111111',
        name: 'My Viral Reel.mp4',
        fileSize: 15000000,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: 'users/123/media/111/video.mp4',
        url: 'https://media.fbuploadpro.com/video.mp4',
        thumbnailKey: 'users/123/thumbnails/111.webp',
        thumbnailUrl: 'https://media.fbuploadpro.com/thumb.webp',
        durationSeconds: 45.5,
        aspectRatio: '9:16',
      });
      expect(res.success).toBe(true);
    });

    it('strips file extension when deriving default caption from filename', () => {
      expect(deriveDefaultCaptionFromFilename('My Viral Reel.mp4')).toBe('My Viral Reel');
      expect(deriveDefaultCaptionFromFilename('Promo.Banner.Final.png')).toBe('Promo.Banner.Final');
      expect(deriveDefaultCaptionFromFilename('NoExtensionFile')).toBe('NoExtensionFile');
    });

    it('rejects invalid UUIDs for mediaId', () => {
      const res = ConfirmUploadRequestSchema.safeParse({
        mediaId: 'invalid-id',
        name: 'Test',
        fileSize: 1000,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: 'key',
        url: 'https://media.com/1',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('Folder Contracts', () => {
    it('validates folder creation with name only (no color badge)', () => {
      const res = CreateFolderRequestSchema.safeParse({
        name: 'Daily Highlights',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect('color' in res.data).toBe(false);
      }
    });

    it('validates non-destructive folder delete response schema', () => {
      const res = DeleteFolderResponseSchema.safeParse({
        success: true,
        deletedFolderId: '22222222-2222-4222-a222-222222222222',
        preservedItemsCount: 42,
      });
      expect(res.success).toBe(true);
    });
  });

  describe('Media List Query Contracts', () => {
    it('parses string numbers to integers for pagination', () => {
      const res = MediaListQuerySchema.safeParse({
        limit: '25',
        offset: '50',
        mediaType: 'video',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.limit).toBe(25);
        expect(res.data.offset).toBe(50);
        expect(res.data.mediaType).toBe('video');
      }
    });
  });

  describe('DeleteMediaItemResponseSchema', () => {
    it('validates asset deletion response without quota fields', () => {
      const res = DeleteMediaItemResponseSchema.safeParse({
        success: true,
        mediaId: '44444444-4444-4444-a444-444444444444',
      });
      expect(res.success).toBe(true);
    });
  });
});
