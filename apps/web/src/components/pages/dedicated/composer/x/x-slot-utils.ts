/**
 * The X composer's posting slots (spec 132 §4.5 queue intent).
 *
 * The composer's queue intent reads the destination's posting slots
 * from the destination posting-slots endpoint (the enabling backend,
 * #756) — the unified `posting_slots` rows, never the legacy per-page
 * slots. Occurrence maths reuses the shared slot helpers: a destination
 * slot maps onto the `PageSlotSummary` shape with its `kind` list as
 * the covered formats (an empty list covers every kind, matching the
 * server's vacancy resolution).
 */
import type { DestinationPostingSlot } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../../tab-dashboard';
import { formatSlotShort, getNextOccurrence, getNextSlotForFormat } from '../queue-slot-utils';

/** The post kinds an X composer can produce (the enqueue kind union). */
export type XPostKind = 'text' | 'image' | 'video';

export function destinationSlotSummaries(
  slots: readonly DestinationPostingSlot[],
  timezone: string,
): PageSlotSummary[] {
  return slots.map((slot) => ({
    id: slot.id,
    slotTime: slot.timeOfDay,
    timezone,
    isActive: slot.isActive,
    allowedFormats: slot.kind,
  }));
}

/**
 * The next slot occurrence (strictly after `now`) whose slot covers
 * `kind`, or null when no active slot covers it.
 */
export function nextXSlotOccurrence(
  slots: readonly DestinationPostingSlot[],
  timezone: string,
  kind: XPostKind,
  now: Date = new Date(),
): { slot: PageSlotSummary; occurrence: Date } | null {
  const summaries = destinationSlotSummaries(slots, timezone);
  const slot = getNextSlotForFormat(summaries, kind, now);
  if (!slot) {
    return null;
  }
  const occurrence = getNextOccurrence(slot, now);
  return occurrence ? { slot, occurrence } : null;
}

/** The "goes out at the next posting time" line for the queue intent. */
export function xQueueGoesOutLine(occurrence: Date, timezone: string): string {
  return `Goes out at the next posting time: ${formatSlotShort(occurrence, timezone)} ${timezone}.`;
}
