import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  handleListCaptions,
  handleCreateCaption,
} from '../../src/app/api/tenant/[subdomain]/media/captions/route';
import {
  handleUpdateCaption,
  handleDeleteCaption,
} from '../../src/app/api/tenant/[subdomain]/media/captions/[captionId]/route';
import type { DatabaseClient } from '@fbuploadpro/database';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Caption Templates CRUD (T097, T098, T099)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const captionId = '22222222-2222-4222-a222-222222222222';
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

  describe('List Captions (GET /api/tenant/[subdomain]/media/captions)', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/captions');
      const res = await handleListCaptions(req, 'acme');
      expect(res.status).toBe(401);
    });

    it('returns caption templates for authenticated user', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([
          {
            id: captionId,
            user_id: userId,
            title: 'Summer Sale Promo',
            content: 'Get 50% off this weekend! #sale #deals',
            tags: ['promo', 'discount'],
            created_at: new Date('2026-10-07T10:00:00Z'),
            updated_at: new Date('2026-10-07T10:00:00Z'),
          },
        ]),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/captions', {
        headers: { cookie: validSessionCookie },
      });
      const res = await handleListCaptions(req, 'acme', mockDb as DatabaseClient);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].title).toBe('Summer Sale Promo');
      expect(data.templates[0].tags).toEqual(['promo', 'discount']);
    });
  });

  describe('Create Caption (POST /api/tenant/[subdomain]/media/captions)', () => {
    it('creates new caption template and returns 201 Created', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([
          {
            id: captionId,
            user_id: userId,
            title: 'New Product Launch',
            content: 'Introducing our latest product line!',
            tags: ['launch'],
            created_at: new Date('2026-10-07T10:00:00Z'),
            updated_at: new Date('2026-10-07T10:00:00Z'),
          },
        ]),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/captions', {
        method: 'POST',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({
          title: 'New Product Launch',
          content: 'Introducing our latest product line!',
          tags: ['launch'],
        }),
      });
      const res = await handleCreateCaption(req, 'acme', mockDb as DatabaseClient);

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(captionId);
      expect(data.title).toBe('New Product Launch');
    });

    it('rejects duplicate caption title with 409 Conflict', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockRejectedValue({ code: '23505' }),
      };

      const req = new NextRequest('http://localhost:3000/api/tenant/acme/media/captions', {
        method: 'POST',
        headers: { cookie: validSessionCookie },
        body: JSON.stringify({
          title: 'Duplicate Title',
          content: 'Duplicate content',
        }),
      });
      const res = await handleCreateCaption(req, 'acme', mockDb as DatabaseClient);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toBe('CAPTION_TITLE_ALREADY_EXISTS');
    });
  });

  describe('Update Caption (PATCH /api/tenant/[subdomain]/media/captions/[captionId])', () => {
    it('updates caption template and returns 200 OK', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([
          {
            id: captionId,
            user_id: userId,
            title: 'Updated Title',
            content: 'Updated content',
            tags: ['updated'],
            created_at: new Date('2026-10-07T10:00:00Z'),
            updated_at: new Date('2026-10-07T11:00:00Z'),
          },
        ]),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/media/captions/${captionId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ title: 'Updated Title', content: 'Updated content' }),
        }
      );
      const res = await handleUpdateCaption(req, 'acme', captionId, mockDb as DatabaseClient);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe('Updated Title');
    });

    it('returns 404 when caption is not found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/media/captions/${captionId}`,
        {
          method: 'PATCH',
          headers: { cookie: validSessionCookie },
          body: JSON.stringify({ title: 'Nonexistent' }),
        }
      );
      const res = await handleUpdateCaption(req, 'acme', captionId, mockDb as DatabaseClient);

      expect(res.status).toBe(404);
    });
  });

  describe('Delete Caption (DELETE /api/tenant/[subdomain]/media/captions/[captionId])', () => {
    it('deletes caption template and returns 200 OK', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([{ id: captionId }]),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/media/captions/${captionId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleDeleteCaption(req, 'acme', captionId, mockDb as DatabaseClient);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({
        success: true,
        deletedCaptionId: captionId,
      });
    });

    it('returns 404 when caption to delete is not found', async () => {
      const mockDb: Partial<DatabaseClient> = {
        query: vi.fn().mockResolvedValue([]),
      };

      const req = new NextRequest(
        `http://localhost:3000/api/tenant/acme/media/captions/${captionId}`,
        {
          method: 'DELETE',
          headers: { cookie: validSessionCookie },
        }
      );
      const res = await handleDeleteCaption(req, 'acme', captionId, mockDb as DatabaseClient);

      expect(res.status).toBe(404);
    });
  });
});
