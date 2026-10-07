import { z } from 'zod';

export const AllowedFolderColors = [
  'slate',
  'blue',
  'green',
  'purple',
  'amber',
  'rose',
  'emerald',
  'indigo',
] as const;

export const FolderResponseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(20),
  itemCount: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FolderResponse = z.infer<typeof FolderResponseSchema>;

export const FolderListResponseSchema = z.object({
  folders: z.array(FolderResponseSchema),
  unorganizedCount: z.number().int().nonnegative(),
});

export type FolderListResponse = z.infer<typeof FolderListResponseSchema>;

export const CreateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.enum(AllowedFolderColors).default('slate'),
});

export type CreateFolderRequest = z.infer<typeof CreateFolderRequestSchema>;

export const UpdateFolderRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  color: z.enum(AllowedFolderColors).optional(),
});

export type UpdateFolderRequest = z.infer<typeof UpdateFolderRequestSchema>;

export const DeleteFolderResponseSchema = z.object({
  success: z.literal(true),
  deletedFolderId: z.string().uuid(),
  preservedItemsCount: z.number().int().nonnegative(),
});

export type DeleteFolderResponse = z.infer<typeof DeleteFolderResponseSchema>;
