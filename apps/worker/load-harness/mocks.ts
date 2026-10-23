/**
 * Mock publishers for the spec 122 load harness (spec 119 §5.2).
 *
 * Generalises the MockFacebookPublishClient pattern (apps/worker/src/fb-client.ts)
 * to all six platforms behind the contracts `Publisher` interface. Mocks only —
 * no real platform is contacted and no real publisher behaviour is specced here.
 *
 * Simulated latency profile (documented, per lane — "Facebook-shaped costs
 * generalised"): a fast-lane publish is one request/response platform call;
 * a heavy-lane publish is an upload-style call set. Values are the in-region
 * API-call costs the pipeline design assumes, compressed from wide-area Graph
 * timings so a local drain finishes in hours, not days:
 *   fast:  facebook 25ms · instagram 35ms · threads 30ms · x 20ms ·
 *          tiktok 30ms · youtube 40ms (text only)
 *   heavy: facebook 120ms · instagram 150ms · threads 120ms · x 140ms ·
 *          tiktok 150ms · youtube 200ms
 * A deterministic per-item jitter of ±25% (FNV-1a hash of the item id) keeps
 * latencies reproducible across runs. Per-consumer throughput measured under
 * this profile is what the certification derives its 1M/day figure from.
 *
 * Outcome model (deterministic, by item-id hash):
 *   hash % 100 == 0        → permanent failure (settles `failed`)
 *   hash % 100 in {1, 2}   → retryable failure on the FIRST attempt only,
 *                            with a 1s retry delay (settles `queued`, is
 *                            re-claimed, then publishes)
 *   otherwise              → published
 * Expected mix: ~97% published, ~1% failed, ~2% retried-then-published.
 *
 * Idempotency ledger: every publish call is recorded (item id → attempts,
 * successes). A duplicate publish is an item with >1 recorded success —
 * the certification requires exactly 0.
 */
import type {
  ClassifiedPublishError,
  DatabaseDestinationRow,
  DatabaseSocialAccountRow,
  DatabaseUnifiedQueueItemRow,
  Platform,
  Publisher,
  PublisherTokenSet,
  PublishOutcome,
  RefreshedTokenSet,
} from '@fbuploadpro/contracts';
import { routePublishLaneForItem, PUBLISH_LANE_FAST } from '@fbuploadpro/contracts';

export const FAST_LATENCY_MS: Record<Platform, number> = {
  facebook: 25,
  instagram: 35,
  threads: 30,
  x: 20,
  tiktok: 30,
  youtube: 40,
};

export const HEAVY_LATENCY_MS: Record<Platform, number> = {
  facebook: 120,
  instagram: 150,
  threads: 120,
  x: 140,
  tiktok: 150,
  youtube: 200,
};

/** FNV-1a 32-bit hash — deterministic across runs and processes. */
export function hashItemId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface LedgerEntry {
  attempts: number;
  successes: number;
}

export class IdempotencyLedger {
  private readonly entries = new Map<string, LedgerEntry>();
  /** Successful publishes by `${platform}|${lane}` — per-lane drain rates. */
  readonly successesByPlatformLane = new Map<string, number>();

  recordAttempt(itemId: string): number {
    const entry = this.entries.get(itemId) ?? { attempts: 0, successes: 0 };
    entry.attempts += 1;
    this.entries.set(itemId, entry);
    return entry.attempts;
  }

  recordSuccess(itemId: string, platform?: Platform, lane?: string): void {
    const entry = this.entries.get(itemId) ?? { attempts: 0, successes: 0 };
    entry.successes += 1;
    this.entries.set(itemId, entry);
    if (platform && lane) {
      const key = `${platform}|${lane}`;
      this.successesByPlatformLane.set(key, (this.successesByPlatformLane.get(key) ?? 0) + 1);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  totalAttempts(): number {
    let n = 0;
    for (const e of this.entries.values()) n += e.attempts;
    return n;
  }

  totalSuccesses(): number {
    let n = 0;
    for (const e of this.entries.values()) n += e.successes;
    return n;
  }

  /** Items with more than one successful publish — must be 0 to certify. */
  duplicates(): Array<{ itemId: string; successes: number }> {
    const out: Array<{ itemId: string; successes: number }> = [];
    for (const [itemId, e] of this.entries) {
      if (e.successes > 1) out.push({ itemId, successes: e.successes });
    }
    return out;
  }

  /** Items whose first attempt was a retryable failure and later succeeded. */
  retriedThenPublished(): number {
    let n = 0;
    for (const e of this.entries.values()) {
      if (e.attempts > 1 && e.successes === 1) n += 1;
    }
    return n;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockPublisher implements Publisher {
  constructor(
    readonly platform: Platform,
    private readonly ledger: IdempotencyLedger
  ) {}

  async publish(
    item: DatabaseUnifiedQueueItemRow,
    _destination: DatabaseDestinationRow,
    _tokens: PublisherTokenSet
  ): Promise<PublishOutcome> {
    const lane = routePublishLaneForItem(item);
    const base =
      lane === PUBLISH_LANE_FAST ? FAST_LATENCY_MS[this.platform] : HEAVY_LATENCY_MS[this.platform];
    const hash = hashItemId(item.id);
    const jitter = 0.75 + ((hash % 100) / 100) * 0.5; // 0.75×–1.25×, deterministic
    await sleep(Math.max(1, Math.round(base * jitter)));

    const attempt = this.ledger.recordAttempt(item.id);
    const bucket = hash % 100;

    if (bucket === 0) {
      return {
        status: 'failed',
        error: {
          kind: 'permanent',
          code: 'mock_permanent_rejection',
          message: `Mock ${this.platform} permanent rejection for item ${item.id}`,
        },
      };
    }
    if ((bucket === 1 || bucket === 2) && attempt === 1) {
      return {
        status: 'retry',
        retryDelaySeconds: 1,
        error: {
          kind: 'retryable',
          code: 'mock_transient',
          message: `Mock ${this.platform} transient failure for item ${item.id}`,
          retryDelaySeconds: 1,
        },
      };
    }
    this.ledger.recordSuccess(item.id, this.platform, lane);
    return {
      status: 'published',
      externalPostId: `mock-${this.platform}-${item.id}`,
    };
  }

  refreshTokens(
    _account: DatabaseSocialAccountRow,
    tokens: PublisherTokenSet
  ): Promise<RefreshedTokenSet> {
    // Provider/mock platforms in the harness never rotate tokens; the
    // refresh job is not under test here.
    return Promise.resolve({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      tokenExpiresAt: tokens.tokenExpiresAt ?? null,
    });
  }

  mapError(err: unknown): ClassifiedPublishError {
    return {
      kind: 'permanent',
      code: 'mock_unclassified',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
