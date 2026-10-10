import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockStorageProvider,
  R2StorageProvider,
  getMockStorageProvider,
  getStorageService,
  type R2Config,
} from '../src/lib/storage';

describe('Storage Service Providers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('MockStorageProvider', () => {
    it('generates presigned upload URLs and computes public URLs', async () => {
      const mock = new MockStorageProvider();
      const result = await mock.getPresignedUploadUrl({
        key: 'users/123/media/abc/video.mp4',
        contentType: 'video/mp4',
        expiresInSeconds: 600,
      });

      expect(result.expiresInSeconds).toBe(600);
      expect(result.uploadUrl).toContain('mock-r2.fbuploadpro.com');
      expect(result.uploadUrl).toContain(encodeURIComponent('users/123/media/abc/video.mp4'));
      expect(result.publicUrl).toBe('https://media.fbuploadpro.com/users/123/media/abc/video.mp4');
      expect(mock.requestedUploadKeys.has('users/123/media/abc/video.mp4')).toBe(true);
    });

    it('deletes objects and updates tracked keys', async () => {
      const mock = new MockStorageProvider();
      const key = 'users/123/media/abc/image.png';

      await mock.getPresignedUploadUrl({ key, contentType: 'image/png' });
      expect(mock.requestedUploadKeys.has(key)).toBe(true);

      await mock.deleteObject(key);
      expect(mock.deletedKeys.has(key)).toBe(true);
      expect(mock.requestedUploadKeys.has(key)).toBe(false);

      mock.reset();
      expect(mock.deletedKeys.size).toBe(0);
    });
  });

  describe('R2StorageProvider', () => {
    const fakeConfig: R2Config = {
      accountId: 'fake_account',
      accessKeyId: 'fake_key',
      secretAccessKey: 'fake_secret',
      bucketName: 'fake_bucket',
      publicUrl: 'https://media.customdomain.com',
    };

    it('computes public URLs correctly using config publicUrl', () => {
      const provider = new R2StorageProvider(fakeConfig);
      const url = provider.getPublicUrl('users/tenant-1/media/file.mp4');
      expect(url).toBe('https://media.customdomain.com/users/tenant-1/media/file.mp4');
    });

    it('invokes client delete command upon deleteObject', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const fakeS3Client = { send: mockSend } as any;

      const provider = new R2StorageProvider(fakeConfig, fakeS3Client);
      await provider.deleteObject('users/tenant-1/media/file.mp4');

      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('getStorageService Factory', () => {
    it('returns MockStorageProvider when R2 environment is unconfigured', () => {
      delete process.env.R2_ACCOUNT_ID;
      delete process.env.R2_ACCESS_KEY_ID;

      const service = getStorageService();
      expect(service).toBeInstanceOf(MockStorageProvider);
    });

    it('returns R2StorageProvider when valid R2 environment is configured', () => {
      process.env.R2_ACCOUNT_ID = 'prod_acc';
      process.env.R2_ACCESS_KEY_ID = 'prod_key';
      process.env.R2_SECRET_ACCESS_KEY = 'prod_secret';
      process.env.R2_BUCKET_NAME = 'prod_bucket';
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com';

      const service = getStorageService();
      expect(service).toBeInstanceOf(R2StorageProvider);
    });
  });
});
