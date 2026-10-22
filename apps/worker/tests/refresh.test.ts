import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createPublisherRegistry,
  decryptToken,
  encryptToken,
  type Platform,
  type Publisher,
} from '@fbuploadpro/contracts';
import {
  runRefreshCycle,
  REFRESH_LEASE_TTL_MS,
  type RefreshDbClient,
} from '../src/refresh.js';
import { handleScheduled, type Env } from '../src/index.js';

const MASTER_KEY =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

const NOW = new Date('2026-10-22T12:00:00.000Z');
const NEW_EXPIRY = '2026-10-22T14:00:00.000Z';

// ==========================================
// In-memory fake DB implementing the REAL conditional-update lease
// semantics: an update's filters are evaluated and applied in one
// synchronous step when the builder is awaited, so two concurrent
// cycles genuinely race on the acquire — exactly one can win a row
// whose lease is free or expired.
// ==========================================

interface FakeAccount extends Record<string, unknown> {
  id: string;
  platform: Platform;
  status: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  token_expires_at: string | null;
  refresh_lease_owner: string | null;
  refresh_lease_expires_at: string | null;
}

interface RecordedUpdate {
  values: Record<string, unknown>;
  matchedIds: string[];
}

type DbResult = { data: unknown; error: unknown };

function thenable(execute: () => DbResult) {
  return {
    then<TResult1 = DbResult, TResult2 = never>(
      onFulfilled?: ((value: DbResult) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> {
      return Promise.resolve()
        .then(execute)
        .then(onFulfilled, onRejected);
    },
  };
}

class FakeRefreshDb {
  readonly accounts = new Map<string, FakeAccount>();
  readonly updates: RecordedUpdate[] = [];
  failScan = false;

  from(_table: string) {
    const db = this;
    return {
      select: (_columns: string) => {
        const filters: Array<[string, unknown]> = [];
        const builder = {
          eq(column: string, value: unknown) {
            filters.push([column, value]);
            return builder;
          },
          then: thenable(() => {
            if (db.failScan) {
              return {
                data: null,
                error: new Error('column social_accounts.refresh_lease_owner does not exist'),
              };
            }
            const rows = [...db.accounts.values()]
              .filter((row) => filters.every(([col, val]) => row[col] === val))
              .map((row) => ({ ...row }));
            return { data: rows, error: null };
          }).then,
        };
        return builder;
      },
      update: (values: Record<string, unknown>) => {
        const eqFilters: Array<[string, unknown]> = [];
        let orFilter: string | null = null;
        const execute = (): DbResult => {
          const matched: Array<{ id: string }> = [];
          for (const row of db.accounts.values()) {
            if (!eqFilters.every(([col, val]) => row[col] === val)) continue;
            if (orFilter !== null) {
              const clauses = orFilter.split(',');
              const passes = clauses.some((clause) => {
                if (clause === 'refresh_lease_owner.is.null') {
                  return row.refresh_lease_owner === null;
                }
                const lt = /^refresh_lease_expires_at\.lt\.(.+)$/.exec(clause);
                if (lt) {
                  return (
                    row.refresh_lease_expires_at !== null &&
                    row.refresh_lease_expires_at < (lt[1] as string)
                  );
                }
                return false;
              });
              if (!passes) continue;
            }
            Object.assign(row, values);
            matched.push({ id: row.id });
          }
          db.updates.push({ values: { ...values }, matchedIds: matched.map((m) => m.id) });
          return { data: matched, error: null };
        };
        const builder = {
          eq(column: string, value: unknown) {
            eqFilters.push([column, value]);
            return builder;
          },
          or(filter: string) {
            orFilter = filter;
            return builder;
          },
          select(_columns?: string) {
            return builder;
          },
          then: thenable(execute).then,
        };
        return builder;
      },
    };
  }
}

async function makeAccount(overrides: Partial<FakeAccount> = {}): Promise<FakeAccount> {
  return {
    id: 'acct-1',
    workspace_id: 'ws-1',
    platform: 'x',
    external_account_id: 'user-1',
    display_name: 'User',
    avatar_url: null,
    encrypted_access_token: await encryptToken('old-access', MASTER_KEY),
    encrypted_refresh_token: await encryptToken('old-refresh', MASTER_KEY),
    // X: due when expiry is within 30 minutes.
    token_expires_at: '2026-10-22T12:10:00.000Z',
    scopes: null,
    status: 'active',
    metadata: {},
    created_at: '2026-10-20T12:00:00.000Z',
    updated_at: '2026-10-20T12:00:00.000Z',
    refresh_lease_owner: null,
    refresh_lease_expires_at: null,
    ...overrides,
  };
}

function fakePublisher(
  platform: Platform,
  refreshImpl?: Publisher['refreshTokens'],
  mapErrorImpl?: Publisher['mapError']
): Publisher & { refreshTokens: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> } {
  return {
    platform,
    publish: vi.fn(async () => ({ status: 'published' as const })),
    refreshTokens: vi.fn(
      refreshImpl ??
        (async () => ({
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
          tokenExpiresAt: NEW_EXPIRY,
        }))
    ) as unknown as Publisher['refreshTokens'],
    mapError:
      mapErrorImpl ??
      ((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('invalid_grant')) {
          return { kind: 'auth' as const, code: 'invalid_grant', message };
        }
        return { kind: 'retryable' as const, code: 'temporarily_unavailable', message };
      }),
  } as Publisher & { refreshTokens: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn> };
}

function registryWith(publisher: Publisher) {
  const registry = createPublisherRegistry();
  registry.register(publisher);
  return registry;
}

const ENV = { TOKEN_ENCRYPTION_KEY: MASTER_KEY, POSTHOG_KEY: 'test-key' };

// ==========================================
// Refresh cycle
// ==========================================

describe('Token refresh job (spec 121 D6)', () => {
  const fetchBodies: string[] = [];

  beforeEach(() => {
    fetchBodies.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        fetchBodies.push(init?.body ?? '');
        return { ok: true };
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SINGLE-WRITER: two concurrent runs over one X account perform exactly one rotation and one atomic persist', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set('acct-1', await makeAccount());
    const publisher = fakePublisher('x', async () => {
      // Widen the race window: the refresh itself is slow, but the
      // lease was acquired before the call, so the loser never gets here.
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { accessToken: 'new-access', refreshToken: 'new-refresh', tokenExpiresAt: NEW_EXPIRY };
    });
    const registry = registryWith(publisher);

    const [a, b] = await Promise.all([
      runRefreshCycle(db as unknown as RefreshDbClient, registry, ENV, NOW),
      runRefreshCycle(db as unknown as RefreshDbClient, registry, ENV, NOW),
    ]);

    expect(publisher.refreshTokens).toHaveBeenCalledTimes(1);
    const persists = db.updates.filter((u) => 'encrypted_access_token' in u.values);
    expect(persists).toHaveLength(1);
    expect(a.refreshed + b.refreshed).toBe(1);
    expect(a.skippedLease + b.skippedLease).toBe(1);

    const stored = db.accounts.get('acct-1') as FakeAccount;
    expect(await decryptToken(stored.encrypted_access_token, MASTER_KEY)).toBe('new-access');
    expect(
      await decryptToken(stored.encrypted_refresh_token as string, MASTER_KEY)
    ).toBe('new-refresh');
    expect(stored.token_expires_at).toBe(NEW_EXPIRY);
    expect(stored.refresh_lease_owner).toBeNull();
    expect(stored.refresh_lease_expires_at).toBeNull();
    expect(stored.status).toBe('active');
  });

  it('persists new tokens + expiry + lease release as ONE atomic update', async () => {
    const db = new FakeRefreshDb();
    const account = await makeAccount();
    const oldRefreshCiphertext = account.encrypted_refresh_token;
    db.accounts.set(account.id, account);
    const publisher = fakePublisher('x');
    await runRefreshCycle(db as unknown as RefreshDbClient, registryWith(publisher), ENV, NOW);

    // Exactly two updates: the lease acquire, then the atomic persist.
    expect(db.updates).toHaveLength(2);
    const acquire = db.updates[0] as RecordedUpdate;
    expect(acquire.values.refresh_lease_owner).toBeTruthy();
    expect(acquire.values.refresh_lease_expires_at).toBe(
      new Date(NOW.getTime() + REFRESH_LEASE_TTL_MS).toISOString()
    );
    const persist = db.updates[1] as RecordedUpdate;
    expect(persist.matchedIds).toEqual(['acct-1']);
    expect(typeof persist.values.encrypted_access_token).toBe('string');
    expect(typeof persist.values.encrypted_refresh_token).toBe('string');
    expect(persist.values.encrypted_refresh_token).not.toBe(oldRefreshCiphertext);
    expect(persist.values.token_expires_at).toBe(NEW_EXPIRY);
    expect(persist.values.refresh_lease_owner).toBeNull();
    expect(persist.values.refresh_lease_expires_at).toBeNull();
  });

  it('invalid_grant / auth failure marks the account expired, releases the lease, raises PostHog, and never retries', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set('acct-1', await makeAccount());
    const publisher = fakePublisher('x', async () => {
      throw new Error('invalid_grant: refresh token revoked');
    });

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.expired).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(publisher.refreshTokens).toHaveBeenCalledTimes(1);
    const stored = db.accounts.get('acct-1') as FakeAccount;
    expect(stored.status).toBe('expired');
    expect(stored.refresh_lease_owner).toBeNull();
    expect(stored.refresh_lease_expires_at).toBeNull();
    // The expire update carries status + lease release together.
    const expireUpdate = db.updates.find((u) => u.values.status === 'expired');
    expect(expireUpdate?.values.refresh_lease_owner).toBeNull();
    expect(fetchBodies.some((body) => body.includes('$exception'))).toBe(true);

    // No retry loop: the next scan only reads active accounts.
    const second = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );
    expect(second.scanned).toBe(0);
    expect(publisher.refreshTokens).toHaveBeenCalledTimes(1);
  });

  it('transient failure releases the lease, leaves tokens untouched, and keeps the account active', async () => {
    const db = new FakeRefreshDb();
    const account = await makeAccount();
    db.accounts.set(account.id, account);
    const publisher = fakePublisher('x', async () => {
      throw new Error('socket hangup');
    });

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.deferredTransient).toBe(1);
    expect(result.expired).toBe(0);
    const stored = db.accounts.get('acct-1') as FakeAccount;
    expect(stored.status).toBe('active');
    expect(stored.encrypted_access_token).toBe(account.encrypted_access_token);
    expect(stored.encrypted_refresh_token).toBe(account.encrypted_refresh_token);
    expect(stored.token_expires_at).toBe(account.token_expires_at);
    expect(stored.refresh_lease_owner).toBeNull();
    // No update ever carried token material.
    expect(db.updates.some((u) => 'encrypted_access_token' in u.values)).toBe(false);
  });

  it('skips an account whose lease is held by a live other owner', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      'acct-1',
      await makeAccount({
        refresh_lease_owner: 'other-run',
        refresh_lease_expires_at: '2026-10-22T12:04:00.000Z',
      })
    );
    const publisher = fakePublisher('x');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.skippedLease).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
    expect(db.accounts.get('acct-1')?.refresh_lease_owner).toBe('other-run');
  });

  it('takes over an expired lease and refreshes', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      'acct-1',
      await makeAccount({
        refresh_lease_owner: 'dead-run',
        refresh_lease_expires_at: '2026-10-22T11:59:00.000Z',
      })
    );
    const publisher = fakePublisher('x');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.refreshed).toBe(1);
    expect(publisher.refreshTokens).toHaveBeenCalledTimes(1);
    expect(db.accounts.get('acct-1')?.refresh_lease_owner).toBeNull();
  });

  it('Facebook lapse: a lapsed token flips to expired with NO publisher call', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      'acct-1',
      await makeAccount({
        platform: 'facebook',
        encrypted_refresh_token: null,
        token_expires_at: '2026-10-22T11:00:00.000Z',
      })
    );
    const publisher = fakePublisher('facebook');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.expired).toBe(1);
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(db.accounts.get('acct-1')?.status).toBe('expired');
  });

  it('Facebook inside the lapse window but not yet lapsed stays active', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      'acct-1',
      await makeAccount({
        platform: 'facebook',
        encrypted_refresh_token: null,
        token_expires_at: '2026-10-25T12:00:00.000Z',
      })
    );
    const publisher = fakePublisher('facebook');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.expired).toBe(0);
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
    expect(db.accounts.get('acct-1')?.status).toBe('active');
  });

  it('unregistered platform is skipped with zero calls and zero writes', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set('acct-1', await makeAccount());
    const registry = createPublisherRegistry(); // empty — no modules until 122/124–127

    const result = await runRefreshCycle(db as unknown as RefreshDbClient, registry, ENV, NOW);

    expect(result.scanned).toBe(1);
    expect(result.due).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(db.updates).toHaveLength(0);
  });

  it('provider-managed platforms are never due and never refreshed', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set('acct-1', await makeAccount({ platform: 'youtube' }));
    const publisher = fakePublisher('youtube');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.due).toBe(0);
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
  });

  it('a scan failure (e.g. lease columns not yet migrated) aborts loudly and expires nothing', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set('acct-1', await makeAccount());
    db.failScan = true;
    const publisher = fakePublisher('x');

    await expect(
      runRefreshCycle(db as unknown as RefreshDbClient, registryWith(publisher), ENV, NOW)
    ).rejects.toThrow('does not exist');
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
    expect(db.accounts.get('acct-1')?.status).toBe('active');
    expect(fetchBodies.some((body) => body.includes('$exception'))).toBe(true);
  });
});

// ==========================================
// Cron routing
// ==========================================

describe('Scheduled cron routing (spec 121 D6)', () => {
  function makeRoutingDb() {
    const rpc = vi.fn(async (_fn: string, _args?: Record<string, unknown>) => ({
      data: [],
      error: null,
    }));
    const scannedTables: string[] = [];
    const from = vi.fn((table: string) => {
      if (table === 'worker_heartbeats') {
        return { upsert: vi.fn(async () => ({ error: null })) };
      }
      return {
        select: (_columns: string) => {
          scannedTables.push(table);
          const builder = {
            eq: (_col: string, _val: unknown) => builder,
            then: thenable(() => ({ data: [], error: null })).then,
          };
          return builder;
        },
        update: vi.fn(),
      };
    });
    return { db: { rpc, from }, rpc, scannedTables };
  }

  const routingEnv: Env = {
    ENVIRONMENT: 'test',
    TOKEN_ENCRYPTION_KEY: MASTER_KEY,
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  };
  const ctx = {
    waitUntil: () => {},
    passThroughOnException: () => {},
  } as unknown as ExecutionContext;
  const queues = {
    fast: { sendBatch: vi.fn(async () => {}) },
    heavy: { sendBatch: vi.fn(async () => {}) },
  };

  function controller(cron: string): ScheduledController {
    return { cron, scheduledTime: NOW.getTime(), noRetry: () => {} };
  }

  it('the refresh cron runs the refresh cycle and NOT the claimer', async () => {
    const { db, rpc, scannedTables } = makeRoutingDb();
    const registry = registryWith(fakePublisher('facebook'));

    await handleScheduled(controller('*/15 * * * *'), routingEnv, ctx, {
      db: db as never,
      registry,
      queues,
      now: NOW,
    });

    expect(scannedTables).toContain('social_accounts');
    expect(rpc.mock.calls.filter((c) => c[0] === 'claim_due_queue_items')).toHaveLength(0);
  });

  it('the claim cron runs the claimer and NOT the refresh cycle', async () => {
    const { db, rpc, scannedTables } = makeRoutingDb();
    const registry = registryWith(fakePublisher('facebook'));

    await handleScheduled(controller('* * * * *'), routingEnv, ctx, {
      db: db as never,
      registry,
      queues,
      now: new Date('2026-10-22T12:07:00.000Z'), // non-recovery tick
    });

    expect(rpc.mock.calls.filter((c) => c[0] === 'claim_due_queue_items').length).toBeGreaterThan(0);
    expect(scannedTables).not.toContain('social_accounts');
  });
});
