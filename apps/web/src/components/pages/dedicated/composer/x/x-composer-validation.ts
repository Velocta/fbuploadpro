/**
 * Submit-time validation + derived-state helpers for the X composer
 * (spec 132 §4.5) — one decision point the submit handler and the
 * submit-disabled state both read, mirroring the Facebook composer's
 * validation module. Poll rules are shared with the poll builder so
 * its inline error and the form summary carry identical wording.
 */
import {
  countXWeightedCharacters,
  X_MAX_WEIGHTED_CHARACTERS,
  X_POLL_MAX_DURATION_MINUTES,
  X_POLL_MAX_OPTIONS,
  X_POLL_OPTION_MAX_CHARACTERS,
  X_POLL_MIN_DURATION_MINUTES,
  X_POLL_MIN_OPTIONS,
} from '@fbuploadpro/contracts';
import type { ComposerIntent } from '../intent-selector';
import { roundUpToNextHour } from '../composer-validation';
import { toDateTimeLocalValue } from '../queue-slot-utils';
import {
  X_SCHEDULE_FUTURE_MESSAGE,
  X_TEXT_LIMIT_MESSAGE,
  X_TEXT_REQUIRED_MESSAGE,
} from './x-composer-form-schema';

export const X_MEDIA_FLAGGED_MESSAGE = 'Remove or replace the flagged media to continue.';
/** The contracts validator's own wording — the single source for this rule. */
export const X_POLL_MEDIA_MESSAGE = 'Polls cannot be combined with media on X.';
export const X_QUEUE_NO_SLOTS_MESSAGE = 'Set posting times first.';
export const X_QUEUE_NO_COVERING_SLOT_MESSAGE = 'No posting time covers this kind of post yet.';

/** The poll builder's rule set, shared by its inline error and the summary. */
export function xPollError(options: readonly string[]): string | null {
  const trimmed = options.map((option) => option.trim());
  if (trimmed.length < X_POLL_MIN_OPTIONS || trimmed.some((option) => option.length === 0)) {
    return 'Fill in every poll option.';
  }
  if (trimmed.some((option) => option.length > X_POLL_OPTION_MAX_CHARACTERS)) {
    return `Poll options can be at most ${X_POLL_OPTION_MAX_CHARACTERS} characters.`;
  }
  return null;
}

export function xPollDurationError(durationMinutes: number): string | null {
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < X_POLL_MIN_DURATION_MINUTES ||
    durationMinutes > X_POLL_MAX_DURATION_MINUTES
  ) {
    return 'Pick how long the poll runs.';
  }
  return null;
}

export interface XValidationContext {
  text: string;
  hasMedia: boolean;
  /** The attached item's contracts media-validation error, or null. */
  mediaError: string | null;
  pollEnabled: boolean;
  pollOptions: readonly string[];
  pollDurationMinutes: number;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  /** The destination has at least one active posting slot. */
  hasActiveSlots: boolean;
  /** An active slot covers this post's kind. */
  hasCoveringSlot: boolean;
}

/**
 * The first blocking problem with the current shape, or null when the
 * post can be submitted. Poll-vs-media is checked first (the composer
 * blocks the combination in the UI already; this is the backstop),
 * then flagged media, the text rules, the poll rules, then the
 * intent rules.
 */
export function computeXValidationError(context: XValidationContext): string | null {
  if (context.pollEnabled && context.hasMedia) {
    return X_POLL_MEDIA_MESSAGE;
  }
  if (context.mediaError) {
    return X_MEDIA_FLAGGED_MESSAGE;
  }
  if (!context.hasMedia && context.text.trim().length === 0) {
    return X_TEXT_REQUIRED_MESSAGE;
  }
  if (countXWeightedCharacters(context.text) > X_MAX_WEIGHTED_CHARACTERS) {
    return X_TEXT_LIMIT_MESSAGE;
  }
  if (context.pollEnabled) {
    const pollError = xPollError(context.pollOptions) ?? xPollDurationError(context.pollDurationMinutes);
    if (pollError) {
      return pollError;
    }
  }
  if (context.intent === 'schedule' && !context.isScheduleInFuture) {
    return X_SCHEDULE_FUTURE_MESSAGE;
  }
  if (context.intent === 'queue') {
    if (!context.hasActiveSlots) {
      return X_QUEUE_NO_SLOTS_MESSAGE;
    }
    if (!context.hasCoveringSlot) {
      return X_QUEUE_NO_COVERING_SLOT_MESSAGE;
    }
  }
  return null;
}

/** Poll option row cap, re-exported for the builder's add-option control. */
export const X_MAX_POLL_OPTIONS = X_POLL_MAX_OPTIONS;

/**
 * The default schedule value: the next covering slot occurrence when
 * one exists, else the next whole hour — always in the destination's
 * timezone (UX rule 4: times in the destination's zone, labelled).
 */
export function resolveXInitialScheduleValue(
  nextSlotOccurrence: Date | null,
  timezone: string,
  now: Date = new Date(),
): string {
  return toDateTimeLocalValue(nextSlotOccurrence ?? roundUpToNextHour(now), timezone);
}
