import { z } from 'zod';

export const AllowedMediaMimeTypes = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const AllowedThumbnailMimeTypes = ['image/webp', 'image/jpeg'] as const;

export const UploadUrlRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(524288000), // Max 500 MB
  mimeType: z.enum(AllowedMediaMimeTypes),
  thumbnailMimeType: z.enum(AllowedThumbnailMimeTypes).default('image/webp'),
});

export type UploadUrlRequest = z.infer<typeof UploadUrlRequestSchema>;

export const UploadUrlResponseSchema = z.object({
  mediaId: z.string().uuid(),
  mediaKey: z.string().min(1),
  mediaUploadUrl: z.string().url(),
  thumbnailKey: z.string().min(1),
  thumbnailUploadUrl: z.string().url(),
  publicMediaUrl: z.string().url(),
  publicThumbnailUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

export const ConfirmUploadRequestSchema = z.object({
  mediaId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.enum(AllowedMediaMimeTypes),
  mediaType: z.enum(['video', 'image']),
  storageKey: z.string().min(1).max(500),
  url: z.string().url(),
  thumbnailKey: z.string().min(1).max(500).nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  durationSeconds: z.number().nonnegative().nullable().optional(),
  aspectRatio: z.string().min(1).max(20).default('unknown'),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(50)).default([]),
  captionTemplateId: z.string().uuid().nullable().optional(),
  captionText: z.string().max(5000).nullable().optional(),
});

export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequestSchema>;

export const MediaItemResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  name: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  mediaType: z.enum(['video', 'image']),
  storageKey: z.string(),
  url: z.string().url(),
  thumbnailKey: z.string().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  durationSeconds: z.number().nullable(),
  aspectRatio: z.string(),
  tags: z.array(z.string()),
  captionTemplateId: z.string().uuid().nullable(),
  captionText: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MediaItemResponse = z.infer<typeof MediaItemResponseSchema>;

export const MediaListQuerySchema = z.object({
  folderId: z.string().uuid().or(z.literal('unorganized')).optional(),
  mediaType: z.enum(['video', 'image']).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MediaListQuery = z.infer<typeof MediaListQuerySchema>;

export const MediaListResponseSchema = z.object({
  items: z.array(MediaItemResponseSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type MediaListResponse = z.infer<typeof MediaListResponseSchema>;

export const UpdateMediaItemRequestSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  folderId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).optional(),
  captionTemplateId: z.string().uuid().nullable().optional(),
  captionText: z.string().max(5000).nullable().optional(),
});

export type UpdateMediaItemRequest = z.infer<typeof UpdateMediaItemRequestSchema>;

export const DeleteMediaItemResponseSchema = z.object({
  success: z.literal(true),
  mediaId: z.string().uuid(),
  reclaimedBytes: z.number().int().positive(),
  remainingQuotaBytes: z.number().int().nonnegative(),
});

export type DeleteMediaItemResponse = z.infer<typeof DeleteMediaItemResponseSchema>;
