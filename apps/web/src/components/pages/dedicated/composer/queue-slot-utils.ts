import { type PostFormat, deriveDefaultCaptionFromFilename } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';

/**
 * Pure helpers for resolving a page's recurring posting slots against a post
 * format. Used by the composer (intent selector, schedule defaults, queue
 * "goes out" line) and shared with specs 104/105.
 *
 * A slot's `slotTime` is a wall-clock "HH:MM" string in the slot's `timezone`.
 * All occurrence math is done with Intl in that timezone so DST transitions
 * are handled by the platform, not by manual offset arithmetic.
 */

// ---------------------------------------------------------------------------
// Timezone-safe date math (Intl-based)
// ---------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function resolveValidTimezone(tz: string | null | undefined): string {
  if (!tz || typeof tz !== 'string') return 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function getPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function getZonedParts(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; minute: number } {
  const rawParts = Object.fromEntries(
    getPartsFormatter(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  ) as Record<string, string | undefined>;
  const num = (key: string): number => Number.parseInt(rawParts[key] ?? '0', 10);
  return {
    year: num('year'),
    month: num('month'),
    day: num('day'),
    hour: num('hour'),
    minute: num('minute'),
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  return localAsUtc - date.getTime();
}

/** Builds the absolute Date for a wall-clock time in `timeZone` (DST-aware). */
function makeZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const targetLocal = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guess = targetLocal - getTimezoneOffsetMs(new Date(targetLocal), timeZone);
  const offset = getTimezoneOffsetMs(new Date(guess), timeZone);
  return new Date(targetLocal - offset);
}

function parseSlotTime(slotTime: string): { hour: number; minute: number } | null {
  if (!slotTime || typeof slotTime !== 'string') return null;
  const parts = slotTime.trim().split(':');
  if (parts.length < 2) return null;
  const hour = Number.parseInt(parts[0] ?? '', 10);
  const minute = Number.parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

// ---------------------------------------------------------------------------
// Slot coverage
// ---------------------------------------------------------------------------

/** True when the slot is active and allows the given post format. */
export function slotCoversFormat(slot: PageSlotSummary, format: PostFormat): boolean {
  if (!slot.isActive) return false;
  const allowed = slot.allowedFormats;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(format);
}

/** Next absolute occurrence of this slot strictly after `from`. Null on bad data. */
export function getNextOccurrence(slot: PageSlotSummary, from: Date): Date | null {
  const parsed = parseSlotTime(slot.slotTime);
  if (!parsed) return null;
  const timeZone = resolveValidTimezone(slot.timezone);
  const base = getZonedParts(from, timeZone);
  // Check today, then walk forward a year at most (recurring daily slots).
  for (let dayOffset = 0; dayOffset <= 366; dayOffset++) {
    const baseLocalUtc = Date.UTC(base.year, base.month - 1, base.day + dayOffset);
    const target = new Date(baseLocalUtc);
    const occurrence = makeZonedDate(
      target.getUTCFullYear(),
      target.getUTCMonth() + 1,
      target.getUTCDate(),
      parsed.hour,
      parsed.minute,
      timeZone
    );
    if (occurrence.getTime() > from.getTime()) return occurrence;
  }
  return null;
}

/**
 * Returns the active slot covering `format` whose next occurrence is earliest,
 * or null when no slot covers the format. Client-side display helper — the
 * server still picks the actual vacant slot on submit.
 */
export function getNextSlotForFormat(
  slots: PageSlotSummary[],
  format: PostFormat,
  from: Date = new Date()
): PageSlotSummary | null {
  let best: PageSlotSummary | null = null;
  let bestTime = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    if (!slotCoversFormat(slot, format)) continue;
    const occurrence = getNextOccurrence(slot, from);
    if (!occurrence) continue;
    const time = occurrence.getTime();
    if (time < bestTime) {
      bestTime = time;
      best = slot;
    }
  }
  return best;
}

/** "Tue, Oct 21 at 9:00 AM" in the given timezone. */
export function formatSlotLong(date: Date, timeZone: string | null | undefined): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveValidTimezone(timeZone),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/, (\d{1,2}:\d{2} [AP]M)$/, ' at $1');
}

/** "Tue 9:00 AM" in the given timezone. */
export function formatSlotShort(date: Date, timeZone: string | null | undefined): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: resolveValidTimezone(timeZone),
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Converts a Date to a datetime-local input value ("2026-10-21T09:00") in the timezone. */
export function toDateTimeLocalValue(date: Date, timeZone: string | null | undefined): string {
  const tz = resolveValidTimezone(timeZone);
  const parts = getZonedParts(date, tz);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Interprets a datetime-local input value as wall-clock time in the timezone. */
export function parseDateTimeLocalValue(
  value: string,
  timeZone: string | null | undefined
): Date | null {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return makeZonedDate(year, month, day, hour, minute, resolveValidTimezone(timeZone));
}

// ---------------------------------------------------------------------------
// Caption heuristic
// ---------------------------------------------------------------------------

export interface CaptionCarrier {
  name: string;
  captionText?: string | null | undefined;
}

/**
 * Distinguishes a real user-written library caption from the filename-derived
 * default the import pipeline stamps on every upload. Only genuine captions
 * may pre-fill the composer caption (brief §3.4); filename-derived ones never
 * do. No caption-source flag exists on the data model, so this compares
 * against the same derivation function the import path uses.
 */
export function hasRealCaption(item: CaptionCarrier): boolean {
  const caption = item.captionText?.trim();
  if (!caption) return false;
  return caption !== deriveDefaultCaptionFromFilename(item.name).trim();
}
