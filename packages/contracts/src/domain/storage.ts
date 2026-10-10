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
