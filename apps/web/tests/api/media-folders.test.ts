import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  handleListFolders,
  handleCreateFolder,
} from '../../src/app/api/tenant/[subdomain]/media/folders/route';
import {
  handleUpdateFolder,
  handleDeleteFolder,
} from '../../src/app/api/tenant/[subdomain]/media/folders/[folderId]/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Custom Media Folders CRUD & Non-Destructive Deletion (T092, T094, T095)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const folderId = '22222222-2222-4222-a222-222222222222';
  let validSessionCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;

    const token = await signSessionToken(
      {
        userId,
        email: 'alex@acme.com',
        name: 'Alex Acme',
        subdomain: 'acme',
        role: 'user',
        status: 'active',
      },
      TEST_SECRET
    );
    validSessionCookie = `fbup_session=${token}`;
  });

  describe('List Folders (GET /api/tenant/[subdomain]/media/folders)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/folders');
      const res = await handleListFolders(req, 'acme');
      expect(res.status).toBe(401);
    });

    it('returns folders with item counts and unorganized count', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('FROM media_folders')) {
            return Promise.resolve([
              {
                id: folderId,
                user_id: userId,
                name: 'Spring Campaigns',
                color: 'emerald',
                item_count: 8,
                created_at: new Date('2026-10-07T10:00:00Z'),
                updated_at: new Date('2026-10-07T10:00:00Z'),
              },
            ]);
          }
          if (sql.includes('folder_id IS NULL')) {
            return Promise.resolve([{ unorganized_count: 3 }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/folders', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleListFolders(req, 'acme', mockDb as DatabaseClient);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.folders).toHaveLength(1);
      expect(data.folders[0].name).toBe('Spring Campaigns');
      expect(data.folders[0].itemCount).toBe(8);
      expect(data.unorganizedCount).toBe(3);
    });
  });

  describe('Create Folder (POST /api/tenant/[subdomain]/media/folders)', () => {
    it('creates new folder with default color and returns 201 Created', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('INSERT INTO media_folders')) {
            return Promise.resolve([
              {
                id: folderId,
                user_id: userId,
                name: 'Product Launches',
                color: 'slate',
                created_at: new Date('2026-10-07T10:00:00Z'),
                updated_at: new Date('2026-10-07T10:00:00Z'),
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/folders', {
        method: 'POST',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({ name: 'Product Launches' }),
      });
      const res = await handleCreateFolder(req, 'acme', mockDb as DatabaseClient);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(folderId);
      expect(data.name).toBe('Product Launches');
      expect(data.color).toBe('slate');
      expect(data.itemCount).toBe(0);
    });

    it('rejects duplicate folder name with 409 Conflict', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockRejectedValue({ code: '23505' }), // PostgreSQL unique violation
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/folders', {
        method: 'POST',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({ name: 'Product Launches' }),
      });
      const res = await handleCreateFolder(req, 'acme', mockDb as DatabaseClient);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('FOLDER_NAME_ALREADY_EXISTS');
    });
  });

  describe('Update Folder (PATCH /api/tenant/[subdomain]/media/folders/[folderId])', () => {
    it('updates folder name and color', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('UPDATE media_folders')) {
            return Promise.resolve([
              {
                id: folderId,
                user_id: userId,
                name: 'Renamed Folder',
                color: 'blue',
                created_at: new Date('2026-10-07T10:00:00Z'),
                updated_at: new Date('2026-10-07T11:00:00Z'),
              },
            ]);
          }
          if (sql.includes('COUNT(*)::int AS item_count')) {
            return Promise.resolve([{ item_count: 5 }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/folders/${folderId}`, {
        method: 'PATCH',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({ name: 'Renamed Folder', color: 'blue' }),
      });
      const res = await handleUpdateFolder(req, 'acme', folderId, mockDb as DatabaseClient);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Renamed Folder');
      expect(data.color).toBe('blue');
      expect(data.itemCount).toBe(5);
    });

    it('returns 404 when folder is not found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/folders/${folderId}`, {
        method: 'PATCH',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({ name: 'Nonexistent' }),
      });
      const res = await handleUpdateFolder(req, 'acme', folderId, mockDb as DatabaseClient);

      expect(res.status).toBe(404);
    });
  });

  describe('Delete Folder Non-Destructively (DELETE /api/tenant/[subdomain]/media/folders/[folderId])', () => {
    it('deletes folder, counts preserved items, and returns 200 OK', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('COUNT(*)::int AS preserved_count')) {
            return Promise.resolve([{ preserved_count: 12 }]);
          }
          if (sql.includes('DELETE FROM media_folders')) {
            return Promise.resolve([{ id: folderId }]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/folders/${folderId}`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await handleDeleteFolder(req, 'acme', folderId, mockDb as DatabaseClient);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        deletedFolderId: folderId,
        preservedItemsCount: 12,
      });
    });

    it('returns 404 if folder to delete does not exist', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('COUNT(*)::int AS preserved_count')) {
            return Promise.resolve([{ preserved_count: 0 }]);
          }
          if (sql.includes('DELETE FROM media_folders')) {
            return Promise.resolve([]);
          }
          return Promise.resolve([]);
        }),
      };

      const req = new NextRequest(`http://localhost:3000/api/tenant/acme/media/folders/${folderId}`, {
        method: 'DELETE',
        headers: { cookie: validSessionCookie },
      });
      const res = await handleDeleteFolder(req, 'acme', folderId, mockDb as DatabaseClient);

      expect(res.status).toBe(404);
    });
  });
});
