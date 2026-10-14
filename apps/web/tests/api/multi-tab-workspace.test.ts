import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import { getServerSessionContext } from '@/lib/auth';
import { GET as getPages } from '@/app/api/tenant/[subdomain]/pages/route';
import { GET as getAccounts } from '@/app/api/tenant/[subdomain]/accounts/route';

describe('Multi-Workspace Multi-Tab Operations (ISSUE-23)', () => {
  const secret = 'super-secret-session-signing-key-minimum-32-chars-long';

  it('getServerSessionContext preserves allowedSubdomains from session token', async () => {
    const token = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'user@gmail.com',
        name: 'Workspace Owner',
        subdomain: 'workspace-a',
        allowedSubdomains: ['workspace-a', 'workspace-b'],
        role: 'user',
        status: 'active',
      },
      secret
    );

    const req = new NextRequest('http://localhost:3000/api/tenant/workspace-b/pages', {
      headers: { cookie: `fbup_session=${token}` },
    });

    const session = await getServerSessionContext(req);
    expect(session).not.toBeNull();
    expect(session?.allowedSubdomains).toEqual(['workspace-a', 'workspace-b']);
  });

  it('authorizes route handlers when requested subdomain is in session.allowedSubdomains despite session.subdomain differing', async () => {
    // Session is currently set to workspace-a, but user also owns workspace-b
    const token = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'user@gmail.com',
        name: 'Workspace Owner',
        subdomain: 'workspace-a',
        allowedSubdomains: ['workspace-a', 'workspace-b'],
        role: 'user',
        status: 'active',
      },
      secret
    );

    // Tab 2 makes requests to workspace-b while cookie still points to workspace-a
    const reqPages = new NextRequest('http://localhost:3000/api/tenant/workspace-b/pages', {
      headers: { cookie: `fbup_session=${token}` },
    });
    const resPages = await getPages(reqPages, {
      params: Promise.resolve({ subdomain: 'workspace-b' }),
    });
    expect(resPages.status).not.toBe(403);

    const reqAccounts = new NextRequest('http://localhost:3000/api/tenant/workspace-b/accounts', {
      headers: { cookie: `fbup_session=${token}` },
    });
    const resAccounts = await getAccounts(reqAccounts, {
      params: Promise.resolve({ subdomain: 'workspace-b' }),
    });
    expect(resAccounts.status).not.toBe(403);
  });

  it('allows concurrent dual-tab operations without cookie mutation causing 403 in the other tab', async () => {
    const token = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'user@gmail.com',
        name: 'Workspace Owner',
        subdomain: 'workspace-a',
        allowedSubdomains: ['workspace-a', 'workspace-b'],
        role: 'user',
        status: 'active',
      },
      secret
    );

    // Tab 1 requesting workspace-a and Tab 2 requesting workspace-b simultaneously
    const tab1Req = new NextRequest('http://localhost:3000/api/tenant/workspace-a/pages', {
      headers: { cookie: `fbup_session=${token}` },
    });
    const tab2Req = new NextRequest('http://localhost:3000/api/tenant/workspace-b/pages', {
      headers: { cookie: `fbup_session=${token}` },
    });

    const [tab1Res, tab2Res] = await Promise.all([
      getPages(tab1Req, { params: Promise.resolve({ subdomain: 'workspace-a' }) }),
      getPages(tab2Req, { params: Promise.resolve({ subdomain: 'workspace-b' }) }),
    ]);

    expect(tab1Res.status).not.toBe(403);
    expect(tab2Res.status).not.toBe(403);
  });

  it('rejects with 403 Forbidden when requested subdomain is neither session.subdomain nor in allowedSubdomains', async () => {
    const token = await signSessionToken(
      {
        userId: '11111111-1111-4111-a111-111111111111',
        email: 'user@gmail.com',
        name: 'Workspace Owner',
        subdomain: 'workspace-a',
        allowedSubdomains: ['workspace-a', 'workspace-b'],
        role: 'user',
        status: 'active',
      },
      secret
    );

    const reqPages = new NextRequest('http://localhost:3000/api/tenant/unauthorized-workspace/pages', {
      headers: {
        cookie: `fbup_session=${token}`,
      },
    });

    const contextPages = {
      params: Promise.resolve({ subdomain: 'unauthorized-workspace' }),
    };

    const resPages = await getPages(reqPages, contextPages);
    expect(resPages.status).toBe(403);
  });
});
