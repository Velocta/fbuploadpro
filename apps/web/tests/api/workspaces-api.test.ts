/**
 * @file workspaces-api.test.ts
 * @description Unit tests for Workspaces API routes and auto-generated subdomains via Supabase PostgREST (Spec 037).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { GET as listWorkspaces, POST as createWorkspace } from '../../src/app/api/workspaces/route';
import { POST as switchWorkspace } from '../../src/app/api/workspaces/switch/route';
import * as authModule from '@/lib/supabase-auth';

const TEST_SECRET = 'super-secret-session-signing-key-minimum-32-chars-long';

describe('Workspaces API Routes (Spec 037 Supabase PostgREST)', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  let validSessionCookie: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
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
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((col: string) => {
                if (col === 'owner_id') {
                  return {
                    order: vi.fn(() => ({
                      limit: vi.fn(() =>
                        Promise.resolve({
                          data: [{ subdomain: 'acme' }],
                          error: null,
                        })
                      ),
                    })),
                  };
                }
                if (col === 'subdomain') {
                  return {
                    maybeSingle: vi.fn(() =>
                      Promise.resolve({
                        data: null,
                        error: null,
                      })
                    ),
                  };
                }
                return {
                  maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
                };
              }),
            })),
            insert: vi.fn((values: { name: string; subdomain: string }) => ({
              select: vi.fn(() => ({
                single: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      id: 'ws-new-123',
                      owner_id: userId,
                      name: values.name,
                      subdomain: values.subdomain,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  })
                ),
              })),
            })),
          };
        }
        return {};
      }),
    };

    vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

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
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
    };

    vi.spyOn(authModule, 'getSupabaseClient').mockReturnValue(mockSupabase as any);

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
