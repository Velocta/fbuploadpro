import { z } from 'zod';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  IStorageService,
  PresignedUploadParams,
  PresignedUploadResult,
} from '@fbuploadpro/contracts';

export const R2ConfigSchema = z.object({
  accountId: z.string().min(1, 'R2_ACCOUNT_ID is required'),
  accessKeyId: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  secretAccessKey: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  bucketName: z.string().min(1, 'R2_BUCKET_NAME is required'),
  publicUrl: z.string().url('R2_PUBLIC_URL must be a valid URL'),
  defaultQuotaBytes: z.coerce.number().int().positive().default(5368709120), // 5 GB
});

export type R2Config = z.infer<typeof R2ConfigSchema>;

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const defaultQuotaBytes = process.env.DEFAULT_STORAGE_QUOTA_BYTES ?? '5368709120';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    return null;
  }

  const result = R2ConfigSchema.safeParse({
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
    defaultQuotaBytes,
  });

  return result.success ? result.data : null;
}

export function createR2S3Client(config: R2Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function trimTrailingSlashes(str: string): string {
  let end = str.length;
  while (end > 0 && str.charCodeAt(end - 1) === 47) {
    end--;
  }
  return str.slice(0, end);
}

export class MockStorageProvider implements IStorageService {
  public deletedKeys: Set<string> = new Set();
  public requestedUploadKeys: Set<string> = new Set();
  public publicUrlBase: string = 'https://media.fbuploadpro.com';

  async getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    const expiresIn = params.expiresInSeconds ?? 900;
    this.requestedUploadKeys.add(params.key);
    return {
      uploadUrl: `https://mock-r2.fbuploadpro.com/upload/${encodeURIComponent(params.key)}?expires=${expiresIn}`,
      publicUrl: this.getPublicUrl(params.key),
      expiresInSeconds: expiresIn,
    };
  }

  async deleteObject(key: string): Promise<void> {
    this.deletedKeys.add(key);
    this.requestedUploadKeys.delete(key);
  }

  getPublicUrl(key: string): string {
    const trimmedBase = trimTrailingSlashes(this.publicUrlBase);
    const trimmedKey = key.replace(/^\/+/, '');
    return `${trimmedBase}/${trimmedKey}`;
  }

  reset(): void {
    this.deletedKeys.clear();
    this.requestedUploadKeys.clear();
  }
}

export class R2StorageProvider implements IStorageService {
  private client: S3Client;
  private config: R2Config;

  constructor(config: R2Config, client?: S3Client) {
    this.config = config;
    this.client = client ?? createR2S3Client(config);
  }

  async getPresignedUploadUrl(params: PresignedUploadParams): Promise<PresignedUploadResult> {
    const expiresIn = params.expiresInSeconds ?? 900;
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: params.key,
      ContentType: params.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return {
      uploadUrl,
      publicUrl: this.getPublicUrl(params.key),
      expiresInSeconds: expiresIn,
    };
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
    });
    await this.client.send(command);
  }

  getPublicUrl(key: string): string {
    const trimmedBase = trimTrailingSlashes(this.config.publicUrl);
    const trimmedKey = key.replace(/^\/+/, '');
    return `${trimmedBase}/${trimmedKey}`;
  }
}

let activeMockStorage: MockStorageProvider | null = null;

export function getMockStorageProvider(): MockStorageProvider {
  if (!activeMockStorage) {
    activeMockStorage = new MockStorageProvider();
  }
  return activeMockStorage;
}

export function getStorageService(): IStorageService {
  const config = getR2Config();
  if (config) {
    return new R2StorageProvider(config);
  }
  return getMockStorageProvider();
}
