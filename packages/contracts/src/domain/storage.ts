import { z } from 'zod';

export const StorageQuotaResponseSchema = z.object({
  userId: z.string().uuid(),
  totalBytes: z.number().int().nonnegative(),
  usedBytes: z.number().int().nonnegative(),
  remainingBytes: z.number().int().nonnegative(),
  utilizationPercentage: z.number().min(0).max(100),
  totalItems: z.number().int().nonnegative(),
  videoItems: z.number().int().nonnegative(),
  imageItems: z.number().int().nonnegative(),
});

export type StorageQuotaResponse = z.infer<typeof StorageQuotaResponseSchema>;

export interface PresignedUploadParams {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  expiresInSeconds: number;
}

export interface IStorageService {
  getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}
