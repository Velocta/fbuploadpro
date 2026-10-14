import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveWorkspaceFacebookCredentials } from '@/lib/server/byoc-resolver';
import { encryptToken, type DatabaseClient } from '@fbuploadpro/contracts';

const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('resolveWorkspaceFacebookCredentials suite', () => {
  const subdomain = 'beta';
  const userId = '11111111-1111-4111-a111-111111111111';
  const workspaceId = '22222222-2222-4222-a222-222222222222';
  const rawSecret = 'meta_app_secret_123456789';
  let encryptedSecret: string;

  beforeEach(async () => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
    encryptedSecret = await encryptToken(rawSecret, TEST_ENCRYPTION_KEY);
  });

  describe('Legacy DatabaseClient path', () => {
    it('returns 404 when workspace is not found', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) return Promise.resolve([]);
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const result = await resolveWorkspaceFacebookCredentials(mockLegacyClient, subdomain, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('WORKSPACE_NOT_FOUND');
        expect(result.status).toBe(404);
      }
    });

    it('returns 422 when BYOC credentials row is missing', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) return Promise.resolve([{ id: workspaceId }]);
          if (sql.includes('FROM workspace_byoc_credentials')) return Promise.resolve([]);
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const result = await resolveWorkspaceFacebookCredentials(mockLegacyClient, subdomain, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('BYOC_NOT_CONFIGURED');
        expect(result.status).toBe(422);
      }
    });

    it('returns 422 when BYOC row has missing secret or app id', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) return Promise.resolve([{ id: workspaceId }]);
          if (sql.includes('FROM workspace_byoc_credentials')) {
            return Promise.resolve([{ fb_app_id: 'app_123', encrypted_fb_app_secret: '' }]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const result = await resolveWorkspaceFacebookCredentials(mockLegacyClient, subdomain, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('BYOC_NOT_CONFIGURED');
        expect(result.status).toBe(422);
      }
    });

    it('returns decrypted credentials when valid row exists', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) return Promise.resolve([{ id: workspaceId }]);
          if (sql.includes('FROM workspace_byoc_credentials')) {
            return Promise.resolve([
              {
                fb_app_id: 'app_1234567890',
                encrypted_fb_app_secret: encryptedSecret,
                webhook_verify_token: 'wh_token_xyz',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const result = await resolveWorkspaceFacebookCredentials(mockLegacyClient, subdomain, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.workspaceId).toBe(workspaceId);
        expect(result.fbAppId).toBe('app_1234567890');
        expect(result.decryptedAppSecret).toBe(rawSecret);
        expect(result.webhookVerifyToken).toBe('wh_token_xyz');
      }
    });

    it('returns 422 when decryption fails', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM workspaces')) return Promise.resolve([{ id: workspaceId }]);
          if (sql.includes('FROM workspace_byoc_credentials')) {
            return Promise.resolve([
              {
                fb_app_id: 'app_1234567890',
                encrypted_fb_app_secret: 'invalid:corrupted:ciphertext',
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      } as unknown as DatabaseClient;

      const result = await resolveWorkspaceFacebookCredentials(mockLegacyClient, subdomain, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('BYOC_NOT_CONFIGURED');
        expect(result.status).toBe(422);
      }
    });
  });

  describe('Supabase Client path', () => {
    it('returns decrypted credentials when valid row exists in Supabase', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'workspaces') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: workspaceId }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === 'workspace_byoc_credentials') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      fb_app_id: 'fb_app_9999',
                      encrypted_fb_app_secret: encryptedSecret,
                      webhook_verify_token: null,
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as any;

      const result = await resolveWorkspaceFacebookCredentials(mockSupabase, subdomain, userId);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.workspaceId).toBe(workspaceId);
        expect(result.fbAppId).toBe('fb_app_9999');
        expect(result.decryptedAppSecret).toBe(rawSecret);
        expect(result.webhookVerifyToken).toBeNull();
      }
    });

    it('returns 422 when supabase credentials query errors', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'workspaces') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: workspaceId }, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === 'workspace_byoc_credentials') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Row not found' },
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as any;

      const result = await resolveWorkspaceFacebookCredentials(mockSupabase, subdomain, userId);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('BYOC_NOT_CONFIGURED');
        expect(result.status).toBe(422);
      }
    });
  });
});
