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
  REFRESH_BACKLOG_EVENT,
  REFRESH_DUE_WINDOW_SECONDS,
  REFRESH_LEASE_TTL_MS,
  REFRESH_SCAN_MAX_ACCOUNTS_PER_CYCLE,
  REFRESH_SCAN_PAGE_SIZE,
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

interface RecordedSelect {
  ops: Array<{ op: 'eq' | 'lte' | 'gt'; column: string; value: unknown }>;
  orderColumn: string | null;
  limit: number | null;
}

class FakeRefreshDb {
  readonly accounts = new Map<string, FakeAccount>();
  readonly updates: RecordedUpdate[] = [];
  readonly selects: RecordedSelect[] = [];
  failScan = false;

  from(_table: string) {
    const db = this;
    return {
      select: (_columns: string) => {
        const ops: RecordedSelect['ops'] = [];
        let orderColumn: string | null = null;
        let limitCount: number | null = null;
        const builder = {
          eq(column: string, value: unknown) {
            ops.push({ op: 'eq', column, value });
            return builder;
          },
          lte(column: string, value: unknown) {
            ops.push({ op: 'lte', column, value });
            return builder;
          },
          gt(column: string, value: unknown) {
            ops.push({ op: 'gt', column, value });
            return builder;
          },
          order(column: string, _options: { ascending: boolean }) {
            orderColumn = column;
            return builder;
          },
          limit(count: number) {
            limitCount = count;
            return builder;
          },
          then: thenable(() => {
            db.selects.push({ ops: [...ops], orderColumn, limit: limitCount });
            if (db.failScan) {
              return {
                data: null,
                error: new Error('column social_accounts.refresh_lease_owner does not exist'),
              };
            }
            // Mirror SQL semantics: comparisons against NULL never pass.
            let rows = [...db.accounts.values()].filter((row) =>
              ops.every(({ op, column, value }) => {
                const cell: unknown = row[column];
                if (op === 'eq') return cell === value;
                if (cell === null || cell === undefined) return false;
                return op === 'lte'
                  ? (cell as string) <= (value as string)
                  : (cell as string) > (value as string);
              })
            );
            if (orderColumn !== null) {
              const col = orderColumn;
              rows = rows.sort((a, b) =>
                String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0
              );
            }
            if (limitCount !== null) rows = rows.slice(0, limitCount);
            return { data: rows.map((row) => ({ ...row })), error: null };
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
    id: acctUuid(1),
    workspace_id: WS_ID,
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

// Real DB ids are UUIDs (spec 139 B15 boundary validation parses them);
// fixtures use fixed valid UUIDs. acctUuid(n) keeps the zero-padded
// numeric ordering the cursor-pagination tests rely on.
const WS_ID = '11111111-1111-4111-8111-111111111111';
const acctUuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const ENV = { TOKEN_ENCRYPTION_KEY: MASTER_KEY, POSTHOG_KEY: 'test-key' };

// ==========================================
// Refresh cycle
// ==========================================

describe('Token refresh job (spec 121 D6)', () => {
  const fetchBodies: string[] = [];

  beforeEach(() => {
    fetchBodies.length = 0;
    // Fake ONLY the Date clock (timers stay real): lease expiry is
    // computed from `new Date()` at acquisition time, so tests pin
    // the wall clock to NOW and advance it explicitly when needed.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        fetchBodies.push(init?.body ?? '');
        return { ok: true };
      })
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('SINGLE-WRITER: two concurrent runs over one X account perform exactly one rotation and one atomic persist', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(acctUuid(1), await makeAccount());
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

    const stored = db.accounts.get(acctUuid(1)) as FakeAccount;
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
    expect(persist.matchedIds).toEqual([acctUuid(1)]);
    expect(typeof persist.values.encrypted_access_token).toBe('string');
    expect(typeof persist.values.encrypted_refresh_token).toBe('string');
    expect(persist.values.encrypted_refresh_token).not.toBe(oldRefreshCiphertext);
    expect(persist.values.token_expires_at).toBe(NEW_EXPIRY);
    expect(persist.values.refresh_lease_owner).toBeNull();
    expect(persist.values.refresh_lease_expires_at).toBeNull();
  });

  it('invalid_grant / auth failure marks the account expired, releases the lease, raises PostHog, and never retries', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(acctUuid(1), await makeAccount());
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
    const stored = db.accounts.get(acctUuid(1)) as FakeAccount;
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
    const stored = db.accounts.get(acctUuid(1)) as FakeAccount;
    expect(stored.status).toBe('active');
    expect(stored.encrypted_access_token).toBe(account.encrypted_access_token);
    expect(stored.encrypted_refresh_token).toBe(account.encrypted_refresh_token);
    expect(stored.token_expires_at).toBe(account.token_expires_at);
    expect(stored.refresh_lease_owner).toBeNull();
    // No update ever carried token material.
    expect(db.updates.some((u) => 'encrypted_access_token' in u.values)).toBe(false);
    // Spec 139: transient failures are PostHog-visible (previously
    // console-only), tagged with the account id + error class.
    expect(
      fetchBodies.some(
        (body) =>
          body.includes('$exception') &&
          body.includes('refresh_transient_failed') &&
          body.includes(acctUuid(1))
      )
    ).toBe(true);
  });

  it('skips an account whose lease is held by a live other owner', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      acctUuid(1),
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
    expect(db.accounts.get(acctUuid(1))?.refresh_lease_owner).toBe('other-run');
  });

  it('takes over an expired lease and refreshes', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      acctUuid(1),
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
    expect(db.accounts.get(acctUuid(1))?.refresh_lease_owner).toBeNull();
  });

  it('Facebook lapse: a lapsed token flips to expired with NO publisher call', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      acctUuid(1),
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
    expect(db.accounts.get(acctUuid(1))?.status).toBe('expired');
  });

  it('Facebook inside the lapse window but not yet lapsed stays active', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(
      acctUuid(1),
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
    expect(db.accounts.get(acctUuid(1))?.status).toBe('active');
  });

  it('unregistered platform is skipped with zero calls and zero writes', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(acctUuid(1), await makeAccount());
    const registry = createPublisherRegistry(); // empty — no modules until 122/124–127

    const result = await runRefreshCycle(db as unknown as RefreshDbClient, registry, ENV, NOW);

    expect(result.scanned).toBe(1);
    expect(result.due).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(db.updates).toHaveLength(0);
  });

  it('provider-managed platforms are never due and never refreshed', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(acctUuid(1), await makeAccount({ platform: 'youtube' }));
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
    db.accounts.set(acctUuid(1), await makeAccount());
    db.failScan = true;
    const publisher = fakePublisher('x');

    await expect(
      runRefreshCycle(db as unknown as RefreshDbClient, registryWith(publisher), ENV, NOW)
    ).rejects.toThrow('does not exist');
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
    expect(db.accounts.get(acctUuid(1))?.status).toBe('active');
    expect(fetchBodies.some((body) => body.includes('$exception'))).toBe(true);
  });

  it('LEASE TIMING (spec 139): lease expiry is computed from the acquisition moment, not the stale cycle-start snapshot', async () => {
    const db = new FakeRefreshDb();
    db.accounts.set(acctUuid(1), await makeAccount({ id: acctUuid(1) }));
    db.accounts.set(acctUuid(2), await makeAccount({ id: acctUuid(2) }));
    const publisher = fakePublisher('x', async () => {
      // Simulate a long cycle: by the time the SECOND account's lease
      // is acquired, the wall clock has moved 3 minutes past the
      // cycle-start snapshot (NOW).
      vi.setSystemTime(new Date(NOW.getTime() + 3 * 60 * 1000));
      return { accessToken: 'new-access', refreshToken: 'new-refresh', tokenExpiresAt: NEW_EXPIRY };
    });

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.refreshed).toBe(2);
    const acquires = db.updates.filter((u) => 'refresh_lease_owner' in u.values && u.values.refresh_lease_owner !== null);
    expect(acquires).toHaveLength(2);
    // First acquire happens at the pinned clock (NOW).
    expect((acquires[0] as RecordedUpdate).values.refresh_lease_expires_at).toBe(
      new Date(NOW.getTime() + REFRESH_LEASE_TTL_MS).toISOString()
    );
    // Second acquire: expiry is acquisition-time + TTL — a full TTL
    // from NOW+3min, NOT the part-expired NOW+TTL the stale snapshot
    // would have minted.
    const second = acquires.find((u) => u.matchedIds.includes(acctUuid(2))) as RecordedUpdate;
    expect(second.values.refresh_lease_expires_at).toBe(
      new Date(NOW.getTime() + 3 * 60 * 1000 + REFRESH_LEASE_TTL_MS).toISOString()
    );
  });

  it('BOUNDED DUE-SCAN (spec 139): keyset pagination processes only due-window accounts, across pages', async () => {
    const db = new FakeRefreshDb();
    // Five due X accounts interleaved (by id) with three accounts
    // whose tokens expire far beyond the refresh horizon — those
    // must never be scanned.
    const dueIds = [acctUuid(1), acctUuid(3), acctUuid(5), acctUuid(7), acctUuid(9)];
    for (const id of dueIds) {
      db.accounts.set(id, await makeAccount({ id }));
    }
    for (const id of [acctUuid(2), acctUuid(4), acctUuid(6)]) {
      db.accounts.set(
        id,
        await makeAccount({ id, token_expires_at: '2027-10-22T12:10:00.000Z' })
      );
    }
    const publisher = fakePublisher('x');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW,
      { pageSize: 2 }
    );

    expect(result.scanned).toBe(5);
    expect(result.due).toBe(5);
    expect(result.refreshed).toBe(5);
    expect(publisher.refreshTokens).toHaveBeenCalledTimes(5);
    // Three pages: 2 + 2 + 1, each carrying the due-window predicate,
    // id-ordering, the page limit, and (from page 2) the keyset cursor.
    expect(db.selects.length).toBeGreaterThanOrEqual(3);
    const horizonIso = new Date(NOW.getTime() + REFRESH_DUE_WINDOW_SECONDS * 1000).toISOString();
    for (const select of db.selects.slice(0, 3)) {
      expect(select.ops).toContainEqual({ op: 'eq', column: 'status', value: 'active' });
      expect(select.ops).toContainEqual({ op: 'lte', column: 'token_expires_at', value: horizonIso });
      expect(select.orderColumn).toBe('id');
      expect(select.limit).toBe(2);
    }
    expect(db.selects[0]?.ops.some((op) => op.op === 'gt')).toBe(false);
    expect(db.selects[1]?.ops).toContainEqual({ op: 'gt', column: 'id', value: acctUuid(3) });
    expect(db.selects[2]?.ops).toContainEqual({ op: 'gt', column: 'id', value: acctUuid(7) });
    // The production defaults are sane and bounded.
    expect(REFRESH_SCAN_PAGE_SIZE).toBeGreaterThan(0);
    expect(REFRESH_SCAN_MAX_ACCOUNTS_PER_CYCLE).toBeGreaterThanOrEqual(REFRESH_SCAN_PAGE_SIZE);
    expect(REFRESH_DUE_WINDOW_SECONDS).toBe(7 * 24 * 3600);
  });

  it('BOUNDED DUE-SCAN (spec 139): the per-cycle work bound stops the scan; the remainder waits for a later cycle', async () => {
    const db = new FakeRefreshDb();
    for (const id of [acctUuid(1), acctUuid(2), acctUuid(3), acctUuid(4), acctUuid(5)]) {
      db.accounts.set(id, await makeAccount({ id }));
    }
    const publisher = fakePublisher('x');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW,
      { pageSize: 2, maxAccountsPerCycle: 3 }
    );

    expect(result.scanned).toBe(3);
    expect(result.refreshed).toBe(3);
    expect(publisher.refreshTokens).toHaveBeenCalledTimes(3);
  });

  it('BACKLOG SIGNAL (spec 139 residue): within-cap cycles stay silent — no event, no warn', async () => {
    const db = new FakeRefreshDb();
    for (const id of [acctUuid(1), acctUuid(2)]) {
      db.accounts.set(id, await makeAccount({ id }));
    }
    const publisher = fakePublisher('x');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    expect(result.scanned).toBe(2);
    expect(result.scanCap).toBe(REFRESH_SCAN_MAX_ACCOUNTS_PER_CYCLE);
    expect(result.scanTruncated).toBe(false);
    expect(fetchBodies.some((body) => body.includes(REFRESH_BACKLOG_EVENT))).toBe(false);
    expect(warnSpy.mock.calls.some((args) => String(args[0]).includes('BACKLOG'))).toBe(false);
    warnSpy.mockRestore();
  });

  it('BACKLOG SIGNAL (spec 139 residue): a scan ending exactly at the cap with nothing behind it is NOT truncation', async () => {
    const db = new FakeRefreshDb();
    for (const id of [acctUuid(1), acctUuid(2), acctUuid(3)]) {
      db.accounts.set(id, await makeAccount({ id }));
    }
    const publisher = fakePublisher('x');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW,
      { pageSize: 2, maxAccountsPerCycle: 3 }
    );

    expect(result.scanned).toBe(3);
    expect(result.scanCap).toBe(3);
    // The one-row probe past the last scanned id found nothing:
    // ending at the cap is not by itself a backlog.
    expect(result.scanTruncated).toBe(false);
    expect(fetchBodies.some((body) => body.includes(REFRESH_BACKLOG_EVENT))).toBe(false);
    expect(warnSpy.mock.calls.some((args) => String(args[0]).includes('BACKLOG'))).toBe(false);
    warnSpy.mockRestore();
  });

  it('BACKLOG SIGNAL (spec 139 residue): backlog beyond the cap fires the PostHog event + warn log with the cycle counts', async () => {
    const db = new FakeRefreshDb();
    for (const id of [acctUuid(1), acctUuid(2), acctUuid(3), acctUuid(4), acctUuid(5)]) {
      db.accounts.set(id, await makeAccount({ id }));
    }
    const publisher = fakePublisher('x');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW,
      { pageSize: 2, maxAccountsPerCycle: 3 }
    );

    expect(result.scanned).toBe(3);
    expect(result.refreshed).toBe(3);
    expect(result.scanTruncated).toBe(true);
    const events = fetchBodies
      .map(
        (body) =>
          JSON.parse(body) as { event?: string; properties?: Record<string, unknown> }
      )
      .filter((payload) => payload.event === REFRESH_BACKLOG_EVENT);
    expect(events).toHaveLength(1);
    expect(events[0]?.properties).toMatchObject({
      site: 'runRefreshCycle',
      scanned: 3,
      scanCap: 3,
      due: 3,
      refreshed: 3,
      deferredTransient: 0,
      expired: 0,
    });
    expect(
      warnSpy.mock.calls.some(
        (args) => String(args[0]).includes('BACKLOG') && String(args[0]).includes('scanned=3')
      )
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('BACKLOG SIGNAL (spec 139 residue): the signal clears on a later cycle that covers the backlog', async () => {
    const db = new FakeRefreshDb();
    for (const id of [acctUuid(1), acctUuid(2), acctUuid(3), acctUuid(4), acctUuid(5)]) {
      db.accounts.set(id, await makeAccount({ id }));
    }
    const publisher = fakePublisher('x');

    const first = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW,
      { pageSize: 2, maxAccountsPerCycle: 3 }
    );
    expect(first.scanTruncated).toBe(true);
    expect(fetchBodies.filter((body) => body.includes(REFRESH_BACKLOG_EVENT))).toHaveLength(1);

    // The next scheduled cycle under the production cap covers
    // everything the capped cycle left behind: no truncation, and
    // the stateless signal fires nothing new — it has cleared.
    const second = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );
    expect(second.scanTruncated).toBe(false);
    expect(fetchBodies.filter((body) => body.includes(REFRESH_BACKLOG_EVENT))).toHaveLength(1);
  });

  it('DECRYPT FAILURE (spec 139): corrupt ciphertext is classified distinctly, the publisher is never called, and PostHog sees it', async () => {
    const db = new FakeRefreshDb();
    const account = await makeAccount({ encrypted_access_token: 'not-valid-ciphertext' });
    db.accounts.set(account.id, account);
    const publisher = fakePublisher('x');

    const result = await runRefreshCycle(
      db as unknown as RefreshDbClient,
      registryWith(publisher),
      ENV,
      NOW
    );

    // Transient retry semantics preserved: deferred, still active,
    // lease released, tokens untouched.
    expect(result.deferredTransient).toBe(1);
    expect(result.expired).toBe(0);
    expect(result.refreshed).toBe(0);
    expect(publisher.refreshTokens).not.toHaveBeenCalled();
    const stored = db.accounts.get(acctUuid(1)) as FakeAccount;
    expect(stored.status).toBe('active');
    expect(stored.refresh_lease_owner).toBeNull();
    expect(stored.encrypted_access_token).toBe('not-valid-ciphertext');
    // Distinct classification: decrypt kind + error class, and NOT
    // the transient platform kind or an auth expiry.
    expect(
      fetchBodies.some(
        (body) =>
          body.includes('refresh_decrypt_failed') &&
          body.includes(acctUuid(1)) &&
          body.includes('ValidationError')
      )
    ).toBe(true);
    expect(fetchBodies.some((body) => body.includes('refresh_transient_failed'))).toBe(false);
    expect(fetchBodies.some((body) => body.includes('refresh_auth_failed'))).toBe(false);
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
            lte: (_col: string, _val: unknown) => builder,
            gt: (_col: string, _val: unknown) => builder,
            order: (_col: string, _opts: { ascending: boolean }) => builder,
            limit: (_count: number) => builder,
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
