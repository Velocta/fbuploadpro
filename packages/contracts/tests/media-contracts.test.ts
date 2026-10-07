import { describe, it, expect } from 'vitest';
import {
  UploadUrlRequestSchema,
  ConfirmUploadRequestSchema,
  CreateFolderRequestSchema,
  CreateCaptionTemplateRequestSchema,
  StorageQuotaResponseSchema,
  MediaListQuerySchema,
  DeleteMediaItemResponseSchema,
  DeleteFolderResponseSchema,
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

  describe('ConfirmUploadRequestSchema', () => {
    it('validates complete video confirmation payload', () => {
      const res = ConfirmUploadRequestSchema.safeParse({
        mediaId: '11111111-1111-4111-a111-111111111111',
        name: 'My Viral Reel',
        fileSize: 15000000,
        mimeType: 'video/mp4',
        mediaType: 'video',
        storageKey: 'users/123/media/111/video.mp4',
        url: 'https://media.fbuploadpro.com/video.mp4',
        thumbnailKey: 'users/123/thumbnails/111.webp',
        thumbnailUrl: 'https://media.fbuploadpro.com/thumb.webp',
        durationSeconds: 45.5,
        aspectRatio: '9:16',
        tags: ['#viral', '#reels'],
      });
      expect(res.success).toBe(true);
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
    it('validates folder creation with valid color badge', () => {
      const res = CreateFolderRequestSchema.safeParse({
        name: 'Daily Highlights',
        color: 'emerald',
      });
      expect(res.success).toBe(true);
    });

    it('defaults folder color to slate when omitted', () => {
      const res = CreateFolderRequestSchema.safeParse({
        name: 'Unsorted Batch',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.color).toBe('slate');
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

  describe('Caption Template Contracts', () => {
    it('validates caption template creation with copy and tags', () => {
      const res = CreateCaptionTemplateRequestSchema.safeParse({
        title: 'Weekly Promo CTA',
        content: 'Check out our new features! 🔥 Link in bio 👉 https://example.com #growth #saas',
        tags: ['promo', 'cta'],
      });
      expect(res.success).toBe(true);
    });
  });

  describe('Storage Quota Contracts', () => {
    it('validates storage quota response metrics', () => {
      const res = StorageQuotaResponseSchema.safeParse({
        userId: '33333333-3333-4333-a333-333333333333',
        totalBytes: 5368709120,
        usedBytes: 1073741824,
        remainingBytes: 4294967296,
        utilizationPercentage: 20.0,
        totalItems: 15,
        videoItems: 10,
        imageItems: 5,
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
    it('validates asset deletion response with reclaimed quota metrics', () => {
      const res = DeleteMediaItemResponseSchema.safeParse({
        success: true,
        mediaId: '44444444-4444-4444-a444-444444444444',
        reclaimedBytes: 50000000,
        remainingQuotaBytes: 5318709120,
      });
      expect(res.success).toBe(true);
    });
  });
});
