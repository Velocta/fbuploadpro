import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getR2Config,
  createR2S3Client,
  R2ConfigSchema,
  R2_MAX_ATTEMPTS,
  R2_REQUEST_TIMEOUT_MS,
  R2_CONNECTION_TIMEOUT_MS,
} from '../../src/lib/storage';

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
    });

    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.bucketName).toBe('media-bucket');
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
    client.destroy();
  });

  it('configures explicit maxAttempts and request/connection timeouts (spec 139)', async () => {
    const client = createR2S3Client({
      accountId: 'acc_123',
      accessKeyId: 'key_123',
      secretAccessKey: 'sec_123',
      bucketName: 'media-bucket',
      publicUrl: 'https://media.fbuploadpro.com',
    });

    expect(R2_MAX_ATTEMPTS).toBe(3);
    expect(R2_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(R2_CONNECTION_TIMEOUT_MS).toBe(5_000);

    const resolvedMaxAttempts = client.config.maxAttempts;
    const maxAttempts =
      typeof resolvedMaxAttempts === 'function'
        ? await (resolvedMaxAttempts as () => Promise<number>)()
        : resolvedMaxAttempts;
    expect(maxAttempts).toBe(R2_MAX_ATTEMPTS);

    const handler = client.config.requestHandler as unknown as {
      httpHandlerConfigs?: () => Record<string, unknown>;
      configProvider?: Promise<Record<string, unknown>>;
    };
    expect(typeof handler.httpHandlerConfigs).toBe('function');
    // NodeHttpHandler resolves the plain options object we pass lazily
    // via its internal configProvider — the resolved config is what
    // every request actually runs with.
    const resolvedHandlerConfig = await handler.configProvider;
    expect(resolvedHandlerConfig).toMatchObject({
      requestTimeout: R2_REQUEST_TIMEOUT_MS,
      connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
      throwOnRequestTimeout: true,
    });

    client.destroy();
  });
});
