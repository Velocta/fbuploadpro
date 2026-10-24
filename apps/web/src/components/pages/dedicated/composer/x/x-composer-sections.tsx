'use client';

/**
 * Intent + submit sections for the X composer (spec 132 §4.5) — the
 * PR-C1 section patterns with the destination-slot data path:
 *
 * - "Post now" names the platform, never an armed state;
 * - Schedule is a datetime-local in the DESTINATION's timezone with
 *   the zone labelled (UX rule 4);
 * - Queue reads the destination's posting slots: no slots at all
 *   disables the tab upstream and explains where posting times live
 *   (the Posting times section of this destination page — there is no
 *   quick-add on the destination path, and no control is faked); an
 *   active slot set that doesn't cover this post's kind says so; a
 *   covering slot names the actual next occurrence. A slots read
 *   failure is a visible error, never a silent empty state.
 */
import React from 'react';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { IntentSelector, type ComposerIntent } from '../intent-selector';
import { formatSlotLong } from '../queue-slot-utils';
import { X_SCHEDULE_FUTURE_MESSAGE } from './x-composer-form-schema';
import { X_QUEUE_NO_COVERING_SLOT_MESSAGE } from './x-composer-validation';

export type XQueueSlotsState = 'loading' | 'error' | 'no-slots' | 'no-covering' | 'ready';

export interface XIntentSectionProps {
  intent: ComposerIntent;
  onIntentChange: (intent: ComposerIntent) => void;
  queueDisabled: boolean;
  timezone: string;
  scheduleValue: string;
  onScheduleChange: (value: string) => void;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
  queueSlotsState: XQueueSlotsState;
  /** The "goes out" line when a covering slot exists. */
  queueLine: string | null;
}

export function XIntentSection({
  intent,
  onIntentChange,
  queueDisabled,
  timezone,
  scheduleValue,
  onScheduleChange,
  scheduleDate,
  isScheduleInFuture,
  queueSlotsState,
  queueLine,
}: Readonly<XIntentSectionProps>) {
  return (
    <div data-testid="x-composer-intent-section" className="flex flex-col gap-3">
      <IntentSelector value={intent} onChange={onIntentChange} queueDisabled={queueDisabled} />

      {intent === 'now' && (
        <p data-testid="x-composer-now-note" className="m-0 text-metadata text-ink-sub">
          This will publish to X immediately.
        </p>
      )}

      {intent === 'schedule' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="x-composer-schedule-input" className="text-body font-medium text-ink">
            Date and time
          </label>
          <Input
            id="x-composer-schedule-input"
            data-testid="x-composer-schedule-input"
            type="datetime-local"
            value={scheduleValue}
            onChange={(e) => onScheduleChange(e.target.value)}
            className="min-h-11 max-w-70"
          />
          <p className="m-0 text-metadata text-ink-sub">Times shown in {timezone}.</p>
          {scheduleDate && isScheduleInFuture && (
            <p data-testid="x-composer-schedule-goes-out" className="m-0 text-metadata text-ink-sub">
              Goes out {formatSlotLong(scheduleDate, timezone)}.
            </p>
          )}
          {scheduleDate && !isScheduleInFuture && (
            <p data-testid="x-composer-schedule-past" className="m-0 text-metadata font-medium text-brand-rose">
              {X_SCHEDULE_FUTURE_MESSAGE}
            </p>
          )}
        </div>
      )}

      {intent === 'queue' && (
        <div className="flex flex-col gap-1.5">
          {queueSlotsState === 'loading' && (
            <p data-testid="x-composer-queue-loading" className="m-0 text-metadata text-ink-sub">
              Loading posting times…
            </p>
          )}
          {queueSlotsState === 'error' && (
            <p role="alert" data-testid="x-composer-queue-error" className="m-0 text-metadata font-medium text-brand-rose">
              Couldn&apos;t load posting times. Reload the page to try again.
            </p>
          )}
          {queueSlotsState === 'no-slots' && (
            <p data-testid="x-composer-queue-no-slots" className="m-0 text-metadata text-ink-sub">
              No posting times are set for this destination yet. Add posting times in the Posting
              times section below, then queue this post.
            </p>
          )}
          {queueSlotsState === 'no-covering' && (
            <p data-testid="x-composer-queue-no-covering" className="m-0 text-metadata text-ink-sub">
              {X_QUEUE_NO_COVERING_SLOT_MESSAGE}
            </p>
          )}
          {queueSlotsState === 'ready' && queueLine && (
            <p data-testid="x-composer-queue-line" className="m-0 text-metadata text-ink-sub">
              {queueLine}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export interface XSubmitSectionProps {
  error: string | null;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  submitLabel: string;
}

export function XSubmitSection({ error, isSubmitDisabled, isSubmitting, submitLabel }: Readonly<XSubmitSectionProps>) {
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p data-testid="x-composer-submit-error" className="m-0 text-body font-medium text-brand-rose">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" data-testid="x-composer-submit-btn" disabled={isSubmitDisabled} loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
