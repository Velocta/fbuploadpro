import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken, type DatabaseClient } from '@fbuploadpro/contracts';
import {
  handleListPrompts,
  handleCreatePrompt,
} from '../../src/app/api/tenant/[subdomain]/prompts/route';
import {
  handleUpdatePrompt,
  handleDeletePrompt,
} from '../../src/app/api/tenant/[subdomain]/prompts/[promptId]/route';

const TEST_SECRET = 'test-session-secret-not-for-production';

const ownerId = '11111111-1111-4111-a111-111111111111';
const otherId = '99999999-9999-4999-a999-999999999999';

interface PromptRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  updated_at: string;
}

function uuidFor(seq: number): string {
  return `aaaaaaaa-aaaa-4aaa-aaaa-${String(seq).padStart(12, '0')}`;
}

/** In-memory DatabaseClient fake keyed on the SQL the handlers emit. */
class FakeDb {
  rows: PromptRow[] = [];
  private seq = 0;

  query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT COUNT(*)')) {
      const userId = String(params[0]);
      return [{ prompt_count: this.rows.filter((r) => r.user_id === userId).length }];
    }
    if (sql.startsWith('SELECT id, user_id, title, body, category')) {
      const userId = String(params[0]);
      return [...this.rows]
        .filter((r) => r.user_id === userId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    if (sql.includes('INSERT INTO user_prompts')) {
      this.seq += 1;
      const now = new Date().toISOString();
      const row: PromptRow = {
        id: uuidFor(this.seq),
        user_id: String(params[0]),
        title: String(params[1]),
        body: String(params[2]),
        category: String(params[3]),
        created_at: now,
        updated_at: now,
      };
      this.rows.push(row);
      return [row];
    }
    if (sql.includes('UPDATE user_prompts SET')) {
      // params[0] = userId, middle params = SET values in SQL order, last = id.
      const assignments = [...sql.matchAll(/(\w+) = \$(\d+)/g)];
      const userId = String(params[0]);
      const id = String(params[params.length - 1]);
      const row = this.rows.find((r) => r.id === id && r.user_id === userId);
      if (!row) return [];
      for (const [, column, index] of assignments) {
        if (column === 'updated_at') continue;
        (row as unknown as Record<string, unknown>)[column] = params[Number(index) - 1];
      }
      row.updated_at = new Date().toISOString();
      return [row];
    }
    if (sql.includes('DELETE FROM user_prompts')) {
      const userId = String(params[0]);
      const id = String(params[1]);
      const index = this.rows.findIndex((r) => r.id === id && r.user_id === userId);
      if (index === -1) return [];
      const [deleted] = this.rows.splice(index, 1);
      return [deleted];
    }
    return [];
  });
}

function seedPrompt(
  db: FakeDb,
  overrides: Partial<PromptRow> = {}
): PromptRow {
  const row: PromptRow = {
    id: uuidFor(900 + db.rows.length),
    user_id: ownerId,
    title: 'Seeded prompt',
    body: 'Seeded prompt body.',
    category: 'hooks',
    created_at: '2026-10-20T10:00:00.000Z',
    updated_at: '2026-10-20T10:00:00.000Z',
    ...overrides,
  };
  db.rows.push(row);
  return row;
}

describe('Prompt Library API (spec 144)', () => {
  let ownerCookie: string;
  let otherCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SECRET;
    ownerCookie = `fbup_session=${await signSessionToken(
      { userId: ownerId, email: 'owneruser@gmail.com', name: 'Owner', subdomain: 'acme', role: 'user', status: 'active' },
      TEST_SECRET
    )}`;
    otherCookie = `fbup_session=${await signSessionToken(
      { userId: otherId, email: 'otheruser@gmail.com', name: 'Other', subdomain: 'acme', role: 'user', status: 'active' },
      TEST_SECRET
    )}`;
  });

  const getReq = (cookie?: string) =>
    new NextRequest('http://localhost:3000/api/tenant/acme/prompts', {
      headers: cookie ? { cookie } : {},
    });

  const postReq = (body: unknown, cookie?: string) =>
    new NextRequest('http://localhost:3000/api/tenant/acme/prompts', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  const patchReq = (body: unknown, cookie?: string) =>
    new NextRequest('http://localhost:3000/api/tenant/acme/prompts/x', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  const deleteReq = (cookie?: string) =>
    new NextRequest('http://localhost:3000/api/tenant/acme/prompts/x', {
      method: 'DELETE',
      headers: cookie ? { cookie } : {},
    });

  it('rejects unauthenticated requests with 401', async () => {
    const db = new FakeDb();
    expect((await handleListPrompts(getReq(), 'acme', db as unknown as DatabaseClient)).status).toBe(401);
    expect((await handleCreatePrompt(postReq({ title: 'T', body: 'B', category: 'hooks' }), 'acme', db as unknown as DatabaseClient)).status).toBe(401);
  });

  it('rejects a session for a different tenant with 403', async () => {
    const db = new FakeDb();
    const res = await handleListPrompts(getReq(ownerCookie), 'other-tenant', db as unknown as DatabaseClient);
    expect(res.status).toBe(403);
  });

  it('lists curated prompts plus only the owner personal rows', async () => {
    const db = new FakeDb();
    seedPrompt(db, { title: 'Mine' });
    seedPrompt(db, { user_id: otherId, title: 'Not mine' });
    const res = await handleListPrompts(getReq(ownerCookie), 'acme', db as unknown as DatabaseClient);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.curated).toHaveLength(42);
    expect(data.personal).toHaveLength(1);
    expect(data.personal[0].title).toBe('Mine');
    expect(data.personal[0].userId).toBe(ownerId);
  });

  it('creates a prompt owned by the session user (never the body)', async () => {
    const db = new FakeDb();
    const res = await handleCreatePrompt(
      postReq({ title: 'My hook', body: 'Write a hook.', category: 'hooks', userId: otherId }, ownerCookie),
      'acme',
      db as unknown as DatabaseClient
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.userId).toBe(ownerId);
    expect(data.title).toBe('My hook');
    expect(db.rows).toHaveLength(1);
  });

  it('rejects invalid creates with 400', async () => {
    const db = new FakeDb();
    const client = db as unknown as DatabaseClient;
    for (const body of [
      { title: '', body: 'B', category: 'hooks' },
      { title: 'T', body: '', category: 'hooks' },
      { title: 'T', body: 'B', category: 'nope' },
      { title: 'x'.repeat(101), body: 'B', category: 'hooks' },
      { title: 'T', body: 'x'.repeat(4001), category: 'hooks' },
    ]) {
      const res = await handleCreatePrompt(postReq(body, ownerCookie), 'acme', client);
      expect(res.status).toBe(400);
    }
    expect(db.rows).toHaveLength(0);
  });

  it('rejects creates at the 200-prompt cap with 409', async () => {
    const db = new FakeDb();
    for (let i = 0; i < 200; i += 1) {
      seedPrompt(db, { id: uuidFor(1000 + i) });
    }
    const res = await handleCreatePrompt(
      postReq({ title: 'One more', body: 'Body', category: 'hooks' }, ownerCookie),
      'acme',
      db as unknown as DatabaseClient
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe('PROMPT_LIMIT_REACHED');
  });

  it('updates an owned prompt and persists the change', async () => {
    const db = new FakeDb();
    const row = seedPrompt(db);
    const res = await handleUpdatePrompt(
      patchReq({ title: 'Edited title' }, ownerCookie),
      'acme',
      row.id,
      db as unknown as DatabaseClient
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe('Edited title');
    expect(data.body).toBe('Seeded prompt body.');
    expect(db.rows[0]?.title).toBe('Edited title');
  });

  it('returns 404 (not 403) when updating another user prompt', async () => {
    const db = new FakeDb();
    const row = seedPrompt(db, { user_id: otherId });
    const res = await handleUpdatePrompt(
      patchReq({ title: 'Hijack' }, ownerCookie),
      'acme',
      row.id,
      db as unknown as DatabaseClient
    );
    expect(res.status).toBe(404);
    expect(db.rows[0]?.title).toBe('Seeded prompt');
  });

  it('rejects empty updates with 400', async () => {
    const db = new FakeDb();
    const row = seedPrompt(db);
    const res = await handleUpdatePrompt(
      patchReq({}, ownerCookie),
      'acme',
      row.id,
      db as unknown as DatabaseClient
    );
    expect(res.status).toBe(400);
  });

  it('deletes an owned prompt; a second delete returns 404', async () => {
    const db = new FakeDb();
    const row = seedPrompt(db);
    const client = db as unknown as DatabaseClient;
    const first = await handleDeletePrompt(deleteReq(ownerCookie), 'acme', row.id, client);
    expect(first.status).toBe(200);
    expect((await first.json()).deletedPromptId).toBe(row.id);
    expect(db.rows).toHaveLength(0);
    const second = await handleDeletePrompt(deleteReq(ownerCookie), 'acme', row.id, client);
    expect(second.status).toBe(404);
  });

  it('returns 404 when deleting another user prompt', async () => {
    const db = new FakeDb();
    const row = seedPrompt(db, { user_id: otherId });
    const res = await handleDeletePrompt(
      deleteReq(ownerCookie),
      'acme',
      row.id,
      db as unknown as DatabaseClient
    );
    expect(res.status).toBe(404);
    expect(db.rows).toHaveLength(1);
  });
});
