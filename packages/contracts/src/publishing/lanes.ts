import type {
  DatabaseUnifiedQueueItemRow,
  Platform,
} from '../domain/database.js';

// ==========================================
// Lane routing (spec 121 Scope.2, spec 119 §5.1)
// ==========================================
//
// THE single source of lane assignment for the publish pipeline. A queue
// item's lane is derivable from its `queue_items` row alone — by
// (`platform`, `kind`, `platform_format`) — and no second routing rule
// may exist anywhere else (spec 121 Acceptance). Platform specs
// (122, 124–127) register their formats by ensuring their composers
// write the `kind`/`platform_format` values this table understands; they
// never add routing logic of their own.
//
//   - `publish-fast`  — text/image/link/carousel posts and any platform
//                       call-set that is request/response-light.
//   - `publish-heavy` — anything streaming bytes: reels, video uploads,
//                       stories, YouTube resumable/provider uploads,
//                       X chunked video.

export const PUBLISH_LANE_FAST = 'publish-fast';
export const PUBLISH_LANE_HEAVY = 'publish-heavy';

export type PublishLane = typeof PUBLISH_LANE_FAST | typeof PUBLISH_LANE_HEAVY;

export const PUBLISH_LANES: readonly PublishLane[] = [
  PUBLISH_LANE_FAST,
  PUBLISH_LANE_HEAVY,
];

/** The unified schema's normalised post kind (`queue_items.kind`). */
export type QueueItemKind = DatabaseUnifiedQueueItemRow['kind'];

export const QUEUE_ITEM_KINDS: readonly QueueItemKind[] = [
  'text',
  'image',
  'video',
  'story',
  'carousel',
];

const FAST = PUBLISH_LANE_FAST;
const HEAVY = PUBLISH_LANE_HEAVY;

/**
 * The exact per-(platform, kind) lane table.
 *
 * Reading notes:
 *   - `video` and `story` are heavy on every platform: both always move
 *     media bytes (upload sessions, chunked uploads, provider uploads).
 *   - `text`, `image`, and `carousel` are fast wherever the platform's
 *     publish call-set ingests by reference (public URL / simple upload)
 *     and never streams bytes through the worker — Facebook photo posts,
 *     IG/Threads containers, X simple image upload, TikTok photo posts
 *     via the provider.
 *   - YouTube is the one deviation: every media-bearing kind is heavy,
 *     because the only YouTube publish path is a resumable/provider
 *     upload. YouTube has no text posts; the `text` entry exists only so
 *     the table is total (a text row carries no bytes, so it is fast).
 *   - Kinds a platform does not offer (e.g. Threads stories, X stories)
 *     still carry an entry so routing is total over the schema's kind
 *     set; the entry follows the universal rule for that kind.
 */
export const LANE_ROUTING_TABLE: Record<Platform, Record<QueueItemKind, PublishLane>> = {
  facebook: {
    text: FAST,
    image: FAST,
    video: HEAVY,
    story: HEAVY,
    carousel: FAST,
  },
  instagram: {
    // Every Instagram video is a Reel; carousels and photos publish via
    // public-URL containers (request/response), never byte streams.
    text: FAST,
    image: FAST,
    video: HEAVY,
    story: HEAVY,
    carousel: FAST,
  },
  threads: {
    // Media is fetched by Meta from public URLs — there is no upload
    // endpoint — but video posts still isolate to the heavy lane with
    // the other byte-moving formats (long poll-publish state machine).
    text: FAST,
    image: FAST,
    video: HEAVY,
    story: HEAVY,
    carousel: FAST,
  },
  youtube: {
    text: FAST,
    image: HEAVY,
    video: HEAVY,
    story: HEAVY,
    carousel: HEAVY,
  },
  x: {
    // Images use the simple upload; video uses chunked upload.
    text: FAST,
    image: FAST,
    video: HEAVY,
    story: HEAVY,
    carousel: FAST,
  },
  tiktok: {
    // Video publishes through the provider's upload flow (heavy); photo
    // posts are plain provider API calls (fast).
    text: FAST,
    image: FAST,
    video: HEAVY,
    story: HEAVY,
    carousel: FAST,
  },
};

/**
 * `platform_format` values (the platform's own format name: `reel`,
 * `short`, …) that always route heavy, whatever the normalised `kind`
 * says. This guards malformed/legacy rows whose `kind` understates the
 * format (e.g. a reel stored as `kind: 'image'`): the format the
 * publisher will actually execute decides the lane. Fast formats never
 * override the table — a `video` kind stays heavy even if its format
 * label looks light.
 */
const HEAVY_PLATFORM_FORMATS: ReadonlySet<string> = new Set([
  'reel',
  'reels',
  'short',
  'shorts',
  'video',
  'story',
  'stories',
]);

/**
 * Routes one (`platform`, `kind`, `platform_format`) triple to its lane.
 *
 * Resolution order (deterministic):
 *   1. A byte-streaming `platform_format` (see HEAVY_PLATFORM_FORMATS)
 *      routes heavy.
 *   2. The (platform, kind) entry in LANE_ROUTING_TABLE.
 *   3. Unknown combos (a `kind` outside the schema's set, reachable only
 *      from untyped data): heavy when the item bears media
 *      (`hasMedia`), otherwise fast.
 */
export function routePublishLane(
  platform: Platform,
  kind: QueueItemKind,
  platformFormat?: string | null | undefined,
  hasMedia?: boolean | undefined
): PublishLane {
  if (platformFormat) {
    if (HEAVY_PLATFORM_FORMATS.has(platformFormat.trim().toLowerCase())) {
      return HEAVY;
    }
  }

  // The table is total over the typed Platform/QueueItemKind unions;
  // the Partial view is what lets untyped runtime data (an unknown
  // platform/kind string) fall through to the deterministic fallback.
  const row = LANE_ROUTING_TABLE[platform] as
    | Partial<Record<QueueItemKind, PublishLane>>
    | undefined;
  const lane = row?.[kind];
  if (lane !== undefined) {
    return lane;
  }

  return hasMedia ? HEAVY : FAST;
}

/** The row shape lane routing needs — a `queue_items` row alone suffices. */
export interface LaneRoutableQueueItem {
  platform: Platform;
  kind: QueueItemKind;
  platform_format?: string | null | undefined;
  media_item_id?: string | null | undefined;
  media_url?: string | null | undefined;
  media_storage_key?: string | null | undefined;
}

/** Routes a queue item (or any row carrying the same fields) to its lane. */
export function routePublishLaneForItem(item: LaneRoutableQueueItem): PublishLane {
  const hasMedia = Boolean(item.media_item_id ?? item.media_url ?? item.media_storage_key);
  return routePublishLane(item.platform, item.kind, item.platform_format, hasMedia);
}

/**
 * The `kind` values belonging to one lane for one platform — the
 * `p_lane_kind_set` argument for the unified `claim_due_queue_items`
 * RPC. Derived from LANE_ROUTING_TABLE so the claim filter can never
 * drift from the routing function. Note it is kind-only by design: the
 * heavy `platform_format` override above only fires for formats whose
 * kinds are already heavy in the table (reel/short are `video`-kind,
 * stories are `story`-kind), so no claimable item can be claimed into
 * the wrong lane.
 */
export function getLaneKindSet(platform: Platform, lane: PublishLane): QueueItemKind[] {
  const row = LANE_ROUTING_TABLE[platform];
  return QUEUE_ITEM_KINDS.filter((kind) => row[kind] === lane);
}
