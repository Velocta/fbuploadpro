'use client';

import React from 'react';
import { IntentSelector, type ComposerIntent } from '../intent-selector';
import {
  formatSlotLong,
  toDateTimeLocalValue,
} from '../queue-slot-utils';
import { submitButtonLabel } from '../composer-validation';
import { destinationQueueGoesOutLine } from './destination-slots';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';

/**
 * Intent + submit sections for the destination composers (spec 132
 * gated sets) — the Facebook composer's sections (composer-sections.tsx)
 * re-based on unified destination posting slots: same interaction
 * language, same copy shape, the destination's own timezone beside
 * every time.
 *
 * One deliberate difference: there is no posting-time quick-add here.
 * Unified posting times are managed in the destination section's
 * Posting times slot (spec 134); when none exist, the notice points
 * there instead of offering a control that would write legacy page
 * slots the unified pipeline never reads.
 */

export interface DestinationIntentSectionProps {
  /** Platform display name for the publish-now note ("Instagram"). */
  platformName: string;
  intent: ComposerIntent;
  onIntentChange: (intent: ComposerIntent) => void;
  /** Posting slots failed to load — queueing cannot be offered honestly. */
  slotsLoadFailed: boolean;
  hasActiveSlots: boolean;
  scheduleValue: string;
  onScheduleChange: (value: string) => void;
  /** The destination's timezone (slots response; destination fallback). */
  scheduleTimezone: string;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
  /** Plural label of the current format ("Reels") for the queue line. */
  formatPluralLabel: string;
  /** Next covering slot occurrence, or null when no slot covers the format. */
  nextSlotOccurrence: Date | null;
  testIdPrefix: string;
}

export function DestinationIntentSection(
  props: Readonly<DestinationIntentSectionProps>
) {
  const {
    platformName,
    intent,
    onIntentChange,
    slotsLoadFailed,
    hasActiveSlots,
    testIdPrefix,
  } = props;
  const queueUnavailable = slotsLoadFailed || !hasActiveSlots;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">How should this go out?</span>
      <IntentSelector
        value={intent}
        onChange={onIntentChange}
        queueDisabled={queueUnavailable}
      />
      {slotsLoadFailed && (
        <p
          data-testid={`${testIdPrefix}-slots-error`}
          role="alert"
          className="m-0 text-metadata font-medium text-brand-rose"
        >
          Couldn&apos;t load this account&apos;s posting times — queueing is unavailable
          right now. You can still post now or schedule.
        </p>
      )}
      {!slotsLoadFailed && !hasActiveSlots && (
        <p
          data-testid={`${testIdPrefix}-no-slots-notice`}
          className="m-0 text-metadata text-ink-sub"
        >
          Set posting times first — your queued posts go out automatically at these
          times. You can add them in the Posting times section below.
        </p>
      )}
      {intent === 'now' && (
        <p
          data-testid={`${testIdPrefix}-intent-now-note`}
          className="m-0 text-metadata text-ink-sub"
        >
          This will publish to {platformName} immediately.
        </p>
      )}
      {intent === 'schedule' && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${testIdPrefix}-schedule-picker`}
            className="text-body font-medium text-ink"
          >
            Date and time
          </label>
          <Input
            id={`${testIdPrefix}-schedule-picker`}
            data-testid={`${testIdPrefix}-schedule-picker`}
            type="datetime-local"
            value={props.scheduleValue}
            min={toDateTimeLocalValue(new Date(), props.scheduleTimezone)}
            onChange={(e) => props.onScheduleChange(e.target.value)}
          />
          <span className="text-metadata text-ink-sub">
            Times shown in {props.scheduleTimezone}.
          </span>
          {props.scheduleDate && props.isScheduleInFuture && (
            <span
              data-testid={`${testIdPrefix}-schedule-goes-out`}
              className="text-metadata text-ink-sub"
            >
              Goes out {formatSlotLong(props.scheduleDate, props.scheduleTimezone)}.
            </span>
          )}
        </div>
      )}
      {intent === 'queue' && hasActiveSlots && !slotsLoadFailed && (
        <>
          {props.nextSlotOccurrence ? (
            <p
              data-testid={`${testIdPrefix}-queue-goes-out`}
              className="m-0 text-metadata text-ink-sub"
            >
              {destinationQueueGoesOutLine(
                props.formatPluralLabel,
                props.nextSlotOccurrence,
                props.scheduleTimezone
              )}
            </p>
          ) : (
            <p
              data-testid={`${testIdPrefix}-no-covering-slot-notice`}
              className="m-0 text-metadata text-ink-sub"
            >
              No posting time covers {props.formatPluralLabel} yet. Add one in the
              Posting times section below.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export interface DestinationSubmitSectionProps {
  platformName: string;
  error: string | null;
  intent: ComposerIntent;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
  scheduleTimezone: string;
  /** Queue-intent explanatory line repeated under the submit button, or null. */
  queueNote: string | null;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  testIdPrefix: string;
}

export function DestinationSubmitSection(
  props: Readonly<DestinationSubmitSectionProps>
) {
  const { error, intent, isSubmitDisabled, isSubmitting, onClose, testIdPrefix } = props;
  const showNowNote = intent === 'now';
  const scheduleNoteDate =
    intent === 'schedule' && props.isScheduleInFuture ? props.scheduleDate : null;
  const queueNote = intent === 'queue' ? props.queueNote : null;
  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p
          data-testid={`${testIdPrefix}-error`}
          role="alert"
          className="m-0 self-stretch text-body text-brand-rose"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          data-testid={`${testIdPrefix}-cancel-btn`}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          data-testid={`${testIdPrefix}-submit-btn`}
          disabled={isSubmitDisabled}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : submitButtonLabel(false, intent)}
        </Button>
      </div>
      {showNowNote && (
        <span className="text-metadata text-ink-sub">
          This will publish to {props.platformName} immediately.
        </span>
      )}
      {scheduleNoteDate && (
        <span className="text-metadata text-ink-sub">
          Goes out {formatSlotLong(scheduleNoteDate, props.scheduleTimezone)}.
        </span>
      )}
      {queueNote && (
        <span
          data-testid={`${testIdPrefix}-queue-submit-note`}
          className="text-metadata text-ink-sub"
        >
          {queueNote}
        </span>
      )}
    </div>
  );
}
