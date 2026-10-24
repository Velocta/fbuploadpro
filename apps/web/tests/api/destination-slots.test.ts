import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signSessionToken, type DatabaseClient } from '@fbuploadpro/contracts';
import {
  handleCreateDestinationPostingSlot,
  handleListDestinationPostingSlots,
  handleUpdateDestinationTimezone,
} from '@/app/api/tenant/[subdomain]/destinations/[destinationId]/posting-slots/route';
import {
  handleDeleteDestinationPostingSlot,
  handleUpdateDestinationPostingSlot,
} from '@/app/api/tenant/[subdomain]/destinations/[destinationId]/posting-slots/[slotId]/route';

/**
 * Destination posting-slots writes (spec 134 PR-134-3, T24): create /
 * update / delete beside the #756 read, plus the destination timezone
 * write on the collection PATCH (the legacy slots route's shape).
 * Duplicate times surface the UNIQUE(destination_id, time_of_day)
 * constraint (#753) as a plain-language 409.
 */

const TEST_SECRET = ['destination','slots','test','secret','key'].join('-');

const userId = '11111111-1111-4111-a111-111111111111';
const workspaceId = '22222222-2222-4222-a222-222222222222';
const otherWorkspaceId = '55555555-5555-4555-a555-555555555555';
const subdomain = 'acme';

const igDestinationId = '33333333-3333-4333-a333-333333333333';
const foreignDestinationId = '88888888-8888-4888-a888-888888888888';
const slotId = '56565656-5656-4565-a656-565656565656';
const secondSlotId = '67676767-6767-4676-a767-676767676767';

interface DestinationRow {
  id: string;
  workspace_id: string;
  platform: string;
  timezone: string;
  status: string;
  rate_usage_pct: number;
  next_allowed_publish_at: string | null;
  metadata: Record<string, unknown> | null;
}

interface SlotRow {
  id: string;
  destination_id: string;
  kind: string[];
  time_of_day: string;
  is_active: boolean;
}

class FakeDb {
  destinations = new Map<string, DestinationRow>();
  slots: SlotRow[] = [];
  private seq = 0;

  query = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM workspaces')) {
      return params[0] === subdomain ? [{ id: workspaceId }] : [];
    }
    if (sql.includes('FROM destinations')) {
      const row = this.destinations.get(String(params[0]));
      return row && row.workspace_id === params[1] ? [row] : [];
    }
    if (sql.includes('UPDATE destinations')) {
      const row = this.destinations.get(String(params[1]));
      if (!row || row.workspace_id !== params[2]) return [];
      row.timezone = String(params[0]);
      return [{ id: row.id }];
    }
    if (sql.includes('INSERT INTO posting_slots')) {
      const [destinationId, kind, timeOfDay, isActive] = params as [
        string,
        string[],
        string,
        boolean,
      ];
      if (
        this.slots.some(
          (s) => s.destination_id === destinationId && s.time_of_day === timeOfDay
        )
      ) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      this.seq += 1;
      const row: SlotRow = {
        id: `bbbbbbbb-bbbb-4bbb-abbb-${String(this.seq).padStart(12, '0')}`,
        destination_id: destinationId,
        kind,
        time_of_day: timeOfDay,
        is_active: isActive,
      };
      this.slots.push(row);
      return [row];
    }
    if (sql.includes('UPDATE posting_slots')) {
      const [kind, timeOfDay, isActive, id, destinationId] = params as [
        string[],
        string,
        boolean,
        string,
        string,
      ];
      const row = this.slots.find(
        (s) => s.id === id && s.destination_id === destinationId
      );
      if (!row) return [];
      if (
        this.slots.some(
          (s) =>
            s.id !== id &&
            s.destination_id === destinationId &&
            s.time_of_day === timeOfDay
        )
      ) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      row.kind = kind;
      row.time_of_day = timeOfDay;
      row.is_active = isActive;
      return [row];
    }
    if (sql.includes('DELETE FROM posting_slots')) {
      const before = this.slots.length;
      this.slots = this.slots.filter(
        (s) => !(s.id === params[0] && s.destination_id === params[1])
      );
      return this.slots.length < before ? [{ id: String(params[0]) }] : [];
    }
    if (sql.includes('FROM posting_slots')) {
      return this.slots.filter((s) => s.destination_id === params[0]);
    }
    return [];
  });
}

let db: FakeDb;
let dbClient: DatabaseClient;
let sessionCookie: string;

function seed() {
  db.destinations.set(igDestinationId, {
    id: igDestinationId,
    workspace_id: workspaceId,
    platform: 'instagram',
    timezone: 'UTC',
    status: 'active',
    rate_usage_pct: 0,
    next_allowed_publish_at: null,
    metadata: null,
  });
  db.destinations.set(foreignDestinationId, {
    id: foreignDestinationId,
    workspace_id: otherWorkspaceId,
    platform: 'instagram',
    timezone: 'UTC',
    status: 'active',
    rate_usage_pct: 0,
    next_allowed_publish_at: null,
    metadata: null,
  });
  db.slots.push({
    id: slotId,
    destination_id: igDestinationId,
    kind: ['text', 'image', 'video', 'story', 'carousel'],
    time_of_day: '09:00:00',
    is_active: true,
  });
}

function request(method: string, body?: unknown, cookie: string | null = sessionCookie) {
  return new NextRequest('http://localhost:3000/api/tenant/acme/destinations/x/posting-slots', {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(async () => {
  vi.restoreAllMocks();
  process.env.SESSION_SECRET = TEST_SECRET;
  db = new FakeDb();
  seed();
  dbClient = db as unknown as DatabaseClient;
  const token = await signSessionToken(
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
  sessionCookie = `fbup_session=${token}`;
});

describe('destination posting slot create', () => {
  it('creates a slot with all-kind coverage by default', async () => {
    const res = await handleCreateDestinationPostingSlot(
      request('POST', { timeOfDay: '17:30' }),
      subdomain,
      igDestinationId,
      dbClient
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { timeOfDay: string; kind: string[]; isActive: boolean };
    expect(body.timeOfDay).toBe('17:30:00');
    expect(body.kind).toEqual(['text', 'image', 'video', 'story', 'carousel']);
    expect(body.isActive).toBe(true);
    expect(db.slots).toHaveLength(2);
  });

  it('returns a plain-language 409 for a duplicate time', async () => {
    const res = await handleCreateDestinationPostingSlot(
      request('POST', { timeOfDay: '09:00' }),
      subdomain,
      igDestinationId,
      dbClient
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('SLOT_TIME_TAKEN');
    expect(body.message).toBe('A posting time already exists at that time.');
  });

  it('reads a destination in another workspace as not found', async () => {
    const res = await handleCreateDestinationPostingSlot(
      request('POST', { timeOfDay: '17:30' }),
      subdomain,
      foreignDestinationId,
      dbClient
    );
    expect(res.status).toBe(404);
  });

  it('rejects a malformed time of day', async () => {
    const res = await handleCreateDestinationPostingSlot(
      request('POST', { timeOfDay: '9am' }),
      subdomain,
      igDestinationId,
      dbClient
    );
    expect(res.status).toBe(400);
  });
});

describe('destination posting slot update', () => {
  it('updates time, coverage and active state', async () => {
    const res = await handleUpdateDestinationPostingSlot(
      request('PATCH', { timeOfDay: '10:15', kind: ['image', 'video'], isActive: false }),
      subdomain,
      igDestinationId,
      slotId,
      dbClient
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { timeOfDay: string; kind: string[]; isActive: boolean };
    expect(body.timeOfDay).toBe('10:15:00');
    expect(body.kind).toEqual(['image', 'video']);
    expect(body.isActive).toBe(false);
  });

  it('returns 409 when moved onto an existing time', async () => {
    db.slots.push({
      id: secondSlotId,
      destination_id: igDestinationId,
      kind: ['text'],
      time_of_day: '18:00:00',
      is_active: true,
    });
    const res = await handleUpdateDestinationPostingSlot(
      request('PATCH', { timeOfDay: '18:00' }),
      subdomain,
      igDestinationId,
      slotId,
      dbClient
    );
    expect(res.status).toBe(409);
  });

  it('returns 404 for an unknown slot', async () => {
    const res = await handleUpdateDestinationPostingSlot(
      request('PATCH', { isActive: false }),
      subdomain,
      igDestinationId,
      '99999999-9999-4999-a999-999999999999',
      dbClient
    );
    expect(res.status).toBe(404);
  });
});

describe('destination posting slot delete', () => {
  it('removes the slot', async () => {
    const res = await handleDeleteDestinationPostingSlot(
      request('DELETE'),
      subdomain,
      igDestinationId,
      slotId,
      dbClient
    );
    expect(res.status).toBe(200);
    expect(db.slots).toHaveLength(0);
  });

  it('returns 404 for an unknown slot', async () => {
    const res = await handleDeleteDestinationPostingSlot(
      request('DELETE'),
      subdomain,
      igDestinationId,
      '99999999-9999-4999-a999-999999999999',
      dbClient
    );
    expect(res.status).toBe(404);
  });
});

describe('destination timezone write', () => {
  it('updates the destination timezone and the read reflects it', async () => {
    const res = await handleUpdateDestinationTimezone(
      request('PATCH', { timezone: 'America/New_York' }),
      subdomain,
      igDestinationId,
      dbClient
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; timezone: string };
    expect(body.timezone).toBe('America/New_York');

    const list = await handleListDestinationPostingSlots(
      request('GET'),
      subdomain,
      igDestinationId,
      dbClient
    );
    const listBody = (await list.json()) as { timezone: string };
    expect(listBody.timezone).toBe('America/New_York');
  });

  it('rejects an empty timezone', async () => {
    const res = await handleUpdateDestinationTimezone(
      request('PATCH', { timezone: '' }),
      subdomain,
      igDestinationId,
      dbClient
    );
    expect(res.status).toBe(400);
  });
});
