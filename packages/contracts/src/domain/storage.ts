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

export interface PutObjectParams {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface PutObjectResult {
  key: string;
  publicUrl: string;
  byteLength: number;
}

export interface IStorageService {
  getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult>;
  putObject(params: PutObjectParams): Promise<PutObjectResult>;
  deleteObject(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

