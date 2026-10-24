import type { DestinationPostingSlot } from '@fbuploadpro/contracts';
import {
  formatSlotShort,
  getNextOccurrence,
} from '../composer/queue-slot-utils';
import type { PageSlotSummary } from '../tab-dashboard';

/**
 * Slot helpers for the unified destination composers (spec 132 gated
 * sets). Unified `posting_slots` are daily recurring wall-clock times
 * in the destination's timezone, each carrying the queue kinds it
 * covers (`kind` list, in the unified kind vocabulary). Occurrence
 * math reuses the Facebook composer's timezone-safe helpers
 * (`queue-slot-utils`) by mapping a destination slot onto the summary
 * shape they consume — the display line and the server's vacancy
 * resolution (`calculateNextVacantSlot`) describe the same recurrence;
 * the server still picks the actual vacant slot on submit.
 */

export type DestinationPostKind =
  'text' | 'image' | 'video' | 'story' | 'carousel';

/** Maps a unified destination slot onto the summary shape the shared occurrence math consumes. */
export function destinationSlotSummary(
  slot: DestinationPostingSlot,
  timezone: string,
): PageSlotSummary {
  return {
    id: slot.id,
    slotTime: slot.timeOfDay,
    timezone,
    isActive: slot.isActive,
    allowedFormats: slot.kind,
  };
}

/**
 * True when the slot is active and covers the post kind. An empty kind
 * list covers every kind — the same semantics the server applies
 * (`calculateNextVacantSlot` via `slotCoversFormat`).
 */
export function slotCoversKind(
  slot: DestinationPostingSlot,
  kind: DestinationPostKind,
): boolean {
  if (!slot.isActive) return false;
  if (slot.kind.length === 0) return true;
  return slot.kind.includes(kind);
}

export interface NextSlotForKind {
  slot: DestinationPostingSlot;
  occurrence: Date;
}

/**
 * The active slot covering `kind` whose next occurrence is earliest,
 * or null when no slot covers the kind. Client-side display helper —
 * the server still resolves vacancy on submit.
 */
export function getNextSlotForKind(
  slots: DestinationPostingSlot[],
  kind: DestinationPostKind,
  timezone: string,
  from: Date = new Date(),
): NextSlotForKind | null {
  let best: NextSlotForKind | null = null;
  for (const slot of slots) {
    if (!slotCoversKind(slot, kind)) continue;
    const occurrence = getNextOccurrence(
      destinationSlotSummary(slot, timezone),
      from,
    );
    if (!occurrence) continue;
    if (!best || occurrence.getTime() < best.occurrence.getTime()) {
      best = { slot, occurrence };
    }
  }
  return best;
}

/**
 * Queue-intent line, e.g. "Goes out at the next posting time for
 * Videos: Tue 9:00 AM UTC." — the timezone is always labelled so the
 * time is never misread as local time (same pattern as the Facebook
 * composer's line, with the kind label in place of the format label).
 */
export function destinationQueueGoesOutLine(
  kindLabel: string,
  occurrence: Date,
  timezone: string,
): string {
  return `Goes out at the next posting time for ${kindLabel}: ${formatSlotShort(occurrence, timezone)} ${timezone}.`;
}
