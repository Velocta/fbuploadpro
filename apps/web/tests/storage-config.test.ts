import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getR2Config, createR2S3Client, R2ConfigSchema } from '../src/lib/storage';

describe('Cloudflare R2 Storage Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validates configuration schema correctly', () => {
    const valid = R2ConfigSchema.safeParse({
      accountId: 'acc_123',
      accessKeyId: 'key_123',
      secretAccessKey: 'sec_123',
      bucketName: 'media-bucket',
      publicUrl: 'https://media.fbuploadpro.com',
      defaultQuotaBytes: '5368709120',
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.bucketName).toBe('media-bucket');
      expect(valid.data.defaultQuotaBytes).toBe(5368709120);
    }
  });

  it('returns null from getR2Config when environment variables are missing', () => {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_BUCKET_NAME;
    delete process.env.R2_PUBLIC_URL;

    expect(getR2Config()).toBeNull();
  });

  it('loads valid configuration when all environment variables are populated', () => {
    process.env.R2_ACCOUNT_ID = 'test_acc';
    process.env.R2_ACCESS_KEY_ID = 'test_key';
    process.env.R2_SECRET_ACCESS_KEY = 'test_secret';
    process.env.R2_BUCKET_NAME = 'test_bucket';
    process.env.R2_PUBLIC_URL = 'https://media.test.com';

    const config = getR2Config();
    expect(config).not.toBeNull();
    expect(config?.accountId).toBe('test_acc');
    expect(config?.bucketName).toBe('test_bucket');

    const client = createR2S3Client(config!);
    expect(client).toBeDefined();
  });
});
