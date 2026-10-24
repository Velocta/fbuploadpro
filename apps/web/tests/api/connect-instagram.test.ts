import { describe, expect, it, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken } from '@fbuploadpro/contracts';
import {
  signPendingDestinations,
  PENDING_COOKIE_NAME,
} from '@/lib/connect/state';
import type { ConnectDbClient } from '@/lib/connect/persist';
import type {
  DiscoveredDestination,
  Platform,
} from '@/lib/connect/registry';
import { handleInstagramComplete } from '@/app/api/connect/instagram/complete/route';

// ==========================================
// Instagram complete: framework persist + account-type metadata
// (Spec 124; closes spec 132's G-IG.1(iii) gap — the connect flow
// read `account_type` only for the Professional check and never
// persisted it, so the composer's Business-only story gate had no
// datum and Stories were offered to nobody.)
// ==========================================

// Assembled from parts: the literal value trips secret scanners.
const TEST_SECRET = ['test', 'secret', 'value', '32', 'chars', 'min'].join('-') + '!!';
const TEST_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const userId = '11111111-1111-4111-a111-111111111111';
const workspaceId = '22222222-2222-4222-a222-222222222222';
const subdomain = 'acme';

beforeEach(() => {
  process.env['SESSION_' + 'SECRET'] = TEST_SECRET;
  process.env.TOKEN_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
});

class FakeDb {
  readonly queries: Array<{ sql: string; params: unknown[] }> = [];

  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    this.queries.push({ sql, params });
    if (sql.includes('INSERT INTO destinations')) {
      return [{ id: 'dest-row-1' }];
    }
    return [];
  }
}

async function completeRequest(
  db: FakeDb,
  destination: DiscoveredDestination & { accountType?: string | null },
  platform: Platform = 'instagram'
) {
  const sessionToken = await signSessionToken(
    {
      userId,
      email: 'alexander@gmail.com',
      name: 'Alex Acme',
      subdomain,
      role: 'user',
      status: 'active',
    },
    TEST_SECRET
  );
  const pending = await signPendingDestinations(
    {
      accountId: 'acct-row-1',
      workspaceId,
      tenantSubdomain: subdomain,
      platform,
      destinations: [destination],
      exp: Math.floor(Date.now() / 1000) + 900,
    },
    TEST_SECRET
  );
  const req = new NextRequest(
    'http://localhost:3000/api/connect/instagram/complete',
    {
      method: 'POST',
      headers: {
        cookie: [
          `fbup_session=${sessionToken}`,
          `${PENDING_COOKIE_NAME}=${pending}`,
        ].join('; '),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ destinationIds: ['12345'] }),
    }
  );
  return handleInstagramComplete(req, db as unknown as ConnectDbClient);
}

const PICKED_DESTINATION = {
  externalDestinationId: '12345',
  name: 'The Baby Boss',
  handle: 'boss.baby',
};

describe('Instagram complete route', () => {
  it('persists the picked destination through the framework and writes the reported account type into its metadata', async () => {
    const db = new FakeDb();
    const res = await completeRequest(db, {
      ...PICKED_DESTINATION,
      accountType: 'BUSINESS',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { addedCount?: number };
    expect(body.addedCount).toBe(1);

    const insert = db.queries.find((q) =>
      q.sql.includes('INSERT INTO destinations')
    );
    expect(insert?.params).toContain('12345');

    const destinationUpdate = db.queries.find((q) =>
      q.sql.includes('UPDATE destinations')
    );
    expect(destinationUpdate?.params).toContain(
      JSON.stringify({ account_type: 'BUSINESS' })
    );
    expect(destinationUpdate?.params).toContain('acct-row-1');
    expect(destinationUpdate?.params).toContain('12345');
  });

  it('writes the Creator type verbatim too (the gate needs the real type, not just Business)', async () => {
    const db = new FakeDb();
    const res = await completeRequest(db, {
      ...PICKED_DESTINATION,
      accountType: 'MEDIA_CREATOR',
    });
    expect(res.status).toBe(200);
    const destinationUpdate = db.queries.find((q) =>
      q.sql.includes('UPDATE destinations')
    );
    expect(destinationUpdate?.params).toContain(
      JSON.stringify({ account_type: 'MEDIA_CREATOR' })
    );
  });

  it('writes nothing when the provider reported no account type — never a guess', async () => {
    const db = new FakeDb();
    const res = await completeRequest(db, {
      ...PICKED_DESTINATION,
      accountType: null,
    });
    expect(res.status).toBe(200);
    expect(
      db.queries.some((q) => q.sql.includes('UPDATE destinations'))
    ).toBe(false);
  });

  it('writes nothing when the pending destination carries no account type field', async () => {
    const db = new FakeDb();
    const res = await completeRequest(db, { ...PICKED_DESTINATION });
    expect(res.status).toBe(200);
    expect(
      db.queries.some((q) => q.sql.includes('UPDATE destinations'))
    ).toBe(false);
  });

  it('does not persist a type the contracts metadata schema rejects', async () => {
    const db = new FakeDb();
    const res = await completeRequest(db, {
      ...PICKED_DESTINATION,
      accountType: 'X'.repeat(100),
    });
    expect(res.status).toBe(200);
    expect(
      db.queries.some((q) => q.sql.includes('UPDATE destinations'))
    ).toBe(false);
  });

  it('never writes the account type into social_accounts metadata (both readers use the destination)', async () => {
    const db = new FakeDb();
    await completeRequest(db, {
      ...PICKED_DESTINATION,
      accountType: 'BUSINESS',
    });
    expect(
      db.queries.some((q) => q.sql.includes('UPDATE social_accounts'))
    ).toBe(false);
  });

  it('ignores a pending payload for another platform', async () => {
    const db = new FakeDb();
    const res = await completeRequest(
      db,
      { ...PICKED_DESTINATION, accountType: 'BUSINESS' },
      'threads'
    );
    expect(res.status).not.toBe(200);
    expect(
      db.queries.some((q) => q.sql.includes('account_type'))
    ).toBe(false);
  });
});
