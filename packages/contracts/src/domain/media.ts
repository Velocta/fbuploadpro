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

/**
 * Strips the trailing file extension from a filename to produce the default media caption.
 * Example: "My Viral Reel.mp4" -> "My Viral Reel"
 */
export function deriveDefaultCaptionFromFilename(fileName: string): string {
  const trimmed = fileName.trim();
  const lastDotIndex = trimmed.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return trimmed.slice(0, lastDotIndex).trim();
  }
  return trimmed;
}

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
  captionText: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MediaItemResponse = z.infer<typeof MediaItemResponseSchema>;

export const MediaListQuerySchema = z.object({
  folderId: z.string().uuid().or(z.literal('unorganized')).optional(),
  mediaType: z.enum(['video', 'image']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'name', 'file_size']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
  captionText: z.string().max(5000).nullable().optional(),
});

export type UpdateMediaItemRequest = z.infer<typeof UpdateMediaItemRequestSchema>;

export const DeleteMediaItemResponseSchema = z.object({
  success: z.literal(true),
  mediaId: z.string().uuid(),
});

export type DeleteMediaItemResponse = z.infer<typeof DeleteMediaItemResponseSchema>;

export const BatchMediaRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('move'),
    mediaIds: z.array(z.string().uuid()).min(1).max(500),
    folderId: z.string().uuid().nullable(),
  }),
  z.object({
    action: z.literal('delete'),
    mediaIds: z.array(z.string().uuid()).min(1).max(500),
  }),
  z.object({
    action: z.literal('caption'),
    mediaIds: z.array(z.string().uuid()).min(1).max(500),
    captionText: z.string().max(2200).nullable(),
  }),
]);

export type BatchMediaRequest = z.infer<typeof BatchMediaRequestSchema>;

export const BatchMediaResponseSchema = z.object({
  success: z.literal(true),
  action: z.enum(['move', 'delete', 'caption']),
  affectedCount: z.number().int().min(0),
});

export type BatchMediaResponse = z.infer<typeof BatchMediaResponseSchema>;
