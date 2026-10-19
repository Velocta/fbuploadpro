import { type PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import {
  getMediaItemError,
  type ComposerMediaItem,
} from '../composer/composer-media-area';
import {
  formatSlotShort,
  getNextOccurrence,
  getNextSlotForFormat,
  hasRealCaption,
} from '../composer/queue-slot-utils';

export type BulkDestination = 'queue' | 'schedule';

export interface BulkAssignedTime {
  date: Date;
  timezone: string;
}

export interface PartitionedAssets {
  eligible: ComposerMediaItem[];
  excluded: ComposerMediaItem[];
}

/** Splits selected assets into those usable with `format` and those excluded. */
export function partitionAssets(
  assets: ComposerMediaItem[],
  format: PostFormat
): PartitionedAssets {
  const eligible: ComposerMediaItem[] = [];
  const excluded: ComposerMediaItem[] = [];
  for (const asset of assets) {
    if (getMediaItemError(asset, format)) excluded.push(asset);
    else eligible.push(asset);
  }
  return { eligible, excluded };
}

/**
 * Successive posting times for `count` posts of `format`, in selection order:
 * each post takes the next slot occurrence covering its format after the
 * previous one. Returns fewer entries than `count` when coverage runs out.
 */
export function computeBulkQueueTimes(
  slots: PageSlotSummary[],
  format: PostFormat,
  count: number,
  from: Date = new Date()
): BulkAssignedTime[] {
  const times: BulkAssignedTime[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const slot = getNextSlotForFormat(slots, format, cursor);
    if (!slot) break;
    const occurrence = getNextOccurrence(slot, cursor);
    if (!occurrence) break;
    times.push({ date: occurrence, timezone: slot.timezone });
    cursor = occurrence;
  }
  return times;
}

/** "12 posts → Tue 9:00 AM … Fri 6:00 PM" (queue destination summary line). */
export function describeQueueRange(times: BulkAssignedTime[]): string | null {
  if (times.length === 0) return null;
  const first = times[0];
  const last = times.at(-1) ?? first;
  const firstLabel = formatSlotShort(first.date, first.timezone);
  const lastLabel = formatSlotShort(last.date, last.timezone);
  return times.length === 1
    ? `1 post → ${firstLabel}`
    : `${times.length} ${pluralize(times.length, 'post', 'posts')} → ${firstLabel} … ${lastLabel}`;
}

/**
 * Suggested format to switch to when assets were excluded: the natural format
 * shared by all excluded assets, or null when they disagree.
 */
export function suggestFormatForExcluded(
  excluded: ComposerMediaItem[]
): PostFormat | null {
  if (excluded.length === 0) return null;
  const natural = excluded.map((a) => (a.mediaType === 'video' ? 'video' : 'image'));
  return natural.every((f) => f === natural[0]) ? natural[0] : null;
}

const FORMAT_LABELS: Record<PostFormat, string> = {
  text: 'Text',
  image: 'Photo',
  video: 'Video',
  reel: 'Reel',
  story: 'Story',
};

/** Sentence-case label for a post format ("Photo", "Reel", …). */
export function formatLabel(format: PostFormat): string {
  return FORMAT_LABELS[format];
}

/** "1 post" / "2 posts" — sentence-case pluralization for counts. */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Caption for a review row: an explicit per-row override wins, then the
 * asset's real library caption (never filename-derived), then the shared
 * caption, else empty.
 */
export function resolveRowCaption(
  asset: ComposerMediaItem,
  sharedCaption: string,
  overrides: Readonly<Record<string, string>>
): string {
  if (Object.hasOwn(overrides, asset.id)) {
    return overrides[asset.id] ?? '';
  }
  if (hasRealCaption(asset) && asset.captionText) {
    return asset.captionText;
  }
  return sharedCaption.trim() ? sharedCaption : '';
}
