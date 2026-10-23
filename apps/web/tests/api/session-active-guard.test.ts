import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  signSessionToken,
  verifySessionToken,
  type DatabaseClient,
} from '@fbuploadpro/contracts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleListMedia } from '../../src/app/api/tenant/[subdomain]/media/route';
import { handleListQueueItems } from '../../src/app/api/tenant/[subdomain]/publishing/queue/route';
import { handlePublishNow } from '../../src/app/api/tenant/[subdomain]/publishing/queue/[itemId]/publish-now/route';
import { GET as getByocSettings } from '../../src/app/api/tenant/[subdomain]/settings/byoc/route';
import {
  extractConnectSession,
  resolveSocialRouteContext,
} from '../../src/lib/connect/session';
import {
  authenticateTenantRoute,
  extractActiveSession,
} from '../../src/lib/route-auth';
import {
  _resetAuthStores,
  _seedTestUser,
  localUserStore,
} from '../../src/lib/auth/stores';
import { _setMockSupabaseServiceClient } from '../../src/lib/auth/clients';
import type { AuthUser } from '../../src/lib/auth/users';

const TEST_SECRET = 'spec139-session-guard-secret'.repeat(2);

/**
 * Spec 139 — session-active validation on tenant/connect routes.
 *
 * Regression coverage for the HIGH finding that only publish-now ran
 * validateSessionActive: a token snapshots status at issuance, so a
 * user suspended after issuance, a user deleted after issuance, and a
 * token issued before a password change must all be rejected by the
 * shared guards on every route — not just publish-now.
 */
describe('Session-active guard (spec 139)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const itemId = '55555555-5555-4555-a555-555555555555';
  const email = 'guarduser@gmail.com';

  let user: AuthUser;
  let token: string;
  let cookie: string;

  const mediaDb: Partial<DatabaseClient> = {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT COUNT(*)')) {
        return Promise.resolve([{ total: 1 }]);
      }
      return Promise.resolve([
        {
          id: '33333333-3333-4333-a333-333333333333',
          user_id: userId,
          folder_id: null,
          name: 'reel1.mp4',
          file_size: '10485760',
          mime_type: 'video/mp4',
          media_type: 'video',
          storage_key: `users/${userId}/media/33333333-3333-4333-a333-333333333333/reel1.mp4`,
          url: `https://media.fbuploadpro.com/users/${userId}/media/33333333-3333-4333-a333-333333333333/reel1.mp4`,
          thumbnail_key: `users/${userId}/thumbnails/33333333-3333-4333-a333-333333333333.webp`,
          thumbnail_url: `https://media.fbuploadpro.com/users/${userId}/thumbnails/33333333-3333-4333-a333-333333333333.webp`,
          duration_seconds: '30.00',
          aspect_ratio: '9:16',
          caption_text: 'Promo copy',
          created_at: new Date('2026-10-07T12:00:00Z'),
          updated_at: new Date('2026-10-07T12:00:00Z'),
        },
      ]);
    }),
  };

  const emptyDb: Partial<DatabaseClient> = {
    query: vi.fn().mockResolvedValue([]),
  };

  function mediaRequest(): NextRequest {
    return new NextRequest('http://localhost:3000/api/tenant/acme/media', {
      headers: { cookie },
    });
  }

  beforeEach(async () => {
    _resetAuthStores();
    process.env.SESSION_SECRET = TEST_SECRET;

    user = {
      id: userId,
      email,
      name: 'Guard User',
      phone: null,
      subdomain: 'acme',
      role: 'user',
      status: 'active',
    };
    await _seedTestUser(user);

    token = await signSessionToken(
      {
        userId,
        email,
        name: 'Guard User',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    cookie = `fbup_session=${token}`;
  });

  afterEach(() => {
    _resetAuthStores();
  });

  it('accepts an active user on a tenant route (media list)', async () => {
    const res = await handleListMedia(mediaRequest(), 'acme', mediaDb as DatabaseClient);
    expect(res.status).toBe(200);
  });

  it('rejects a user suspended AFTER token issuance on a tenant route (media list)', async () => {
    // Token snapshot still says "active" — only the live DB re-read sees this.
    user.status = 'suspended';
    const res = await handleListMedia(mediaRequest(), 'acme', mediaDb as DatabaseClient);
    expect(res.status).toBe(401);
  });

  it('rejects a suspended-after-issuance user on the publishing queue list', async () => {
    user.status = 'suspended';
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/publishing/queue', {
      headers: { cookie },
    });
    const res = await handleListQueueItems(req, 'acme', emptyDb as DatabaseClient);
    expect(res.status).toBe(401);
  });

  it('rejects a suspended-after-issuance user on tenant settings (BYOC)', async () => {
    user.status = 'suspended';
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/settings/byoc', {
      headers: { cookie },
    });
    const res = await getByocSettings(req, {
      params: Promise.resolve({ subdomain: 'acme' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a token issued before a password change (password rotation)', async () => {
    const session = await verifySessionToken(token, TEST_SECRET);
    user.passwordUpdatedAt = session.iat + 60;
    const res = await handleListMedia(mediaRequest(), 'acme', mediaDb as DatabaseClient);
    expect(res.status).toBe(401);
  });

  it('rejects a deleted user (record gone at re-validation time)', async () => {
    // With an admin client configured, a missing user record is a hard
    // rejection (the non-production local-store fallback does not apply).
    const emptyUsersClient = {
      from: () => ({
        select: () => ({
          or: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    _setMockSupabaseServiceClient(emptyUsersClient);
    localUserStore.clear();

    const res = await handleListMedia(mediaRequest(), 'acme', mediaDb as DatabaseClient);
    expect(res.status).toBe(401);
  });

  it('rejects a suspended-after-issuance user on connect routes (social context)', async () => {
    user.status = 'suspended';
    const req = new NextRequest('http://localhost:3000/api/tenant/acme/accounts/social', {
      headers: { cookie },
    });
    const context = await resolveSocialRouteContext(req, 'acme');
    expect(context.errorResponse?.status).toBe(401);

    const session = await extractConnectSession(req);
    expect(session).toBeNull();
  });

  it('accepts an active user through the connect session guard', async () => {
    const req = new NextRequest('http://localhost:3000/api/connect/facebook', {
      headers: { cookie },
    });
    const session = await extractConnectSession(req);
    expect(session?.userId).toBe(userId);
  });

  it('publish-now behaviour is unchanged: active passes auth, suspended is rejected', async () => {
    const activeReq = new NextRequest(
      `http://localhost:3000/api/tenant/acme/publishing/queue/${itemId}/publish-now`,
      { method: 'POST', headers: { cookie } }
    );
    const activeRes = await handlePublishNow(activeReq, 'acme', itemId, emptyDb as DatabaseClient);
    expect(activeRes.status).not.toBe(401);

    user.status = 'suspended';
    const suspendedReq = new NextRequest(
      `http://localhost:3000/api/tenant/acme/publishing/queue/${itemId}/publish-now`,
      { method: 'POST', headers: { cookie } }
    );
    const suspendedRes = await handlePublishNow(
      suspendedReq,
      'acme',
      itemId,
      emptyDb as DatabaseClient
    );
    expect(suspendedRes.status).toBe(401);
  });

  // Direct coverage of BOTH resolver entry points in lib/route-auth.ts
  // (the shared guard and the tenant-route resolver built on it):
  // suspended => unauthenticated from both; active => unchanged;
  // token-verification error => unchanged (still unauthenticated).
  it('resolver entry points: suspended user is unauthenticated from both', async () => {
    user.status = 'suspended';
    const req = mediaRequest();
    expect(await extractActiveSession(req)).toBeNull();
    const auth = await authenticateTenantRoute(req, 'acme');
    expect(auth.session).toBeUndefined();
    expect(auth.errorResponse?.status).toBe(401);
  });

  it('resolver entry points: active user is unchanged from both', async () => {
    const req = mediaRequest();
    const session = await extractActiveSession(req);
    expect(session?.userId).toBe(userId);
    const auth = await authenticateTenantRoute(req, 'acme');
    expect(auth.errorResponse).toBeUndefined();
    expect(auth.session?.userId).toBe(userId);
  });

  it('resolver entry points: invalid token (verification error) is unchanged from both', async () => {
    const badReq = new NextRequest('http://localhost:3000/api/tenant/acme/media', {
      headers: { cookie: 'fbup_session=not-a-valid-token' },
    });
    expect(await extractActiveSession(badReq)).toBeNull();
    const auth = await authenticateTenantRoute(badReq, 'acme');
    expect(auth.session).toBeUndefined();
    expect(auth.errorResponse?.status).toBe(401);

    const noCookieReq = new NextRequest('http://localhost:3000/api/tenant/acme/media');
    expect(await extractActiveSession(noCookieReq)).toBeNull();
    const noCookieAuth = await authenticateTenantRoute(noCookieReq, 'acme');
    expect(noCookieAuth.errorResponse?.status).toBe(401);
  });
});
