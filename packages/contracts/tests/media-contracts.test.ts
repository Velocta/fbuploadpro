import { describe, it, expect } from 'vitest';
import {
  UploadUrlRequestSchema,
  ConfirmUploadRequestSchema,
  CreateFolderRequestSchema,
  UpdateFolderRequestSchema,
  MediaFolderSchema,
  MediaListQuerySchema,
  UpdateMediaItemRequestSchema,
  DeleteMediaItemResponseSchema,
  DeleteFolderResponseSchema,
  BatchMediaRequestSchema,
  BatchMediaResponseSchema,
  deriveDefaultCaptionFromFilename,
  CheckDuplicatesRequestSchema,
  AllowedAspectRatios,
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

  describe('Folder Contracts (Nested Hierarchy & Cascading Deletion)', () => {
    it('validates folder creation with name only or optional parentId', () => {
      const rootRes = CreateFolderRequestSchema.safeParse({
        name: 'Daily Highlights',
      });
      expect(rootRes.success).toBe(true);
      if (rootRes.success) {
        expect('color' in rootRes.data).toBe(false);
        expect(rootRes.data.parentId).toBeUndefined();
      }

      const childRes = CreateFolderRequestSchema.safeParse({
        name: 'October Reels',
        parentId: '22222222-2222-4222-a222-222222222222',
      });
      expect(childRes.success).toBe(true);
    });

    it('validates MediaFolderSchema with parentId and subfolderCount defaults', () => {
      const res = MediaFolderSchema.safeParse({
        id: '22222222-2222-4222-a222-222222222222',
        userId: '11111111-1111-4111-a111-111111111111',
        parentId: null,
        name: 'Root Folder',
        itemCount: 5,
        subfolderCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect(res.success).toBe(true);
    });

    it('validates UpdateFolderRequestSchema with name and/or parentId', () => {
      const moveRes = UpdateFolderRequestSchema.safeParse({
        parentId: '33333333-3333-4333-a333-333333333333',
      });
      expect(moveRes.success).toBe(true);
    });

    it('validates cascading folder delete response schema', () => {
      const res = DeleteFolderResponseSchema.safeParse({
        success: true,
        deletedFolderId: '22222222-2222-4222-a222-222222222222',
        deletedSubfoldersCount: 3,
        deletedItemsCount: 42,
      });
      expect(res.success).toBe(true);
    });
  });

  describe('Media List Query & Batch Contracts', () => {
    it('parses pagination, sortBy/sortOrder, aspectRatio, and captionStatus with defaults', () => {
      const res = MediaListQuerySchema.safeParse({
        limit: '25',
        offset: '50',
        mediaType: 'video',
        aspectRatio: '9:16',
        captionStatus: 'empty_caption',
        sortBy: 'file_size',
        sortOrder: 'asc',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.limit).toBe(25);
        expect(res.data.offset).toBe(50);
        expect(res.data.mediaType).toBe('video');
        expect(res.data.aspectRatio).toBe('9:16');
        expect(res.data.captionStatus).toBe('empty_caption');
        expect(res.data.sortBy).toBe('file_size');
        expect(res.data.sortOrder).toBe('asc');
      }
    });

    it('validates UpdateMediaItemRequestSchema with thumbnailKey and thumbnailUrl', () => {
      const r2Res = UpdateMediaItemRequestSchema.safeParse({
        thumbnailKey: 'tenants/u1/thumbnails/frame-1.webp',
        thumbnailUrl: 'https://media.fbuploadpro.com/tenants/u1/thumbnails/frame-1.webp',
      });
      expect(r2Res.success).toBe(true);

      const dataUrlRes = UpdateMediaItemRequestSchema.safeParse({
        thumbnailKey: null,
        thumbnailUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
      });
      expect(dataUrlRes.success).toBe(true);
    });

    it('validates BatchMediaRequestSchema for move, delete, and caption actions', () => {
      const moveRes = BatchMediaRequestSchema.safeParse({
        action: 'move',
        mediaIds: ['11111111-1111-4111-a111-111111111111'],
        folderId: '22222222-2222-4222-a222-222222222222',
      });
      expect(moveRes.success).toBe(true);

      const deleteRes = BatchMediaRequestSchema.safeParse({
        action: 'delete',
        mediaIds: ['11111111-1111-4111-a111-111111111111'],
      });
      expect(deleteRes.success).toBe(true);

      const captionRes = BatchMediaRequestSchema.safeParse({
        action: 'caption',
        mediaIds: ['11111111-1111-4111-a111-111111111111'],
        captionText: 'Updated batch caption',
      });
      expect(captionRes.success).toBe(true);

      const longCaption5000 = BatchMediaRequestSchema.safeParse({
        action: 'caption',
        mediaIds: ['11111111-1111-4111-a111-111111111111'],
        captionText: 'a'.repeat(5000),
      });
      expect(longCaption5000.success).toBe(true);

      const tooLongCaption5001 = BatchMediaRequestSchema.safeParse({
        action: 'caption',
        mediaIds: ['11111111-1111-4111-a111-111111111111'],
        captionText: 'a'.repeat(5001),
      });
      expect(tooLongCaption5001.success).toBe(false);

      const batchResp = BatchMediaResponseSchema.safeParse({
        success: true,
        action: 'move',
        affectedCount: 1,
      });
      expect(batchResp.success).toBe(true);
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

  describe('Aspect Ratio and Duplicate Check Contracts (Spec 046)', () => {
    it('accepts 4:5 aspect ratio in MediaListQuerySchema and confirms AllowedAspectRatios contains 4:5', () => {
      expect(AllowedAspectRatios).toContain('4:5');
      const res = MediaListQuerySchema.safeParse({
        aspectRatio: '4:5',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.aspectRatio).toBe('4:5');
      }
    });

    it('accepts CheckDuplicatesRequestSchema with per-entry folderId and global folderId', () => {
      const res = CheckDuplicatesRequestSchema.safeParse({
        folderId: '11111111-1111-4111-a111-111111111111',
        entries: [
          {
            clientKey: 'file-1',
            name: 'video1.mp4',
            fileSize: 1024,
            folderId: '22222222-2222-4222-a222-222222222222',
          },
          {
            clientKey: 'file-2',
            name: 'photo.jpg',
            fileSize: 2048,
            folderId: null,
          },
        ],
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.entries[0]?.folderId).toBe('22222222-2222-4222-a222-222222222222');
        expect(res.data.entries[1]?.folderId).toBeNull();
      }
    });
  });
});
