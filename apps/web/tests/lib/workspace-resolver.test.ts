import { describe, expect, it, vi } from 'vitest';
import { resolveTenantWorkspaceId } from '@/lib/server/workspace-resolver';
import type { DatabaseClient } from '@fbuploadpro/contracts';

describe('resolveTenantWorkspaceId helper suite', () => {
  const subdomain = 'alpha';
  const userId = '11111111-1111-4111-a111-111111111111';
  const workspaceId = '22222222-2222-4222-a222-222222222222';

  describe('Legacy DatabaseClient path', () => {
    it('returns workspace id when row exists', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockResolvedValue([{ id: workspaceId }]),
      } as unknown as DatabaseClient;

      const result = await resolveTenantWorkspaceId(mockLegacyClient, subdomain, userId);
      expect(result).toBe(workspaceId);
      expect(mockLegacyClient.query).toHaveBeenCalledWith(
        'SELECT id FROM workspaces WHERE subdomain = $1 AND owner_id = $2 LIMIT 1',
        [subdomain, userId]
      );
    });

    it('returns null when no row is found', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockResolvedValue([]),
      } as unknown as DatabaseClient;

      const result = await resolveTenantWorkspaceId(mockLegacyClient, subdomain, userId);
      expect(result).toBeNull();
    });

    it('omits owner_id check when role is admin', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockResolvedValue([{ id: workspaceId }]),
      } as unknown as DatabaseClient;

      const result = await resolveTenantWorkspaceId(mockLegacyClient, subdomain, userId, 'admin');
      expect(result).toBe(workspaceId);
      expect(mockLegacyClient.query).toHaveBeenCalledWith(
        'SELECT id FROM workspaces WHERE subdomain = $1 LIMIT 1',
        [subdomain]
      );
    });

    it('returns null when query throws an exception', async () => {
      const mockLegacyClient = {
        query: vi.fn().mockRejectedValue(new Error('DB failure')),
      } as unknown as DatabaseClient;

      const result = await resolveTenantWorkspaceId(mockLegacyClient, subdomain, userId);
      expect(result).toBeNull();
    });
  });

  describe('Supabase Client path', () => {
    it('returns workspace id when record exists', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: workspaceId }, error: null });
      const eqOwnerMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqSubdomainMock = vi.fn().mockReturnValue({ eq: eqOwnerMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqSubdomainMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      const mockSupabase = {
        from: fromMock,
      } as any;

      const result = await resolveTenantWorkspaceId(mockSupabase, subdomain, userId);
      expect(result).toBe(workspaceId);
      expect(fromMock).toHaveBeenCalledWith('workspaces');
      expect(selectMock).toHaveBeenCalledWith('id');
      expect(eqSubdomainMock).toHaveBeenCalledWith('subdomain', subdomain);
      expect(eqOwnerMock).toHaveBeenCalledWith('owner_id', userId);
    });

    it('omits owner_id check when role is admin', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: workspaceId }, error: null });
      const eqSubdomainMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqSubdomainMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      const mockSupabase = {
        from: fromMock,
      } as any;

      const result = await resolveTenantWorkspaceId(mockSupabase, subdomain, userId, 'admin');
      expect(result).toBe(workspaceId);
      expect(fromMock).toHaveBeenCalledWith('workspaces');
      expect(selectMock).toHaveBeenCalledWith('id');
      expect(eqSubdomainMock).toHaveBeenCalledWith('subdomain', subdomain);
    });

    it('returns null when supabase returns an error or empty data', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      const eqOwnerMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const eqSubdomainMock = vi.fn().mockReturnValue({ eq: eqOwnerMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqSubdomainMock });
      const fromMock = vi.fn().mockReturnValue({ select: selectMock });

      const mockSupabase = {
        from: fromMock,
      } as any;

      const result = await resolveTenantWorkspaceId(mockSupabase, subdomain, userId);
      expect(result).toBeNull();
    });

    it('returns null when supabase throws an exception', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Supabase network error');
        }),
      } as any;

      const result = await resolveTenantWorkspaceId(mockSupabase, subdomain, userId);
      expect(result).toBeNull();
    });
  });

  describe('Null or unconfigured client', () => {
    it('returns null when client is null and route supabase is not available', async () => {
      const result = await resolveTenantWorkspaceId(null, subdomain, userId);
      expect(result).toBeNull();
    });
  });
});
