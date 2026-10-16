import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { encryptToken, signSessionToken } from '@fbuploadpro/contracts';
import { GET as getBYOC, PUT as saveBYOC, DELETE as deleteBYOC } from '@/app/api/tenant/[subdomain]/settings/byoc/route';
import { POST as testBYOC } from '@/app/api/tenant/[subdomain]/settings/byoc/test/route';
import * as authModule from '@/lib/supabase-auth';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Facebook BYOC Settings & Test API Routes', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const workspaceId = '22222222-2222-4222-a222-222222222222';
  const subdomain = 'acme';
  let validSessionCookie: string;
  let otherTenantSessionCookie: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.SESSION_SECRET = TEST_SECRET;
    process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

    const token = await signSessionToken(
      {
        userId,
        email: 'alexfounder@gmail.com',
        name: 'Alex Founder',
        subdomain,
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;

    const otherToken = await signSessionToken(
      {
        userId,
        email: 'alexfounder@gmail.com',
        name: 'Alex Founder',
        subdomain: 'other-brand',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    otherTenantSessionCookie = `fbup_session=${otherToken}`;
  });

  describe('GET /api/tenant/[subdomain]/settings/byoc', () => {
    it('returns 401 when request lacks authentication session', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`);
      const res = await getBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(401);
    });

    it('returns 403 when session subdomain does not match request tenant', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        headers: { cookie: otherTenantSessionCookie },
      });
      const res = await getBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(403);
    });

    it('returns 404 when workspace is not found for tenant', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'workspaces') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await getBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(404);
    });

    it('returns 200 with unverified status and empty fields when no BYOC credentials exist', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await getBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspaceId).toBe(workspaceId);
      expect(json.fbAppId).toBe('');
      expect(json.hasSecret).toBe(false);
      expect(json.status).toBe('unverified');
    });

    it('returns 200 with credentials info when BYOC is saved', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                      workspace_id: workspaceId,
                      fb_app_id: '123456789012345',
                      encrypted_fb_app_secret: 'enc_secret_abc',
                      status: 'valid',
                      last_tested_at: '2026-10-14T10:00:00Z',
                      created_at: '2026-10-14T09:00:00Z',
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        headers: { cookie: validSessionCookie },
      });
      const res = await getBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.workspaceId).toBe(workspaceId);
      expect(json.fbAppId).toBe('123456789012345');
      expect(json.hasSecret).toBe(true);
      expect(json.status).toBe('valid');
      expect(json.lastTestedAt).toBe('2026-10-14T10:00:00Z');
      expect(json.connectedAt).toBe('2026-10-14T09:00:00Z');
    });
  });

  describe('PUT /api/tenant/[subdomain]/settings/byoc', () => {
    it('returns 400 when request body fails validation', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'PUT',
        headers: { cookie: validSessionCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbAppId: '' }),
      });
      const res = await saveBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(400);
    });

    it('returns 400 when omitting secret on first-time setup without existing secret', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'PUT',
        headers: { cookie: validSessionCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbAppId: '123456789012345' }),
      });
      const res = await saveBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Enter your Facebook App Secret');
    });

    it('returns 200 and encrypts secret when saving new credentials', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
              upsert: upsertMock,
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'PUT',
        headers: { cookie: validSessionCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fbAppId: '123456789012345',
          fbAppSecret: 'super_secret_fb_key_999',
        }),
      });
      const res = await saveBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.hasSecret).toBe(true);
      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: workspaceId,
          user_id: userId,
          fb_app_id: '123456789012345',
          status: 'unverified',
        }),
        { onConflict: 'workspace_id' }
      );
    });

    it('returns 200 when updating fbAppId without changing existing secret', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                    data: { encrypted_fb_app_secret: 'already_encrypted' },
                    error: null,
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'PUT',
        headers: { cookie: validSessionCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fbAppId: '987654321098765' }),
      });
      const res = await saveBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          fb_app_id: '987654321098765',
          status: 'unverified',
        })
      );
    });
  });

  describe('POST /api/tenant/[subdomain]/settings/byoc/test', () => {
    it('returns 400 when no credentials are configured for workspace', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc/test`, {
        method: 'POST',
        headers: { cookie: validSessionCookie },
      });
      const res = await testBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(400);
    });

    it('returns 200 with status valid when Meta Graph API accepts credentials', async () => {
      const encryptedSecret = await encryptToken('raw_app_secret_123', TEST_ENCRYPTION_KEY);
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                      workspace_id: workspaceId,
                      fb_app_id: '123456789012345',
                      encrypted_fb_app_secret: encryptedSecret,
                    },
                    error: null,
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ id: '123456789012345', name: 'My Production FB App' }),
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc/test`, {
        method: 'POST',
        headers: { cookie: validSessionCookie },
      });
      const res = await testBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.status).toBe('valid');
      expect(json.appName).toBe('My Production FB App');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'valid',
        })
      );
    });

    it('returns 200 with status invalid when Meta Graph API rejects credentials', async () => {
      const encryptedSecret = await encryptToken('raw_app_secret_123', TEST_ENCRYPTION_KEY);
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const mockSupabase = {
        from: vi.fn((table: string) => {
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
                      workspace_id: workspaceId,
                      fb_app_id: '123456789012345',
                      encrypted_fb_app_secret: encryptedSecret,
                    },
                    error: null,
                  }),
                }),
              }),
              update: updateMock,
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          json: async () => ({ error: { message: 'Invalid client secret' } }),
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc/test`, {
        method: 'POST',
        headers: { cookie: validSessionCookie },
      });
      const res = await testBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.status).toBe('invalid');
      expect(json.message).toBe('Invalid client secret');
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'invalid',
        })
      );
    });
  });

  describe('DELETE /api/tenant/[subdomain]/settings/byoc', () => {
    it('returns 401 when request lacks authentication session', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'DELETE',
      });
      const res = await deleteBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(401);
    });

    it('returns 403 when session subdomain does not match request tenant', async () => {
      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'DELETE',
        headers: { cookie: otherTenantSessionCookie },
      });
      const res = await deleteBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(403);
    });

    it('returns 404 when workspace is not found for tenant', async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === 'workspaces') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await deleteBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(404);
    });

    it('returns 200 with success when deleting credentials from workspace_byoc_credentials', async () => {
      const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
      const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock });
      const mockSupabase = {
        from: vi.fn((table: string) => {
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
              delete: deleteMock,
            };
          }
          return {};
        }),
      };
      vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

      const req = new NextRequest(`http://localhost:3000/api/tenant/${subdomain}/settings/byoc`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await deleteBYOC(req, { params: Promise.resolve({ subdomain }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.disconnected).toBe(true);
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(deleteEqMock).toHaveBeenCalledWith('workspace_id', workspaceId);
    });
  });
});

