import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSocialAccountsWithDestinations } from './persist';

/**
 * Spec 139: fetchSocialAccountsWithDestinations must not silently lose rows
 * to the PostgREST max_rows cap (1,000). The fake below honours .range()
 * exactly like PostgREST and records every select() column list.
 */
const WORKSPACE_ID = 'workspace-1';

interface CapturedQuery {
  table: string;
  columns: string;
  ranges: Array<[number, number]>;
  orders: Array<{ column: string; ascending: boolean }>;
}

class FakePagedBuilder {
  private columns = '';
  private readonly filters: Array<[string, unknown]> = [];
  private orderColumn = 'id';
  private ascending = true;
  private from = 0;
  private to = Number.MAX_SAFE_INTEGER;

  constructor(
    private readonly tables: Map<string, Array<Record<string, unknown>>>,
    private readonly table: string,
    private readonly captured: CapturedQuery[]
  ) {}

  select(columns: string): this {
    this.columns = columns;
    return this;
  }

  eq(key: string, value: unknown): this {
    this.filters.push([key, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  range(from: number, to: number): this {
    this.from = from;
    this.to = to;
    return this;
  }

  then<TResult>(
    onFulfilled: (value: {
      data: Array<Record<string, unknown>>;
      error: null;
    }) => TResult
  ) {
    this.captured.push({
      table: this.table,
      columns: this.columns,
      ranges: [[this.from, this.to]],
      orders: [{ column: this.orderColumn, ascending: this.ascending }],
    });
    const rows = [...(this.tables.get(this.table) ?? [])]
      .filter((row) => this.filters.every(([k, v]) => row[k] === v))
      .sort((a, b) => {
        const av = String(a[this.orderColumn]);
        const bv = String(b[this.orderColumn]);
        return this.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
      })
      .slice(this.from, this.to + 1);
    return Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  }
}

function makeFakeClient(
  tables: Map<string, Array<Record<string, unknown>>>,
  captured: CapturedQuery[]
): SupabaseClient {
  return {
    from: (table: string) => new FakePagedBuilder(tables, table, captured),
  } as unknown as SupabaseClient;
}

function accountRow(index: number): Record<string, unknown> {
  const id = `acct-${String(index).padStart(5, '0')}`;
  return {
    id,
    workspace_id: WORKSPACE_ID,
    platform: 'facebook',
    external_account_id: `ext-${index}`,
    display_name: `Account ${index}`,
    avatar_url: null,
    status: 'active',
    token_expires_at: null,
    // Columns the list view must NOT pull:
    encrypted_access_token: 'secret-token',
    encrypted_refresh_token: 'secret-refresh',
    scopes: ['pages_manage_posts'],
    metadata: { heavy: true },
  };
}

function destinationRow(index: number): Record<string, unknown> {
  return {
    id: `dest-${String(index).padStart(5, '0')}`,
    workspace_id: WORKSPACE_ID,
    account_id: `acct-${String(index).padStart(5, '0')}`,
    external_destination_id: `ext-dest-${index}`,
    name: `Destination ${index}`,
    handle: null,
    avatar_url: null,
    timezone: 'UTC',
    status: 'active',
    encrypted_destination_token: 'secret-destination-token',
    metadata: { heavy: true },
  };
}

describe('fetchSocialAccountsWithDestinations (spec 139 pagination)', () => {
  it('returns all rows across multiple pages (2,500 rows / 3 pages)', async () => {
    const tables = new Map<string, Array<Record<string, unknown>>>([
      ['social_accounts', Array.from({ length: 2500 }, (_, i) => accountRow(i))],
      ['destinations', Array.from({ length: 2500 }, (_, i) => destinationRow(i))],
    ]);
    const captured: CapturedQuery[] = [];
    const client = makeFakeClient(tables, captured);

    const accounts = await fetchSocialAccountsWithDestinations(
      client,
      WORKSPACE_ID
    );

    expect(accounts).toHaveLength(2500);
    expect(accounts[0].id).toBe('acct-00000');
    expect(accounts[2499].id).toBe('acct-02499');
    // Every destination survived pagination and was joined to its account.
    expect(
      accounts.reduce((sum, account) => sum + account.destinations.length, 0)
    ).toBe(2500);
    expect(accounts[1234].destinations).toHaveLength(1);
    expect(accounts[1234].destinations[0].name).toBe('Destination 1234');

    // Three pages per table: 0-999, 1000-1999, 2000-2999 (short final page).
    for (const table of ['social_accounts', 'destinations']) {
      const queries = captured.filter((q) => q.table === table);
      expect(queries).toHaveLength(3);
      expect(queries.map((q) => q.ranges[0])).toEqual([
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ]);
      expect(queries.every((q) => q.orders[0].column === 'id')).toBe(true);
    }
  });

  it('keeps the single-page case and return shape unchanged', async () => {
    const tables = new Map<string, Array<Record<string, unknown>>>([
      ['social_accounts', [accountRow(0), accountRow(1)]],
      ['destinations', [destinationRow(0)]],
    ]);
    const captured: CapturedQuery[] = [];
    const client = makeFakeClient(tables, captured);

    const accounts = await fetchSocialAccountsWithDestinations(
      client,
      WORKSPACE_ID
    );

    expect(accounts).toEqual([
      {
        id: 'acct-00000',
        platform: 'facebook',
        externalAccountId: 'ext-0',
        displayName: 'Account 0',
        avatarUrl: null,
        status: 'active',
        tokenExpiresAt: null,
        destinations: [
          {
            id: 'dest-00000',
            externalDestinationId: 'ext-dest-0',
            name: 'Destination 0',
            handle: null,
            avatarUrl: null,
            timezone: 'UTC',
            status: 'active',
          },
        ],
      },
      {
        id: 'acct-00001',
        platform: 'facebook',
        externalAccountId: 'ext-1',
        displayName: 'Account 1',
        avatarUrl: null,
        status: 'active',
        tokenExpiresAt: null,
        destinations: [],
      },
    ]);
    // One short page per table — no extra round trips.
    expect(captured).toHaveLength(2);
  });

  it('selects only the columns the view uses — never * or secrets', async () => {
    const tables = new Map<string, Array<Record<string, unknown>>>([
      ['social_accounts', [accountRow(0)]],
      ['destinations', [destinationRow(0)]],
    ]);
    const captured: CapturedQuery[] = [];
    const client = makeFakeClient(tables, captured);

    await fetchSocialAccountsWithDestinations(client, WORKSPACE_ID);

    const byTable = new Map(captured.map((q) => [q.table, q.columns]));
    expect(byTable.get('social_accounts')).toBe(
      'id, platform, external_account_id, display_name, avatar_url, status, token_expires_at'
    );
    expect(byTable.get('destinations')).toBe(
      'id, account_id, external_destination_id, name, handle, avatar_url, timezone, status'
    );
    for (const columns of byTable.values()) {
      expect(columns).not.toContain('*');
      expect(columns).not.toContain('encrypted');
      expect(columns).not.toContain('metadata');
      expect(columns).not.toContain('scopes');
    }
  });

  it('propagates a page error instead of returning partial data', async () => {
    const failingClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              range: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'boom' },
                }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      fetchSocialAccountsWithDestinations(failingClient, WORKSPACE_ID)
    ).rejects.toThrow('Failed to load connected accounts: boom');
  });
});
