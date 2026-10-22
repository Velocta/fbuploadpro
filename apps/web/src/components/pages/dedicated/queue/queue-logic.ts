import type { PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import type { DedicatedQueueItem, QueueFilter } from './queue-types';
import {
  slotCoversFormat,
  getNextSlotForFormat,
  getNextOccurrence,
  formatSlotLong,
  formatSlotShort,
} from '../composer/queue-slot-utils';
import { formatLabel } from '../bulk/bulk-utils';

const MINUTE_MS = 60_000;

/** Effective post format: stored format, else derived from media, else text. */
export function resolveFormat(item: DedicatedQueueItem): PostFormat {
  if (item.postFormat) return item.postFormat;
  if (item.media) return item.media.mediaType === 'video' ? 'video' : 'image';
  return 'text';
}

/** Plural display for a format ("Photos", "Reels", "Stories"). */
export function formatPlural(format: PostFormat): string {
  const label = formatLabel(format);
  return label === 'Story' ? 'Stories' : `${label}s`;
}

/** "Photos, Reels" or "All formats" for a slot's coverage. */
export function describeSlotCoverage(slot: PageSlotSummary): string {
  const allowed = slot.allowedFormats;
  if (!allowed || allowed.length === 0) return 'all formats';
  return allowed.map((f) => formatPlural(f as PostFormat)).join(', ');
}

// ---------------------------------------------------------------------------
// Row time text
// ---------------------------------------------------------------------------

export type QueueRowTimeBucket = 'queued' | 'scheduled' | 'published' | 'failed';

/**
 * Queue row time text with the page timezone labelled, matching the other
 * page surfaces (e.g. "Scheduled for Tue, Oct 27 at 3:00 PM UTC"). Without
 * the label the time reads as browser-local time.
 */
export function formatQueueRowTime(
  item: DedicatedQueueItem,
  bucket: QueueRowTimeBucket,
  timeZone: string
): string {
  const date = new Date(item.scheduledTime);
  if (Number.isNaN(date.getTime())) return '';
  const label = timeZone || 'UTC';
  switch (bucket) {
    case 'queued':
    case 'failed':
      return `${formatSlotShort(date, timeZone)} ${label}`;
    case 'scheduled':
      return `Scheduled for ${formatSlotLong(date, timeZone)} ${label}`;
    case 'published': {
      const published = item.publishedAt ? new Date(item.publishedAt) : date;
      const when = Number.isNaN(published.getTime()) ? date : published;
      return `Published ${formatSlotLong(when, timeZone)} ${label}`;
    }
  }
}

// ---------------------------------------------------------------------------
// Slot matching
// ---------------------------------------------------------------------------

function parseSlotTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function wallClockParts(date: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    const value = Number(part?.value ?? NaN);
    // en-US hour12:false can render midnight as "24"
    if (type === 'hour' && value === 24) return 0;
    return value;
  };
  return { hour: get('hour'), minute: get('minute') };
}

/**
 * The active posting slot whose time-of-day matches the item's scheduled time
 * (in the workspace timezone), or null when the item carries a custom time.
 * Positions without a governing slot impose no format constraint on reorder.
 */
export function matchSlotForTime(
  scheduledTimeISO: string,
  slots: PageSlotSummary[],
  timeZone: string
): PageSlotSummary | null {
  const date = new Date(scheduledTimeISO);
  if (Number.isNaN(date.getTime())) return null;
  let zone = timeZone;
  try {
    wallClockParts(date, zone);
  } catch {
    zone = 'UTC';
  }
  const { hour, minute } = wallClockParts(date, zone);
  return (
    slots.find((slot) => {
      if (!slot.isActive) return false;
      const parsed = parseSlotTime(slot.slotTime);
      return parsed !== null && parsed.hour === hour && parsed.minute === minute;
    }) ?? null
  );
}

/** True for queued/publishing items sitting on a posting slot. */
export function isSlotBased(
  item: DedicatedQueueItem,
  slots: PageSlotSummary[],
  timeZone: string
): boolean {
  if (item.status !== 'queued' && item.status !== 'publishing') return false;
  return matchSlotForTime(item.scheduledTime, slots, timeZone) !== null;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Splits pending posts into the Queued (slot-based) and Scheduled (custom
 * time) buckets. While posting slots are still loading, every pending post
 * reads as Queued — the common case — rather than misfiling everything as
 * Scheduled.
 */
export function filterItems(
  items: DedicatedQueueItem[],
  filter: QueueFilter,
  slots: PageSlotSummary[],
  timeZone: string,
  slotsLoaded: boolean
): DedicatedQueueItem[] {
  const isPending = (item: DedicatedQueueItem): boolean =>
    item.status === 'queued' || item.status === 'publishing';
  switch (filter) {
    case 'all':
      return items;
    case 'queued':
      return items.filter(
        (item) => isPending(item) && (!slotsLoaded || isSlotBased(item, slots, timeZone))
      );
    case 'scheduled':
      return items.filter(
        (item) => isPending(item) && slotsLoaded && !isSlotBased(item, slots, timeZone)
      );
    case 'published':
      return items.filter((item) => item.status === 'published');
    case 'failed':
      return items.filter((item) => item.status === 'failed');
  }
}

export function countByFilter(
  items: DedicatedQueueItem[],
  slots: PageSlotSummary[],
  timeZone: string,
  slotsLoaded: boolean
): Record<QueueFilter, number> {
  return {
    all: items.length,
    queued: filterItems(items, 'queued', slots, timeZone, slotsLoaded).length,
    scheduled: filterItems(items, 'scheduled', slots, timeZone, slotsLoaded).length,
    published: filterItems(items, 'published', slots, timeZone, slotsLoaded).length,
    failed: filterItems(items, 'failed', slots, timeZone, slotsLoaded).length,
  };
}

/** Chronological with upcoming first; published/failed keep their own order. */
export function sortForDisplay(items: DedicatedQueueItem[]): DedicatedQueueItem[] {
  return [...items].sort(
    (a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface QueueSummary {
  pendingCount: number;
  failedCount: number;
  runsThrough: Date | null;
}

export function summarizeQueue(items: DedicatedQueueItem[]): QueueSummary {
  const pending = items.filter(
    (item) => item.status === 'queued' || item.status === 'publishing'
  );
  let runsThrough: Date | null = null;
  for (const item of pending) {
    const date = new Date(item.scheduledTime);
    if (Number.isNaN(date.getTime())) continue;
    if (!runsThrough || date.getTime() > runsThrough.getTime()) runsThrough = date;
  }
  return {
    pendingCount: pending.length,
    failedCount: items.filter((item) => item.status === 'failed').length,
    runsThrough,
  };
}

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

export interface ReorderAssignment {
  id: string;
  scheduledTime: string;
}

export type ReorderPlan =
  | { assignments: ReorderAssignment[] }
  | { blocked: string };

/**
 * Plans a reorder of the visible reorderable list: times stay attached to
 * positions, content moves. Every item is validated against the posting slot
 * governing its new position — a single incompatible item blocks the whole
 * drop so the order never silently corrupts.
 */
export function planReorder(params: {
  ordered: DedicatedQueueItem[];
  fromIndex: number;
  toIndex: number;
  slots: PageSlotSummary[];
  timeZone: string;
}): ReorderPlan {
  const { ordered, fromIndex, toIndex, slots, timeZone } = params;
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
    return { assignments: [] };
  }
  const next = [...ordered];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return { assignments: [] };
  next.splice(toIndex, 0, moved);

  for (let i = 0; i < next.length; i++) {
    const positionTime = ordered[i].scheduledTime;
    const governing = matchSlotForTime(positionTime, slots, timeZone);
    if (!governing) continue;
    const format = resolveFormat(next[i] as DedicatedQueueItem);
    if (!slotCoversFormat(governing, format)) {
      return {
        blocked: `This posting time is for ${describeSlotCoverage(governing)} — this is a ${formatLabel(format).toLowerCase()}.`,
      };
    }
  }

  const assignments: ReorderAssignment[] = [];
  for (let i = 0; i < next.length; i++) {
    const item = next[i] as DedicatedQueueItem;
    const positionTime = (ordered[i] as DedicatedQueueItem).scheduledTime;
    if (item.scheduledTime !== positionTime) {
      assignments.push({ id: item.id, scheduledTime: positionTime });
    }
  }
  return { assignments };
}

// ---------------------------------------------------------------------------
// Reschedule
// ---------------------------------------------------------------------------

/** Another pending post already holding the target minute. */
export function findCollision(
  items: DedicatedQueueItem[],
  excludeId: string,
  newTimeISO: string
): DedicatedQueueItem | null {
  const target = new Date(newTimeISO).getTime();
  if (Number.isNaN(target)) return null;
  return (
    items.find(
      (item) =>
        item.id !== excludeId &&
        (item.status === 'queued' || item.status === 'publishing') &&
        Math.abs(new Date(item.scheduledTime).getTime() - target) < MINUTE_MS
    ) ?? null
  );
}

/**
 * A time swap is only offered when both posts' formats are allowed by both
 * positions' posting times. Positions without a governing slot are
 * unconstrained.
 */
export function canSwapTimes(
  itemA: DedicatedQueueItem,
  itemB: DedicatedQueueItem,
  slots: PageSlotSummary[],
  timeZone: string
): boolean {
  const governingA = matchSlotForTime(itemA.scheduledTime, slots, timeZone);
  const governingB = matchSlotForTime(itemB.scheduledTime, slots, timeZone);
  const formatA = resolveFormat(itemA);
  const formatB = resolveFormat(itemB);
  if (governingA && !slotCoversFormat(governingA, formatB)) return false;
  if (governingB && !slotCoversFormat(governingB, formatA)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Failed posts
// ---------------------------------------------------------------------------

/**
 * Plain-language failure reason — never raw errors. The queue list API does
 * not expose publish-log detail, so `errorDetail` is optional and only
 * refines the message when a caller has it.
 */
export function getFailedReason(
  item: DedicatedQueueItem,
  connectionExpired: boolean,
  errorDetail?: string | null
): string {
  if (connectionExpired) {
    return 'Your Facebook connection expired before this posted.';
  }
  const detail = (errorDetail ?? '').toLowerCase();
  if (/(upload|media file|attachment)/.test(detail)) {
    return 'The media upload failed.';
  }
  if (/(reject|declin|policy|spam|not accept|permission|forbidden)/.test(detail)) {
    return "Facebook didn't accept this post.";
  }
  if (item.retryCount != null && item.maxRetries != null && item.retryCount >= item.maxRetries) {
    return `Tried ${item.maxRetries} times and still couldn't publish.`;
  }
  return 'Something went wrong while publishing.';
}

/**
 * Retry time for a failed post: a custom-scheduled post keeps its original
 * time when still in the future; otherwise the next posting time covering
 * the post's format. Null when no posting time covers the format.
 */
export function computeRetryTime(
  item: DedicatedQueueItem,
  slots: PageSlotSummary[],
  timeZone: string,
  now: Date = new Date()
): Date | null {
  const scheduled = new Date(item.scheduledTime);
  const isCustom =
    item.status === 'failed' &&
    matchSlotForTime(item.scheduledTime, slots, timeZone) === null;
  if (isCustom && !Number.isNaN(scheduled.getTime()) && scheduled.getTime() > now.getTime()) {
    return scheduled;
  }
  const format = resolveFormat(item);
  const slot = getNextSlotForFormat(slots, format, now);
  if (!slot) return null;
  return getNextOccurrence(slot, now);
}
