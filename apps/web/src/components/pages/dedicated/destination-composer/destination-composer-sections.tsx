'use client';

import React from 'react';
import {
  IntentSelector,
  type ComposerIntent,
} from '../composer/intent-selector';
import {
  formatSlotLong,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../composer/queue-slot-utils';
import { submitButtonLabel } from '../composer/composer-validation';
import { destinationQueueGoesOutLine } from './destination-slot-utils';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';

/**
 * Intent + submit sections for the unified destination composers
 * (spec 132 gated sets) — the Facebook composer's sections
 * (`composer-sections.tsx`) re-expressed against unified destination
 * posting slots instead of legacy page slots: the same interaction
 * language (spec.md §4 shared requirements), with the platform's name
 * in the copy. Differences from the Facebook sections, all forced by
 * the unified data model: the timezone is the destination's (slot
 * times are local to it), and there is no inline posting-time
 * quick-add — unified destination slots have no create API in the
 * composer (the slots read is the enabling backend's; slot management
 * is the posting-times surface's job).
 */

export interface DestinationIntentSectionProps {
  /** Platform display name for copy, e.g. 'YouTube'. */
  platformLabel: string;
  intent: ComposerIntent;
  onIntentChange: (intent: ComposerIntent) => void;
  /** False while the destination's slots are still loading or failed to load. */
  slotsReady: boolean;
  /** True when the slots read failed — queueing is unavailable, other intents still work. */
  slotsError?: boolean;
  hasActiveSlots: boolean;
  /** Plural kind label for the queue lines, e.g. 'Videos'. */
  coveringKindLabel: string;
  hasCoveringSlot: boolean;
  nextOccurrence: Date | null;
  /** The destination's IANA timezone — every displayed time is labelled with it. */
  timezone: string;
  scheduleValue: string;
  onScheduleChange: (value: string) => void;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
}

function QueueIntentBody(
  props: Readonly<DestinationIntentSectionProps>,
): React.ReactElement {
  const { hasCoveringSlot, nextOccurrence, coveringKindLabel, timezone } =
    props;
  if (!hasCoveringSlot || !nextOccurrence) {
    return (
      <p
        data-testid="destination-composer-no-covering-slot-notice"
        className="m-0 text-metadata text-ink-sub"
      >
        No posting time covers {coveringKindLabel} yet.
      </p>
    );
  }
  return (
    <p
      data-testid="destination-composer-queue-goes-out"
      className="m-0 text-metadata text-ink-sub"
    >
      {destinationQueueGoesOutLine(coveringKindLabel, nextOccurrence, timezone)}
    </p>
  );
}

function ScheduleIntentBody(
  props: Readonly<DestinationIntentSectionProps>,
): React.ReactElement {
  const {
    scheduleValue,
    onScheduleChange,
    timezone,
    scheduleDate,
    isScheduleInFuture,
  } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="destination-composer-schedule-picker"
        className="text-body font-medium text-ink"
      >
        Date and time
      </label>
      <Input
        id="destination-composer-schedule-picker"
        data-testid="destination-composer-schedule-picker"
        type="datetime-local"
        value={scheduleValue}
        min={toDateTimeLocalValue(new Date(), timezone)}
        onChange={(e) => onScheduleChange(e.target.value)}
      />
      <span className="text-metadata text-ink-sub">
        Times shown in {timezone}.
      </span>
      {scheduleDate && isScheduleInFuture && (
        <span
          data-testid="destination-composer-schedule-goes-out"
          className="text-metadata text-ink-sub"
        >
          Goes out {formatSlotLong(scheduleDate, timezone)}.
        </span>
      )}
    </div>
  );
}

export function DestinationIntentSection(
  props: Readonly<DestinationIntentSectionProps>,
): React.ReactElement {
  const {
    intent,
    onIntentChange,
    slotsReady,
    slotsError,
    hasActiveSlots,
    platformLabel,
  } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">
        How should this go out?
      </span>
      <IntentSelector
        value={intent}
        onChange={onIntentChange}
        queueDisabled={!slotsReady || !hasActiveSlots}
      />
      {slotsError && (
        <p
          data-testid="destination-composer-slots-error"
          className="m-0 text-metadata text-ink-sub"
        >
          Couldn&apos;t load posting times, so queueing is unavailable right
          now. You can still post now or schedule.
        </p>
      )}
      {slotsReady && !hasActiveSlots && (
        <p
          data-testid="destination-composer-no-slots-notice"
          className="m-0 text-metadata text-ink-sub"
        >
          Set posting times first — your queued posts go out automatically at
          these times.
        </p>
      )}
      {intent === 'now' && (
        <p
          data-testid="destination-composer-intent-now-note"
          className="m-0 text-metadata text-ink-sub"
        >
          This will publish to {platformLabel} immediately.
        </p>
      )}
      {intent === 'schedule' && <ScheduleIntentBody {...props} />}
      {intent === 'queue' && hasActiveSlots && <QueueIntentBody {...props} />}
    </div>
  );
}

/** Default schedule value: the next covering slot occurrence, else the next hour. */
export function defaultScheduleValue(
  nextOccurrence: Date | null,
  timezone: string,
): string {
  const date = nextOccurrence ?? roundUpToNextHour(new Date());
  return toDateTimeLocalValue(date, timezone);
}

function roundUpToNextHour(from: Date): Date {
  const d = new Date(from.getTime());
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

/** Parses the schedule input in the destination's timezone (null when empty/invalid). */
export function parseScheduleValue(
  value: string,
  timezone: string,
): Date | null {
  return parseDateTimeLocalValue(value, timezone);
}

export interface DestinationSubmitSectionProps {
  error: string | null;
  intent: ComposerIntent;
  platformLabel: string;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
  scheduleTimezone: string;
  /** Queue-intent explanatory line repeated under the submit button, or null. */
  queueNote: string | null;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  /** Clears the composer back to its empty state (the frame hosts no close). */
  onCancel: () => void;
}

export function DestinationSubmitSection(
  props: Readonly<DestinationSubmitSectionProps>,
): React.ReactElement {
  const { error, intent, isSubmitDisabled, isSubmitting, onCancel } = props;
  const showNowNote = intent === 'now';
  const scheduleNoteDate =
    intent === 'schedule' && props.isScheduleInFuture
      ? props.scheduleDate
      : null;
  const queueNote = intent === 'queue' ? props.queueNote : null;
  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p
          data-testid="destination-composer-error"
          role="alert"
          className="m-0 self-stretch text-body text-brand-rose"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          data-testid="destination-composer-cancel-btn"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          data-testid="destination-composer-submit-btn"
          disabled={isSubmitDisabled}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : submitButtonLabel(false, intent)}
        </Button>
      </div>
      {showNowNote && (
        <span className="text-metadata text-ink-sub">
          This will publish to {props.platformLabel} immediately.
        </span>
      )}
      {scheduleNoteDate && (
        <span className="text-metadata text-ink-sub">
          Goes out {formatSlotLong(scheduleNoteDate, props.scheduleTimezone)}.
        </span>
      )}
      {queueNote && (
        <span
          data-testid="destination-composer-queue-submit-note"
          className="text-metadata text-ink-sub"
        >
          {queueNote}
        </span>
      )}
    </div>
  );
}
