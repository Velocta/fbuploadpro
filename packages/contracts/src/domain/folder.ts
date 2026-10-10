import { z } from 'zod';

export const FolderResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  parentId: z.string().uuid().nullable().default(null),
  name: z.string().min(1).max(100),
  itemCount: z.number().int().min(0),
  subfolderCount: z.number().int().min(0).default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const MediaFolderSchema = FolderResponseSchema;

export type FolderResponse = z.infer<typeof FolderResponseSchema>;
export type MediaFolder = FolderResponse;

export const FolderListResponseSchema = z.object({
  folders: z.array(FolderResponseSchema),
  unorganizedCount: z.number().int().nonnegative(),
});

export type FolderListResponse = z.infer<typeof FolderListResponseSchema>;

export const CreateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  parentId: z.string().uuid().nullable().optional(),
});

export type CreateFolderRequest = z.infer<typeof CreateFolderRequestSchema>;

export const UpdateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export type UpdateFolderRequest = z.infer<typeof UpdateFolderRequestSchema>;

export const DeleteFolderResponseSchema = z.object({
  success: z.literal(true),
  deletedFolderId: z.string().uuid(),
  deletedSubfoldersCount: z.number().int().min(0),
  deletedItemsCount: z.number().int().min(0),
});

export type DeleteFolderResponse = z.infer<typeof DeleteFolderResponseSchema>;
