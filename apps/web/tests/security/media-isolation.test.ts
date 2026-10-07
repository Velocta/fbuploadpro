import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { handleListMedia } from '../../src/app/api/tenant/[subdomain]/media/route';
import {
  handleGetMedia,
  handleUpdateMedia,
  handleDeleteMedia,
} from '../../src/app/api/tenant/[subdomain]/media/[mediaId]/route';
import {
  handleUpdateFolder,
  handleDeleteFolder,
} from '../../src/app/api/tenant/[subdomain]/media/folders/[folderId]/route';
import {
  handleUpdateCaption,
  handleDeleteCaption,
} from '../../src/app/api/tenant/[subdomain]/media/captions/[captionId]/route';
import { handleGetQuota } from '../../src/app/api/tenant/[subdomain]/media/quota/route';
import { MockStorageProvider } from '../../src/lib/storage';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Multi-Tenant Media Security & Isolation Audit (T111)', () => {
  const userA = {
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
    subdomain: 'tenant-a',
    mediaId: '11111111-1111-4111-a111-111111111111',
    folderId: '22222222-2222-4222-a222-222222222222',
    captionId: '33333333-3333-4333-a333-333333333333',
  };

  const userB = {
    id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    subdomain: 'tenant-b',
    mediaId: '44444444-4444-4444-b444-444444444444',
  };

  let tokenCookieUserB: string;
  let mockStorage: MockStorageProvider;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    mockStorage = new MockStorageProvider();

    const tokenB = await signSessionToken(
      {
        userId: userB.id,
        email: 'bob@tenant-b.com',
        name: 'Bob Tenant B',
        subdomain: userB.subdomain,
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    tokenCookieUserB = `fbup_session=${tokenB}`;
  });

  describe('Route-Level Tenant Boundary Guards', () => {
    it('blocks User B from accessing Tenant A media list with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-a/media', {
        headers: { cookie: tokenCookieUserB },
      });
      const res = await handleListMedia(req, 'tenant-a');
      expect(res.status).toBe(403);
    });

    it('blocks User B from accessing Tenant A storage quota with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/tenant-a/media/quota', {
        headers: { cookie: tokenCookieUserB },
      });
      const res = await handleGetQuota(req, 'tenant-a');
      expect(res.status).toBe(403);
    });
  });

  describe('Object-Level IDOR Guards (Media Items)', () => {
    it('blocks User B from inspecting User A media asset by ID with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          // SQL query enforces WHERE id = $1 AND user_id = $2
          if (params && params[0] === userA.mediaId && params[1] === userB.id) {
            return Promise.resolve([]); // Not found under User B's ownership
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/${userA.mediaId}`,
        {
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handleGetMedia(req, 'tenant-b', userA.mediaId, mockDb as DatabaseClient);
      expect(res.status).toBe(404);
    });

    it('blocks User B from modifying User A media asset by ID with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((_sql: string, params?: any[]) => {
          if (params && params[0] === userA.mediaId && params[1] === userB.id) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/${userA.mediaId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB },
          body: JSON.stringify({ name: 'hijacked.mp4' }),
        }
      );
      const res = await handleUpdateMedia(req, 'tenant-b', userA.mediaId, mockDb as DatabaseClient);
      expect(res.status).toBe(404);
    });

    it('blocks User B from purging User A media asset with 404 Not Found and does not call storage purge', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((_sql: string, params?: any[]) => {
          if (params && params[0] === userA.mediaId && params[1] === userB.id) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/${userA.mediaId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const res = await handleDeleteMedia(
        req,
        'tenant-b',
        userA.mediaId,
        mockDb as DatabaseClient,
        mockStorage
      );
      expect(res.status).toBe(404);
      expect(mockStorage.deletedKeys.size).toBe(0);
    });
  });

  describe('Cross-Tenant Foreign Key Reference Tampering', () => {
    it('blocks User B from moving media into User A folder with 404 FOLDER_NOT_FOUND', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM media_items') && params && params[0] === userB.mediaId) {
            return Promise.resolve([{ id: userB.mediaId, user_id: userB.id }]);
          }
          if (sql.includes('FROM media_folders') && params && params[0] === userA.folderId) {
            // Folder belongs to User A, not User B!
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/${userB.mediaId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB },
          body: JSON.stringify({ folderId: userA.folderId }),
        }
      );
      const res = await handleUpdateMedia(req, 'tenant-b', userB.mediaId, mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('FOLDER_NOT_FOUND');
    });

    it('blocks User B from attaching User A caption template with 404 CAPTION_TEMPLATE_NOT_FOUND', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes('FROM media_items') && params && params[0] === userB.mediaId) {
            return Promise.resolve([{ id: userB.mediaId, user_id: userB.id }]);
          }
          if (sql.includes('FROM caption_templates') && params && params[0] === userA.captionId) {
            // Caption template belongs to User A, not User B!
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/${userB.mediaId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB },
          body: JSON.stringify({ captionTemplateId: userA.captionId }),
        }
      );
      const res = await handleUpdateMedia(req, 'tenant-b', userB.mediaId, mockDb as DatabaseClient);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('CAPTION_TEMPLATE_NOT_FOUND');
    });
  });

  describe('Container & Template IDOR Protection', () => {
    it('blocks User B from modifying or deleting User A folder with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const patchReq = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/folders/${userA.folderId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB },
          body: JSON.stringify({ name: 'Tampered' }),
        }
      );
      const patchRes = await handleUpdateFolder(
        patchReq,
        'tenant-b',
        userA.folderId,
        mockDb as DatabaseClient
      );
      expect(patchRes.status).toBe(404);

      const delReq = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/folders/${userA.folderId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const delRes = await handleDeleteFolder(
        delReq,
        'tenant-b',
        userA.folderId,
        mockDb as DatabaseClient
      );
      expect(delRes.status).toBe(404);
    });

    it('blocks User B from modifying or deleting User A caption template with 404 Not Found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const patchReq = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/captions/${userA.captionId}`,
        {
          method: 'PATCH',
          headers: { cookie: tokenCookieUserB },
          body: JSON.stringify({ title: 'Tampered' }),
        }
      );
      const patchRes = await handleUpdateCaption(
        patchReq,
        'tenant-b',
        userA.captionId,
        mockDb as DatabaseClient
      );
      expect(patchRes.status).toBe(404);

      const delReq = new NextRequest(
        `http://localhost:3000/api/tenant/tenant-b/media/captions/${userA.captionId}`,
        {
          method: 'DELETE',
          headers: { cookie: tokenCookieUserB },
        }
      );
      const delRes = await handleDeleteCaption(
        delReq,
        'tenant-b',
        userA.captionId,
        mockDb as DatabaseClient
      );
      expect(delRes.status).toBe(404);
    });
  });
});
