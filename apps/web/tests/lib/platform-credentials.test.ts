import { describe, expect, it, vi, beforeEach } from 'vitest';
import { decryptToken, encryptToken, type DatabaseClient } from '@fbuploadpro/contracts';
import {
  UnsupportedPlatformError,
  deleteCredentials,
  getCredentials,
  saveCredentials,
  updateCredentialsTestResult,
} from '@/lib/server/platform-credentials';

const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const WORKSPACE_ID = '22222222-2222-4222-a222-222222222222';

interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

/**
 * Recording Supabase mock: captures every table touched and every builder
 * call so tests can assert exactly which tables were written.
 */
function createRecordingSupabase(existingRow: Record<string, unknown> | null) {
  const calls: RecordedCall[] = [];
  const tablesUsed: string[] = [];

  const from = vi.fn((table: string) => {
    tablesUsed.push(table);
    const builder: any = {
      select: vi.fn((...args: unknown[]) => {
        calls.push({ table, op: 'select', args });
        return builder;
      }),
      eq: vi.fn((...args: unknown[]) => {
        calls.push({ table, op: 'eq', args });
        return builder;
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
      upsert: vi.fn((...args: unknown[]) => {
        calls.push({ table, op: 'upsert', args });
        return Promise.resolve({ error: null });
      }),
      update: vi.fn((...args: unknown[]) => {
        calls.push({ table, op: 'update', args });
        return builder;
      }),
      delete: vi.fn((...args: unknown[]) => {
        calls.push({ table, op: 'delete', args });
        return builder;
      }),
      then: (resolve: (value: { error: null }) => void) => resolve({ error: null }),
    };
    return builder;
  });

  return { supabase: { from } as any, calls, tablesUsed };
}

describe('platform-credentials service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  });

  describe.each(['facebook', 'instagram', 'threads'] as const)('platform: %s', (platform) => {
    it('saves credentials with an encrypted secret into platform_credentials', async () => {
      const { supabase, calls, tablesUsed } = createRecordingSupabase(null);

      const result = await saveCredentials(
        WORKSPACE_ID,
        platform,
        { clientId: 'app-id-123', clientSecret: 'plain-secret-value-123' },
        supabase
      );

      expect(result.ok).toBe(true);
      expect(tablesUsed).toEqual(['platform_credentials']);

      const upsert = calls.find((c) => c.op === 'upsert');
      expect(upsert).toBeDefined();
      const row = upsert!.args[0] as Record<string, unknown>;
      expect(row.workspace_id).toBe(WORKSPACE_ID);
      expect(row.platform).toBe(platform);
      expect(row.client_id).toBe('app-id-123');
      expect(row.status).toBe('unverified');
      expect(row.encrypted_client_secret).toBeTruthy();
      expect(row.encrypted_client_secret).not.toBe('plain-secret-value-123');
      expect(upsert!.args[1]).toEqual({ onConflict: 'workspace_id,platform' });

      const decrypted = await decryptToken(row.encrypted_client_secret as string, TEST_ENCRYPTION_KEY);
      expect(decrypted).toBe('plain-secret-value-123');
    });

    it('keeps the existing secret when saving without a new one', async () => {
      const existingEncrypted = await encryptToken('existing-secret-xyz', TEST_ENCRYPTION_KEY);
      const { supabase, calls } = createRecordingSupabase({
        workspace_id: WORKSPACE_ID,
        platform,
        client_id: 'old-app-id',
        encrypted_client_secret: existingEncrypted,
        status: 'valid',
        last_tested_at: null,
        created_at: '2026-10-14T09:00:00Z',
        updated_at: '2026-10-14T09:00:00Z',
      });

      const result = await saveCredentials(WORKSPACE_ID, platform, { clientId: 'new-app-id' }, supabase);

      expect(result.ok).toBe(true);
      expect(calls.find((c) => c.op === 'upsert')).toBeUndefined();
      const update = calls.find((c) => c.op === 'update');
      expect(update).toBeDefined();
      const patch = update!.args[0] as Record<string, unknown>;
      expect(patch.client_id).toBe('new-app-id');
      expect(patch.status).toBe('unverified');
      expect(patch).not.toHaveProperty('encrypted_client_secret');
    });

    it('fails when saving without a secret and none exists yet', async () => {
      const { supabase } = createRecordingSupabase(null);

      const result = await saveCredentials(WORKSPACE_ID, platform, { clientId: 'app-id-123' }, supabase);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(400);
        expect(result.error).toContain('App Secret to complete setup.');
      }
    });

    it('reads back the stored credentials row', async () => {
      const existingEncrypted = await encryptToken('read-back-secret', TEST_ENCRYPTION_KEY);
      const { supabase, calls } = createRecordingSupabase({
        id: 'cred-row-1',
        workspace_id: WORKSPACE_ID,
        platform,
        client_id: 'app-id-777',
        encrypted_client_secret: existingEncrypted,
        status: 'valid',
        last_tested_at: '2026-10-14T10:00:00Z',
        created_at: '2026-10-14T09:00:00Z',
        updated_at: '2026-10-14T11:00:00Z',
      });

      const record = await getCredentials(WORKSPACE_ID, platform, supabase);

      expect(record).not.toBeNull();
      expect(record!.workspaceId).toBe(WORKSPACE_ID);
      expect(record!.platform).toBe(platform);
      expect(record!.clientId).toBe('app-id-777');
      expect(record!.encryptedClientSecret).toBe(existingEncrypted);
      expect(record!.status).toBe('valid');
      expect(record!.lastTestedAt).toBe('2026-10-14T10:00:00Z');
      expect(record!.createdAt).toBe('2026-10-14T09:00:00Z');
      const eqArgs = calls.filter((c) => c.op === 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['workspace_id', WORKSPACE_ID]);
      expect(eqArgs).toContainEqual(['platform', platform]);
    });

    it('returns null when no credentials are stored', async () => {
      const { supabase } = createRecordingSupabase(null);
      const record = await getCredentials(WORKSPACE_ID, platform, supabase);
      expect(record).toBeNull();
    });

    it('delete removes only the platform_credentials row for that platform', async () => {
      const { supabase, calls, tablesUsed } = createRecordingSupabase(null);

      const result = await deleteCredentials(WORKSPACE_ID, platform, supabase);

      expect(result.ok).toBe(true);
      // Only the credentials table is touched — accounts/destinations untouched.
      expect(tablesUsed).toEqual(['platform_credentials']);
      expect(tablesUsed).not.toContain('social_accounts');
      expect(tablesUsed).not.toContain('destinations');
      expect(calls.some((c) => c.op === 'delete')).toBe(true);
      const eqArgs = calls.filter((c) => c.op === 'eq').map((c) => c.args);
      expect(eqArgs).toContainEqual(['workspace_id', WORKSPACE_ID]);
      expect(eqArgs).toContainEqual(['platform', platform]);
    });

    it('records a test result (status + last tested time)', async () => {
      const { supabase, calls, tablesUsed } = createRecordingSupabase(null);

      const result = await updateCredentialsTestResult(
        WORKSPACE_ID,
        platform,
        { status: 'valid', lastTestedAt: '2026-10-22T10:00:00Z' },
        supabase
      );

      expect(result.ok).toBe(true);
      expect(tablesUsed).toEqual(['platform_credentials']);
      const update = calls.find((c) => c.op === 'update');
      expect(update).toBeDefined();
      const patch = update!.args[0] as Record<string, unknown>;
      expect(patch.status).toBe('valid');
      expect(patch.last_tested_at).toBe('2026-10-22T10:00:00Z');
    });
  });

  describe.each(['youtube', 'x', 'tiktok'] as const)('non-BYOC platform: %s', (platform) => {
    it('refuses to save credentials', async () => {
      const { supabase, tablesUsed } = createRecordingSupabase(null);
      await expect(
        saveCredentials(WORKSPACE_ID, platform, { clientId: 'x', clientSecret: 'y-secret-value' }, supabase)
      ).rejects.toBeInstanceOf(UnsupportedPlatformError);
      expect(tablesUsed).toEqual([]);
    });

    it('refuses to read credentials', async () => {
      const { supabase, tablesUsed } = createRecordingSupabase(null);
      await expect(getCredentials(WORKSPACE_ID, platform, supabase)).rejects.toBeInstanceOf(
        UnsupportedPlatformError
      );
      expect(tablesUsed).toEqual([]);
    });

    it('refuses to delete credentials', async () => {
      const { supabase, tablesUsed } = createRecordingSupabase(null);
      await expect(deleteCredentials(WORKSPACE_ID, platform, supabase)).rejects.toBeInstanceOf(
        UnsupportedPlatformError
      );
      expect(tablesUsed).toEqual([]);
    });

    it('refuses to record a test result', async () => {
      const { supabase, tablesUsed } = createRecordingSupabase(null);
      await expect(
        updateCredentialsTestResult(WORKSPACE_ID, platform, { status: 'valid' }, supabase)
      ).rejects.toBeInstanceOf(UnsupportedPlatformError);
      expect(tablesUsed).toEqual([]);
    });
  });

  describe('legacy DatabaseClient path', () => {
    it('reads facebook credentials from platform_credentials via SQL', async () => {
      const encrypted = await encryptToken('legacy-secret-1', TEST_ENCRYPTION_KEY);
      const query = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM platform_credentials')) {
          return Promise.resolve([
            {
              workspace_id: WORKSPACE_ID,
              platform: 'facebook',
              client_id: 'legacy-app-id',
              encrypted_client_secret: encrypted,
              status: 'valid',
              last_tested_at: null,
              created_at: '2026-10-14T09:00:00Z',
              updated_at: '2026-10-14T09:00:00Z',
            },
          ]);
        }
        return Promise.resolve([]);
      });
      const legacyClient = { query } as unknown as DatabaseClient;

      const record = await getCredentials(WORKSPACE_ID, 'facebook', legacyClient);

      expect(record?.clientId).toBe('legacy-app-id');
      expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM platform_credentials'), [
        WORKSPACE_ID,
        'facebook',
      ]);
    });
  });
});
