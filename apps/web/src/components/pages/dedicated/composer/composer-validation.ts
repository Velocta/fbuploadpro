import type { PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import type { ComposerIntent } from './intent-selector';
import type { ComposerMediaItem } from './composer-media-area';
import {
  getNextSlotForFormat,
  getNextOccurrence,
  toDateTimeLocalValue,
} from './queue-slot-utils';
import { FORMAT_LABELS, pluralFormatLabel } from './format-labels';

/**
 * Composer validation + initial-state resolution (extracted from the
 * legacy 667-line `post-composer.tsx` orchestrator, spec 132 §3.4
 * decomposition). Behaviour is preserved verbatim from specs 103/111:
 * `computeValidationError` remains the single place deciding whether
 * submit is allowed and why not.
 */

const SINGLE_MEDIA_FORMATS: ReadonlySet<PostFormat> = new Set(['video', 'reel', 'story']);

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // A timezone lookup failure falls back to UTC — the labelled zone
    // every Page uses today (Shahzeb Q2: zones stay UTC).
    return 'UTC';
  }
}

export function roundUpToNextHour(from: Date): Date {
  const d = new Date(from.getTime());
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function timezoneForFormat(slots: PageSlotSummary[], format: PostFormat): string {
  return getNextSlotForFormat(slots, format)?.timezone ?? browserTimezone();
}

export function resolveInitialIntent(
  slots: PageSlotSummary[],
  initialIntent: ComposerIntent | undefined,
  initialPost: { scheduledTime: string } | undefined
): ComposerIntent {
  if (initialIntent) return initialIntent;
  if (initialPost) {
    // Best-effort intent guess: a future scheduled time reads as a custom
    // schedule, otherwise the queue. (105's edit flow can pass initialIntent.)
    const scheduledTime = new Date(initialPost.scheduledTime).getTime();
    if (!Number.isNaN(scheduledTime) && scheduledTime > Date.now()) return 'schedule';
    return 'queue';
  }
  return slots.some((s) => s.isActive) ? 'queue' : 'now';
}

/** Media carried into edit mode from the post being edited. */
export interface InitialPostMedia {
  mediaId?: string | null | undefined;
  media?: {
    name: string;
    mediaType: 'video' | 'image';
    thumbnailUrl?: string | null | undefined;
    url: string;
    durationSeconds?: number | null | undefined;
    width?: number | null | undefined;
    height?: number | null | undefined;
  } | null | undefined;
}

export function resolveInitialItems(initialPost: InitialPostMedia | undefined): ComposerMediaItem[] {
  const media = initialPost?.media;
  if (!media) return [];
  return [
    {
      id: initialPost.mediaId ?? 'initial-media',
      name: media.name,
      mediaType: media.mediaType,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      durationSeconds: media.durationSeconds,
      width: media.width,
      height: media.height,
    },
  ];
}

export function resolveInitialScheduleValue(
  initialPost: { scheduledTime: string; postFormat?: PostFormat } | undefined,
  slots: PageSlotSummary[]
): string {
  const format = initialPost?.postFormat ?? 'reel';
  if (initialPost) {
    const parsed = new Date(initialPost.scheduledTime);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateTimeLocalValue(parsed, timezoneForFormat(slots, format));
    }
  }
  const nextSlot = getNextSlotForFormat(slots, format);
  const date = (nextSlot ? getNextOccurrence(nextSlot, new Date()) : null) ?? roundUpToNextHour(new Date());
  return toDateTimeLocalValue(date, nextSlot?.timezone ?? browserTimezone());
}

export function getMediaCountError(items: ComposerMediaItem[], format: PostFormat): string | null {
  if (format === 'text' || items.length <= 1) return null;
  if (!SINGLE_MEDIA_FORMATS.has(format)) return null;
  const noun = format === 'story' ? 'file' : 'video';
  return `Choose one ${noun} for this ${FORMAT_LABELS[format].toLowerCase()}.`;
}

export interface ValidationContext {
  format: PostFormat;
  caption: string;
  hasItems: boolean;
  hasMediaTypeError: boolean;
  mediaCountError: string | null;
  linkValid: boolean;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  hasActiveSlots: boolean;
  hasCoveringSlot: boolean;
}

/** Single place deciding whether submit is allowed and why not. */
export function computeValidationError(ctx: ValidationContext): string | null {
  if (ctx.format === 'text' && !ctx.caption.trim()) return 'Write a caption for your text post.';
  if (ctx.format !== 'text' && !ctx.hasItems) return 'Choose media for this post.';
  if (ctx.hasMediaTypeError) return 'Remove or replace the flagged media to continue.';
  if (ctx.mediaCountError) return ctx.mediaCountError;
  if (!ctx.linkValid) return 'Fix the link before submitting.';
  if (ctx.intent === 'schedule' && !ctx.isScheduleInFuture) return 'Pick a time in the future.';
  if (ctx.intent === 'queue' && !ctx.hasActiveSlots) return 'Set posting times first.';
  if (ctx.intent === 'queue' && !ctx.hasCoveringSlot) {
    return `No posting time covers ${pluralFormatLabel(ctx.format)} yet.`;
  }
  return null;
}

export function composerTitle(isEdit: boolean, format: PostFormat): string {
  if (isEdit) return 'Edit post';
  if (format === 'text') return 'Create text post';
  return 'Create post';
}

export function composerDescription(isEdit: boolean, format: PostFormat): string {
  if (isEdit) return 'Update this post — it keeps its scheduled time unless you change it.';
  if (format === 'text') return 'Write a post — it publishes as text on your Page.';
  return 'Put together a post for your Page.';
}

export function submitButtonLabel(isEdit: boolean, intent: ComposerIntent): string {
  if (isEdit) return 'Save changes';
  if (intent === 'now') return 'Post now';
  if (intent === 'schedule') return 'Schedule post';
  return 'Add to queue';
}
