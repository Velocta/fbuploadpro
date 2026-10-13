/**
 * @file workspaces-api.test.ts
 * @description Unit tests for Workspaces API routes and auto-generated subdomains (Spec 037).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { GET as listWorkspaces, POST as createWorkspace } from '../../src/app/api/workspaces/route';
import { POST as switchWorkspace } from '../../src/app/api/workspaces/switch/route';
import { getDbClient } from '@/lib/db';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Workspaces API Routes (Spec 037)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
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

  it('rejects unauthenticated requests to list or create workspaces', async () => {
    const getReq = new NextRequest('http://localhost:3000/api/workspaces');
    const getRes = await listWorkspaces(getReq);
    expect(getRes.status).toBe(401);

    const postReq = new NextRequest('http://localhost:3000/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alpha Agency' }),
    });
    const postRes = await createWorkspace(postReq);
    expect(postRes.status).toBe(401);
  });

  it('auto-generates unique subdomain using main subdomain and 4 random alphabets when creating workspace', async () => {
    const mockDb = {
      query: vi.fn(),
    };
    vi.spyOn(mockDb, 'query').mockImplementation(async (sql: string, params?: unknown[]) => {
      // 1. Resolve primary workspace
      if (sql.includes('SELECT subdomain FROM workspaces WHERE owner_id = $1')) {
        return [{ subdomain: 'acme' }];
      }
      // 2. Uniqueness check
      if (sql.includes('SELECT id FROM workspaces WHERE subdomain = $1 LIMIT 1')) {
        return [];
      }
      // 3. Insert workspace
      if (sql.includes('INSERT INTO workspaces')) {
        return [
          {
            id: 'ws-new-123',
            ownerId: userId,
            name: params?.[1] || 'Alpha Agency',
            subdomain: params?.[2] || 'acmexyza',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      return [];
    });

    const dbModule = await import('@/lib/db');
    vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as unknown as ReturnType<typeof getDbClient>);

    const req = new NextRequest('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers: {
        cookie: validSessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Alpha Agency' }),
    });

    const res = await createWorkspace(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.workspace.name).toBe('Alpha Agency');
    // Ensure subdomain starts with 'acme' and has 4-letter random suffix
    expect(json.workspace.subdomain).toMatch(/^acme[a-z]{4}$/);

    // Verify session cookie was updated
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain('fbup_session=');
  });

  it('rejects switching to a workspace not owned by the user', async () => {
    const mockDb = {
      query: vi.fn().mockResolvedValue([]),
    };
    const dbModule = await import('@/lib/db');
    vi.spyOn(dbModule, 'getDbClient').mockReturnValue(mockDb as unknown as ReturnType<typeof getDbClient>);

    const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
      method: 'POST',
      headers: {
        cookie: validSessionCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subdomain: 'unowned-slug' }),
    });

    const res = await switchWorkspace(req);
    expect(res.status).toBe(403);
  });
});
