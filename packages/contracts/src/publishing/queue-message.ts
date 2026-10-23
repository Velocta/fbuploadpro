import { z } from 'zod';
import { PlatformSchema } from '../domain/database.js';
import { PUBLISH_LANE_FAST, PUBLISH_LANE_HEAVY } from './lanes.js';

// ==========================================
// Publish queue message (spec 139, contracts hardening)
// ==========================================
//
// The payload the claimer enqueues to a Cloudflare publish lane and the
// consumers receive: the queue item id plus the fields derivable from
// its row. Never tokens or media bytes. This mirrors the worker's
// local `PublishQueueMessage` shape (apps/worker/src/claimer.ts) —
// worker-side wiring to this schema is a later PR; this file is the
// contracts-layer source of truth for the wire shape.
//
// `schemaVersion` is the version gate for future message-shape changes.
// It is optional on the wire and defaults to the current version, so
// messages produced by current code (which carries no version field)
// still validate; parsed messages always carry the version.

/** Current PublishQueueMessage schema version. */
export const PUBLISH_QUEUE_MESSAGE_SCHEMA_VERSION = 1;

export const PublishLaneSchema = z.enum([PUBLISH_LANE_FAST, PUBLISH_LANE_HEAVY]);

export const PublishQueueMessageSchema = z.object({
  itemId: z.string().uuid(),
  platform: PlatformSchema,
  lane: PublishLaneSchema,
  schemaVersion: z
    .number()
    .int()
    .positive()
    .default(PUBLISH_QUEUE_MESSAGE_SCHEMA_VERSION),
});

/** A parsed queue message: `schemaVersion` is always present after parsing. */
export type PublishQueueMessage = z.infer<typeof PublishQueueMessageSchema>;

/**
 * A queue message as produced (before parsing): `schemaVersion` may be
 * omitted and is filled with the current version by the schema default.
 */
export type PublishQueueMessageInput = z.input<typeof PublishQueueMessageSchema>;
