import { z } from 'zod';

/**
 * Media library resources.
 *
 * Sources: `GET/POST …/media`, `…/media/[mediaId]`, `…/media/batch`,
 * `…/media/folders[/…]`, `…/media/upload-url`, `…/media/confirm`,
 * `…/media/check-duplicates` — item/list responses parsed server-side
 * through the contracts media/folder schemas — plus fixtures in
 * `tests/api/media-*.test.ts`.
 *
 * Passthrough choices: none. `check-duplicates` embeds a full media
 * item (`existingItem`) whose name/thumbnail the import UI renders,
 * so it reuses the strict `MediaItemSchema` rather than passing
 * through.
 */

export const MediaTypeSchema = z.enum(['video', 'image']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const MediaItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  name: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  mediaType: MediaTypeSchema,
  storageKey: z.string(),
  url: z.string(),
  thumbnailKey: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  aspectRatio: z.string(),
  captionText: z.string().nullable(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MediaItem = z.infer<typeof MediaItemSchema>;

export const MediaListResponseSchema = z.object({
  items: z.array(MediaItemSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  nextCursor: z.string().nullable().optional(),
});
export type MediaListResponse = z.infer<typeof MediaListResponseSchema>;

export const DeleteMediaItemResponseSchema = z.object({
  success: z.literal(true),
  mediaId: z.string().uuid(),
});
export type DeleteMediaItemResponse = z.infer<typeof DeleteMediaItemResponseSchema>;

export const BatchMediaResponseSchema = z.object({
  success: z.literal(true),
  action: z.enum(['move', 'delete', 'caption']),
  affectedCount: z.number().int().min(0),
});
export type BatchMediaResponse = z.infer<typeof BatchMediaResponseSchema>;

/** Folders. */

export const MediaFolderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string().min(1),
  itemCount: z.number().int().min(0),
  subfolderCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MediaFolder = z.infer<typeof MediaFolderSchema>;

export const FolderListResponseSchema = z.object({
  folders: z.array(MediaFolderSchema),
  unorganizedCount: z.number().int().nonnegative(),
});
export type FolderListResponse = z.infer<typeof FolderListResponseSchema>;

export const DeleteFolderResponseSchema = z.object({
  success: z.literal(true),
  deletedFolderId: z.string().uuid(),
  deletedSubfoldersCount: z.number().int().min(0),
  deletedItemsCount: z.number().int().min(0),
});
export type DeleteFolderResponse = z.infer<typeof DeleteFolderResponseSchema>;

/** Upload flow. */

export const UploadUrlResponseSchema = z.object({
  mediaId: z.string().uuid(),
  mediaKey: z.string().min(1),
  mediaUploadUrl: z.string(),
  thumbnailKey: z.string().min(1),
  thumbnailUploadUrl: z.string(),
  publicMediaUrl: z.string(),
  publicThumbnailUrl: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

export const DuplicateMatchSchema = z.object({
  clientKey: z.string().min(1),
  existingItem: MediaItemSchema,
});
export type DuplicateMatch = z.infer<typeof DuplicateMatchSchema>;

export const CheckDuplicatesResponseSchema = z.object({
  duplicates: z.array(DuplicateMatchSchema),
});
export type CheckDuplicatesResponse = z.infer<typeof CheckDuplicatesResponseSchema>;
