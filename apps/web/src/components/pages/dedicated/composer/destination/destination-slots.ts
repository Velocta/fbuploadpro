import type { ListDestinationPostingSlotsResponse } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../../tab-dashboard';
import {
  formatSlotLong,
  formatSlotShort,
  getNextOccurrence,
} from '../queue-slot-utils';

/**
 * Destination posting-slot math for the gated composer sets (spec 132).
 *
 * The unified `posting_slots` a destination owns are DAILY wall-clock
 * times (`timeOfDay`) in the destination's own timezone, each carrying
 * the list of post formats it covers. The Facebook composer's slot
 * utilities already do the timezone-correct occurrence math over the
 * `PageSlotSummary` shape, so destination slots are adapted into that
 * shape and every computation reuses them — one slot engine, no second
 * timezone implementation.
 *
 * Coverage follows the enqueue endpoint's own rule (the server still
 * resolves the actual vacant slot on submit): a slot covers a format
 * when its `kind` list is empty or contains the post's format key —
 * `platformFormat ?? kind` of the enqueue request, which each composer
 * passes in as `formatKey`.
 */
export interface DestinationSlotView extends PageSlotSummary {
  /** The slot's declared format coverage, in enqueue format keys. */
  allowedFormats: string[];
}

export function toDestinationSlotViews(
  response: ListDestinationPostingSlotsResponse
): DestinationSlotView[] {
  return response.slots.map((slot) => ({
    id: slot.id,
    // The occurrence math parses "HH:MM"; the unified shape is "HH:MM:SS".
    slotTime: slot.timeOfDay.slice(0, 5),
    timezone: response.timezone,
    isActive: slot.isActive,
    allowedFormats: [...slot.kind],
  }));
}

/** True when the slot is active and covers the given enqueue format key. */
export function destinationSlotCoversFormat(
  slot: DestinationSlotView,
  formatKey: string
): boolean {
  if (!slot.isActive) return false;
  if (!slot.allowedFormats || slot.allowedFormats.length === 0) return true;
  return slot.allowedFormats.includes(formatKey);
}

export interface NextDestinationSlot {
  slot: DestinationSlotView;
  occurrence: Date;
}

/**
 * The active slot covering `formatKey` whose next occurrence is
 * earliest, or null when no slot covers the format. Client-side display
 * helper — the server still picks the actual vacant slot on submit.
 */
export function getNextDestinationSlot(
  slots: DestinationSlotView[],
  formatKey: string,
  from: Date = new Date()
): NextDestinationSlot | null {
  let best: NextDestinationSlot | null = null;
  for (const slot of slots) {
    if (!destinationSlotCoversFormat(slot, formatKey)) continue;
    const occurrence = getNextOccurrence(slot, from);
    if (!occurrence) continue;
    if (!best || occurrence.getTime() < best.occurrence.getTime()) {
      best = { slot, occurrence };
    }
  }
  return best;
}

/**
 * Queue-intent line, e.g. "Goes out at the next posting time for Reels:
 * Tue 9:00 AM UTC." — the timezone is always labelled so the time is
 * never misread as local time (FB queue-slot-utils parity). A null
 * label gives the labelless form ("Goes out at the next posting time:
 * Tue 9:00 AM UTC.") for composers whose post kind needs no format
 * naming (the X set, spec 132 §4.5).
 */
export function destinationQueueGoesOutLine(
  formatPluralLabel: string | null,
  occurrence: Date,
  timeZone: string
): string {
  return formatPluralLabel
    ? `Goes out at the next posting time for ${formatPluralLabel}: ${formatSlotShort(occurrence, timeZone)} ${timeZone}.`
    : `Goes out at the next posting time: ${formatSlotShort(occurrence, timeZone)} ${timeZone}.`;
}

export { formatSlotLong, formatSlotShort };
