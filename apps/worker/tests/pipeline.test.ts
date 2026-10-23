import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createPublisherRegistry,
  encryptToken,
  type DatabaseDestinationRow,
  type DatabaseSocialAccountRow,
  type DatabaseUnifiedQueueItemRow,
  type Platform,
  type Publisher,
  type PublishOutcome,
} from '@fbuploadpro/contracts';
import {
  runClaimTick,
  MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK,
} from '../src/claimer.js';
import {
  handlePublishBatch,
  handleDlqBatch,
  mapPublishOutcomeToSettleArgs,
  DEFER_ACCOUNT_NOT_ACTIVE_CODE,
  DEFER_DESTINATION_COOLDOWN_CODE,
  DEFER_DESTINATION_NOT_ACTIVE_CODE,
  DEFAULT_RETRY_DELAY_SECONDS,
  DLQ_ERROR_CODE,
} from '../src/consumers.js';
import { recordHeartbeat } from '../src/heartbeat.js';
import type { PublishQueueMessage } from '../src/claimer.js';

const MASTER_KEY =
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

// ==========================================
// Fakes (external boundaries only: DB, queues, PostHog fetch)
// ==========================================

function fakePublisher(
  platform: Platform,
  publishImpl: Publisher['publish']
): Publisher & { publish: ReturnType<typeof vi.fn> } {
  return {
    platform,
    publish: vi.fn(publishImpl),
    refreshTokens: vi.fn(async (_account: unknown, tokens: { accessToken: string }) => ({
      accessToken: tokens.accessToken,
    })) as unknown as Publisher['refreshTokens'],
    mapError: () => ({ kind: 'permanent', code: 'unknown', message: 'unknown' }),
  } as Publisher & { publish: ReturnType<typeof vi.fn> };
}

function makeQueueProducer() {
  const batches: PublishQueueMessage[][] = [];
  return {
    batches,
    sendBatch: vi.fn(async (messages: Iterable<{ body: PublishQueueMessage }>) => {
      batches.push([...messages].map((m) => m.body));
    }),
  };
}

function fakeMessage(body: PublishQueueMessage, attempts = 1) {
  return {
    id: `msg-${body.itemId}-${attempts}`,
    timestamp: new Date(),
    body,
    attempts,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

function fakeBatch(queue: string, messages: ReturnType<typeof fakeMessage>[]) {
  return {
    queue,
    messages,
    metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
    ackAll: vi.fn(),
    retryAll: vi.fn(),
  };
}

const NON_RECOVERY_TICK = new Date(2026, 0, 1, 10, 7); // minute 7
const RECOVERY_TICK = new Date(2026, 0, 1, 10, 10); // minute 10

// ==========================================
// Claimer
// ==========================================

describe('Claimer (spec 121)', () => {
  // SUPERSEDED by the spec 122 load-proof tuning (claim round cap 4 → 1,
  // see claimer.ts): this test previously asserted multi-round looping
  // within one tick (500 + 120 = 620 claimed). At cap 1 a tick claims
  // exactly one round per lane; the remaining backlog stays queued for
  // the next tick. Chunking at 100 per sendBatch call is unchanged.
  it('claims one round per lane per tick (cap 1), chunking sendBatch at 100', async () => {
    const registry = createPublisherRegistry();
    const publisher = fakePublisher('facebook', async () => ({ status: 'published' }));
    registry.register(publisher);

    const fastRounds: number[] = [500, 120];
    const rpc = vi.fn(async (_fn: string, args?: Record<string, unknown>) => {
      const kindSet = (args?.p_lane_kind_set as string[]) ?? [];
      if (kindSet.includes('video')) return { data: [], error: null }; // heavy lane empty
      const count = fastRounds.shift() ?? 0;
      return {
        data: Array.from({ length: count }, (_, i) => ({ id: `item-${count}-${i}` })),
        error: null,
      };
    });
    const fastQ = makeQueueProducer();
    const heavyQ = makeQueueProducer();

    const result = await runClaimTick({
      db: { rpc },
      registry,
      queues: { fast: fastQ, heavy: heavyQ },
      now: NON_RECOVERY_TICK,
    });

    expect(result.claimed).toBe(500);
    expect(result.enqueuedFast).toBe(500);
    expect(result.enqueuedHeavy).toBe(0);
    // Chunk sizes: the single round → 5×100. The 120-item second round is
    // NOT claimed this tick (cap 1); it remains for the next tick.
    expect(fastQ.batches.map((b) => b.length)).toEqual([100, 100, 100, 100, 100]);
    expect(heavyQ.sendBatch).not.toHaveBeenCalled();
    // Message payload carries ids + derivable fields only.
    expect(fastQ.batches[0]?.[0]).toEqual({
      itemId: 'item-500-0',
      platform: 'facebook',
      lane: 'publish-fast',
    });
    // The tick never publishes.
    expect(publisher.publish).not.toHaveBeenCalled();
    // Claim RPC call shape.
    const claimCalls = rpc.mock.calls.filter((c) => c[0] === 'claim_due_queue_items');
    expect(claimCalls.length).toBeGreaterThan(0);
    expect(claimCalls[0]?.[1]).toMatchObject({
      p_platform: 'facebook',
      p_limit: 500,
      p_max_per_destination: 3,
    });
  });

  it('stops at the per-tick round cap when every round is full', async () => {
    const registry = createPublisherRegistry();
    registry.register(fakePublisher('facebook', async () => ({ status: 'published' })));
    const rpc = vi.fn(async (_fn: string, _args?: Record<string, unknown>) => ({
      data: Array.from({ length: 500 }, (_, i) => ({ id: `item-${i}` })),
      error: null,
    }));
    const fastQ = makeQueueProducer();
    const heavyQ = makeQueueProducer();

    const result = await runClaimTick({
      db: { rpc },
      registry,
      queues: { fast: fastQ, heavy: heavyQ },
      now: NON_RECOVERY_TICK,
    });

    const claimCalls = rpc.mock.calls.filter((c) => c[0] === 'claim_due_queue_items');
    expect(claimCalls).toHaveLength(MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK * 2);
    expect(result.claimed).toBe(500 * MAX_CLAIM_ROUNDS_PER_PLATFORM_LANE_PER_TICK * 2);
  });

  it('claims only platforms registered in the publisher registry', async () => {
    const registry = createPublisherRegistry(); // empty: nothing is claimable yet
    const rpc = vi.fn(async (_fn: string, _args?: Record<string, unknown>) => ({ data: [], error: null }));
    const result = await runClaimTick({
      db: { rpc },
      registry,
      queues: { fast: makeQueueProducer(), heavy: makeQueueProducer() },
      now: NON_RECOVERY_TICK,
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ claimed: 0, enqueuedFast: 0, enqueuedHeavy: 0, recovered: 0 });
  });

  it('runs recovery only on every 5th tick, with the 2-arg RPC for all six platforms', async () => {
    const registry = createPublisherRegistry();
    const rpc = vi.fn(async (_fn: string, _args?: Record<string, unknown>) => ({ data: 0, error: null }));
    const queues = { fast: makeQueueProducer(), heavy: makeQueueProducer() };

    await runClaimTick({ db: { rpc }, registry, queues, now: NON_RECOVERY_TICK });
    expect(rpc.mock.calls.filter((c) => c[0] === 'recover_stuck_publishing_items')).toHaveLength(0);

    const result = await runClaimTick({
      db: { rpc },
      registry,
      queues,
      now: RECOVERY_TICK,
    });
    const recoverCalls = rpc.mock.calls.filter(
      (c) => c[0] === 'recover_stuck_publishing_items'
    );
    expect(recoverCalls).toHaveLength(6);
    expect(recoverCalls.map((c) => (c[1] as { p_platform: string }).p_platform).sort()).toEqual(
      ['facebook', 'instagram', 'threads', 'tiktok', 'x', 'youtube']
    );
    for (const call of recoverCalls) {
      expect(Object.keys(call[1] as object).sort()).toEqual(['p_platform', 'p_timeout_minutes']);
      expect((call[1] as { p_timeout_minutes: number }).p_timeout_minutes).toBe(10);
    }
    expect(result.recovered).toBe(0);
  });
});

// ==========================================
// Consumers
// ==========================================

async function makeItem(
  overrides: Partial<DatabaseUnifiedQueueItemRow> = {}
): Promise<DatabaseUnifiedQueueItemRow> {
  return {
    id: 'item-1',
    workspace_id: 'ws-1',
    destination_id: 'dest-1',
    platform: 'facebook',
    kind: 'text',
    platform_format: null,
    caption: 'Hello',
    title: null,
    first_comment: null,
    media_item_id: null,
    media_url: null,
    media_storage_key: null,
    link_url: null,
    platform_options: {},
    scheduled_time: new Date().toISOString(),
    slot_id: null,
    status: 'publishing',
    claimed_at: new Date().toISOString(),
    retry_count: 0,
    max_retries: 3,
    error_code: null,
    error_subcode: null,
    error_message: null,
    external_post_id: null,
    external_comment_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

async function makeConsumerDb(opts: {
  item: DatabaseUnifiedQueueItemRow | null;
  extraItems?: DatabaseUnifiedQueueItemRow[];
  destination?: Partial<DatabaseDestinationRow>;
  account?: Partial<DatabaseSocialAccountRow>;
  settleError?: unknown;
}) {
  const encryptedAccess = await encryptToken('plain-access-token', MASTER_KEY);
  const encryptedDest = await encryptToken('plain-page-token', MASTER_KEY);
  const destination: DatabaseDestinationRow = {
    id: 'dest-1',
    workspace_id: 'ws-1',
    account_id: 'acct-1',
    platform: 'facebook',
    external_destination_id: 'page-123',
    name: 'Page',
    handle: null,
    avatar_url: null,
    timezone: 'UTC',
    status: 'active',
    encrypted_destination_token: encryptedDest,
    next_allowed_publish_at: null,
    rate_usage_pct: 0,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...opts.destination,
  };
  const account: DatabaseSocialAccountRow = {
    id: 'acct-1',
    workspace_id: 'ws-1',
    platform: 'facebook',
    external_account_id: 'user-123',
    display_name: 'User',
    avatar_url: null,
    encrypted_access_token: encryptedAccess,
    encrypted_refresh_token: null,
    token_expires_at: null,
    scopes: null,
    status: 'active',
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...opts.account,
  };
  const queueItems = new Map<string, unknown>();
  if (opts.item) queueItems.set(opts.item.id, opts.item);
  for (const extra of opts.extraItems ?? []) queueItems.set(extra.id, extra);
  const tables: Record<string, Map<string, unknown>> = {
    queue_items: queueItems,
    destinations: new Map([[destination.id, destination]]),
    social_accounts: new Map([[account.id, account]]),
  };
  const settleCalls: Record<string, unknown>[] = [];
  const upserts: Record<string, unknown>[] = [];
  const db = {
    rpc: vi.fn(async (fn: string, args?: Record<string, unknown>) => {
      if (fn === 'settle_queue_item_outcome') {
        settleCalls.push(args ?? {});
        return opts.settleError
          ? { data: null, error: opts.settleError }
          : { data: null, error: null };
      }
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === 'worker_heartbeats') {
        return {
          upsert: vi.fn(async (row: Record<string, unknown>) => {
            upserts.push(row);
            return { error: null };
          }),
        };
      }
      let eqValue: unknown;
      const builder = {
        select: () => builder,
        eq: (_col: string, value: unknown) => {
          eqValue = value;
          return builder;
        },
        maybeSingle: async () => ({
          data: tables[table]?.get(eqValue as string) ?? null,
          error: null,
        }),
      };
      return builder;
    }),
  };
  return { db, settleCalls, upserts, destination, account };
}

function registryWith(publisher: Publisher) {
  const registry = createPublisherRegistry();
  registry.register(publisher);
  return registry;
}

describe('Publish consumers (spec 121)', () => {
  it('settles a published outcome via the unified RPC and acks', async () => {
    const item = await makeItem();
    const { db, settleCalls, upserts } = await makeConsumerDb({ item });
    let seenTokens: unknown;
    const publisher = fakePublisher('facebook', async (_item, _dest, tokens) => {
      seenTokens = tokens;
      return {
        status: 'published',
        externalPostId: 'post-42',
        externalCommentId: 'comment-7',
      } satisfies PublishOutcome;
    });
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({
      p_queue_item_id: 'item-1',
      p_workspace_id: 'ws-1',
      p_destination_id: 'dest-1',
      p_outcome_status: 'published',
      p_external_post_id: 'post-42',
      p_external_comment_id: 'comment-7',
      p_retry_count: 0,
    });
    // Tokens were decrypted before the publisher saw them.
    expect(seenTokens).toMatchObject({
      accessToken: 'plain-access-token',
      destinationToken: 'plain-page-token',
    });
    // Settled count flows to the heartbeat as a counts-only write.
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.last_settled_count).toBe(1);
    expect(upserts[0]?.last_run_at).toBeUndefined();
  });

  it('settles a retry outcome as queued with the publisher delay', async () => {
    const item = await makeItem({ retry_count: 1 });
    const { db, settleCalls } = await makeConsumerDb({ item });
    const publisher = fakePublisher('facebook', async () => ({
      status: 'retry',
      retryDelaySeconds: 900,
      error: { kind: 'retryable', code: '4', message: 'rate limited' },
    }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'queued',
      p_retry_delay_seconds: 900,
      p_retry_count: 2,
      p_error_code: '4',
      p_error_message: 'rate limited',
    });
  });

  it('settles a permanent failure as failed without an account cascade', async () => {
    const item = await makeItem();
    const { db, settleCalls } = await makeConsumerDb({ item });
    const publisher = fakePublisher('facebook', async () => ({
      status: 'failed',
      error: { kind: 'permanent', code: '100', message: 'invalid parameter' },
    }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'failed',
      p_error_code: '100',
      p_target_account_status: null,
    });
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('cascades an auth failure to account expired via the settle args', async () => {
    const item = await makeItem();
    const { db, settleCalls } = await makeConsumerDb({ item });
    const publisher = fakePublisher('facebook', async () => ({
      status: 'failed',
      error: { kind: 'auth', code: '190', message: 'token expired' },
    }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'failed',
      p_error_code: '190',
      p_target_account_status: 'expired',
    });
  });

  it('skips an item that is no longer publishing (cancelled) without publishing or settling', async () => {
    const item = await makeItem({ status: 'cancelled' });
    const { db, settleCalls } = await makeConsumerDb({ item });
    const publisher = fakePublisher('facebook', async () => ({ status: 'published' }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(settleCalls).toHaveLength(0);
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('leaves the message un-acked and rethrows when the publisher throws', async () => {
    const item = await makeItem();
    const { db, settleCalls } = await makeConsumerDb({ item });
    const publisher = fakePublisher('facebook', async () => {
      throw new Error('unexpected boom');
    });
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await expect(
      handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
        db: db as never,
        registry: registryWith(publisher),
        masterKey: MASTER_KEY,
        env: {},
      })
    ).rejects.toThrow('unexpected boom');
    expect(message.ack).not.toHaveBeenCalled();
    expect(settleCalls).toHaveLength(0);
  });

  it('leaves the message un-acked when settlement fails (DB failure)', async () => {
    const item = await makeItem();
    const { db } = await makeConsumerDb({ item, settleError: new Error('db down') });
    const publisher = fakePublisher('facebook', async () => ({
      status: 'published',
      externalPostId: 'post-1',
    }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await expect(
      handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
        db: db as never,
        registry: registryWith(publisher),
        masterKey: MASTER_KEY,
        env: {},
      })
    ).rejects.toThrow('db down');
    expect(message.ack).not.toHaveBeenCalled();
  });
});

// ==========================================
// Publish consumers — spec 139 publish safety
// ==========================================

describe('Publish consumers — spec 139 publish safety', () => {
  it('does not re-publish an item already carrying external_post_id; settles published from the stored ids', async () => {
    const item = await makeItem({
      external_post_id: 'post-existing',
      external_comment_id: 'comment-existing',
      retry_count: 2,
    });
    const { db, settleCalls } = await makeConsumerDb({ item });
    const publisher = fakePublisher('facebook', async () => ({
      status: 'published',
      externalPostId: 'post-NEW',
    }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'published',
      p_external_post_id: 'post-existing',
      p_external_comment_id: 'comment-existing',
      p_retry_count: 2,
    });
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('threads a publisher detail into p_detail, and omits p_detail when no detail was supplied', async () => {
    const item = await makeItem();
    const withDetail = mapPublishOutcomeToSettleArgs(item, {
      status: 'published',
      externalPostId: 'post-1',
      detail: { containerId: 'container-9' },
    });
    expect(withDetail.p_detail).toEqual({ containerId: 'container-9' });

    const withoutDetail = mapPublishOutcomeToSettleArgs(item, {
      status: 'published',
      externalPostId: 'post-1',
    });
    expect('p_detail' in withoutDetail).toBe(false);
  });

  it('defers to queued without publishing while the destination is in cooldown, delaying until the cooldown ends', async () => {
    const item = await makeItem();
    const cooldownEnd = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { db, settleCalls } = await makeConsumerDb({
      item,
      destination: { status: 'rate_limited', next_allowed_publish_at: cooldownEnd },
    });
    const publisher = fakePublisher('facebook', async () => ({ status: 'published' }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'queued',
      p_error_code: DEFER_DESTINATION_COOLDOWN_CODE,
      // No publish attempt was made: the retry budget is untouched.
      p_retry_count: 0,
    });
    const delay = settleCalls[0]?.p_retry_delay_seconds as number;
    expect(delay).toBeGreaterThan(500);
    expect(delay).toBeLessThanOrEqual(600);
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('defers to queued without publishing when the destination is no longer claimable', async () => {
    const item = await makeItem();
    const { db, settleCalls } = await makeConsumerDb({
      item,
      destination: { status: 'disconnected' },
    });
    const publisher = fakePublisher('facebook', async () => ({ status: 'published' }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'queued',
      p_error_code: DEFER_DESTINATION_NOT_ACTIVE_CODE,
      p_retry_delay_seconds: DEFAULT_RETRY_DELAY_SECONDS,
      p_retry_count: 0,
    });
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('defers to queued without publishing when the account is not active', async () => {
    const item = await makeItem();
    const { db, settleCalls } = await makeConsumerDb({
      item,
      account: { status: 'expired' },
    });
    const publisher = fakePublisher('facebook', async () => ({ status: 'published' }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(publisher.publish).not.toHaveBeenCalled();
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'queued',
      p_error_code: DEFER_ACCOUNT_NOT_ACTIVE_CODE,
      p_retry_count: 0,
    });
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('still publishes when a rate_limited destination cooldown has already elapsed (claim-mirroring)', async () => {
    const item = await makeItem();
    const elapsed = new Date(Date.now() - 60 * 1000).toISOString();
    const { db, settleCalls } = await makeConsumerDb({
      item,
      destination: { status: 'rate_limited', next_allowed_publish_at: elapsed },
    });
    const publisher = fakePublisher('facebook', async () => ({
      status: 'published',
      externalPostId: 'post-after-cooldown',
    }));
    const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

    await handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
      db: db as never,
      registry: registryWith(publisher),
      masterKey: MASTER_KEY,
      env: {},
    });

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(settleCalls[0]).toMatchObject({
      p_outcome_status: 'published',
      p_external_post_id: 'post-after-cooldown',
    });
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('captures a PostHog exception when publish processing throws (previously console-only)', async () => {
    const bodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        bodies.push(init?.body ?? '');
        return { ok: true };
      })
    );
    try {
      const item = await makeItem();
      const { db } = await makeConsumerDb({ item });
      const publisher = fakePublisher('facebook', async () => {
        throw new Error('unexpected boom');
      });
      const message = fakeMessage({ itemId: item.id, platform: 'facebook', lane: 'publish-fast' });

      await expect(
        handlePublishBatch(fakeBatch('publish-fast', [message]) as never, {
          db: db as never,
          registry: registryWith(publisher),
          masterKey: MASTER_KEY,
          env: { POSTHOG_KEY: 'test-key' },
        })
      ).rejects.toThrow('unexpected boom');
      expect(message.ack).not.toHaveBeenCalled();
      expect(
        bodies.some((b) => b.includes('$exception') && b.includes('publish_message_failed'))
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ==========================================
// DLQ consumers
// ==========================================

describe('DLQ consumers (spec 121)', () => {
  const fetchCalls: string[] = [];

  beforeEach(() => {
    fetchCalls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: { body?: string }) => {
        fetchCalls.push(init?.body ?? '');
        return { ok: true };
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('settles a non-terminal DLQ item failed with the DLQ reason, raises PostHog, counts the heartbeat DLQ counter, and acks', async () => {
    const item = await makeItem({ status: 'publishing' });
    const { db, settleCalls, upserts } = await makeConsumerDb({ item });
    const message = fakeMessage(
      { itemId: item.id, platform: 'facebook', lane: 'publish-fast' },
      4
    );

    await handleDlqBatch(fakeBatch('publish-fast-dlq', [message]) as never, {
      db: db as never,
      env: { POSTHOG_KEY: 'test-key' },
    });

    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({
      p_queue_item_id: 'item-1',
      p_outcome_status: 'failed',
      p_error_code: DLQ_ERROR_CODE,
    });
    expect(String(settleCalls[0]?.p_error_message)).toContain('publish-fast-dlq');
    // PostHog $exception raised for the DLQ arrival.
    expect(fetchCalls.some((body) => body.includes('$exception'))).toBe(true);
    // Heartbeat DLQ counter written counts-only.
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.last_dlq_fast).toBe(1);
    expect(upserts[0]?.last_run_at).toBeUndefined();
  });

  it('does not re-settle an already-terminal DLQ item but still acks and raises PostHog', async () => {
    const item = await makeItem({ status: 'failed' });
    const { db, settleCalls } = await makeConsumerDb({ item });
    const message = fakeMessage(
      { itemId: item.id, platform: 'facebook', lane: 'publish-heavy' },
      4
    );

    await handleDlqBatch(fakeBatch('publish-heavy-dlq', [message]) as never, {
      db: db as never,
      env: { POSTHOG_KEY: 'test-key' },
    });

    expect(settleCalls).toHaveLength(0);
    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(fetchCalls.some((body) => body.includes('$exception'))).toBe(true);
  });

  it('acks a DLQ message even when its settlement attempt fails', async () => {
    const item = await makeItem({ status: 'publishing' });
    const { db } = await makeConsumerDb({ item, settleError: new Error('db down') });
    const message = fakeMessage(
      { itemId: item.id, platform: 'facebook', lane: 'publish-fast' },
      4
    );

    await expect(
      handleDlqBatch(fakeBatch('publish-fast-dlq', [message]) as never, {
        db: db as never,
        env: { POSTHOG_KEY: 'test-key' },
      })
    ).resolves.toBeUndefined();
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('does not settle a DLQ item the recovery sweep already reclaimed to queued, and writes no DLQ heartbeat count', async () => {
    const item = await makeItem({ status: 'queued' });
    const { db, settleCalls, upserts } = await makeConsumerDb({ item });
    const message = fakeMessage(
      { itemId: item.id, platform: 'facebook', lane: 'publish-fast' },
      4
    );

    await handleDlqBatch(fakeBatch('publish-fast-dlq', [message]) as never, {
      db: db as never,
      env: { POSTHOG_KEY: 'test-key' },
    });

    expect(settleCalls).toHaveLength(0);
    expect(message.ack).toHaveBeenCalledTimes(1);
    // Stale arrivals are not settlements: no counts-only heartbeat write.
    expect(upserts).toHaveLength(0);
    // The arrival itself is still loud.
    expect(fetchCalls.some((body) => body.includes('$exception'))).toBe(true);
  });

  it('counts only actual settlements in the heartbeat DLQ counter for a mixed batch', async () => {
    const live = await makeItem({ id: 'item-live', status: 'publishing' });
    const done = await makeItem({ id: 'item-done', status: 'published' });
    const { db, settleCalls, upserts } = await makeConsumerDb({
      item: live,
      extraItems: [done],
    });
    const liveMsg = fakeMessage(
      { itemId: live.id, platform: 'facebook', lane: 'publish-fast' },
      4
    );
    const doneMsg = fakeMessage(
      { itemId: done.id, platform: 'facebook', lane: 'publish-fast' },
      4
    );

    await handleDlqBatch(fakeBatch('publish-fast-dlq', [liveMsg, doneMsg]) as never, {
      db: db as never,
      env: { POSTHOG_KEY: 'test-key' },
    });

    expect(settleCalls).toHaveLength(1);
    expect(settleCalls[0]).toMatchObject({ p_queue_item_id: 'item-live' });
    expect(liveMsg.ack).toHaveBeenCalledTimes(1);
    expect(doneMsg.ack).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.last_dlq_fast).toBe(1);
  });
});

// ==========================================
// Heartbeat lane counters
// ==========================================

describe('Heartbeat lane counters (spec 121)', () => {
  function captureDb(error: unknown = null) {
    const upserts: Record<string, unknown>[] = [];
    return {
      upserts,
      db: {
        from: vi.fn(() => ({
          upsert: vi.fn(async (row: Record<string, unknown>) => {
            upserts.push(row);
            return { error };
          }),
        })),
      },
    };
  }

  it('writes per-lane enqueued counters on a full tick record', async () => {
    const { db, upserts } = captureDb();
    const ok = await recordHeartbeat(db as never, {
      success: true,
      claimed: 12,
      enqueuedFast: 9,
      enqueuedHeavy: 3,
    });
    expect(ok).toBe(true);
    expect(upserts[0]).toMatchObject({
      last_claimed_count: 12,
      last_enqueued_fast: 9,
      last_enqueued_heavy: 3,
    });
  });

  it('counts-only writes touch only the counters they carry', async () => {
    const { db, upserts } = captureDb();
    await recordHeartbeat(db as never, {
      success: true,
      countsOnly: true,
      dlqHeavy: 2,
    });
    expect(upserts[0]?.last_dlq_heavy).toBe(2);
    expect(upserts[0]?.last_run_at).toBeUndefined();
    expect(upserts[0]?.last_success_at).toBeUndefined();
    expect(upserts[0]?.last_claimed_count).toBeUndefined();
  });

  it('swallows heartbeat write errors (e.g. lane columns not yet migrated) without throwing', async () => {
    const { db } = captureDb(new Error('column last_enqueued_fast does not exist'));
    await expect(
      recordHeartbeat(db as never, { success: true, claimed: 1, enqueuedFast: 1 })
    ).resolves.toBe(false);
  });
});
