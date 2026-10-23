'use client';

import React from 'react';
import type { PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import { IntentSelector, type ComposerIntent } from './intent-selector';
import { PostingTimeQuickAdd } from './posting-time-quick-add';
import {
  formatSlotLong,
  queueGoesOutLine,
  toDateTimeLocalValue,
} from './queue-slot-utils';
import { pluralFormatLabel } from './format-labels';
import { submitButtonLabel } from './composer-validation';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';

/**
 * Intent + submit sections of the full-page composer (extracted from the
 * legacy orchestrator, spec 132 §3.4). Copy and test ids are preserved
 * verbatim from specs 103/111 (§5.2/§5.3).
 */

export interface IntentSectionProps {
  intent: ComposerIntent;
  onIntentChange: (intent: ComposerIntent) => void;
  hasActiveSlots: boolean;
  pageId: string;
  subdomain: string;
  onSlotAdded: (slot: PageSlotSummary) => void;
  scheduleValue: string;
  onScheduleChange: (value: string) => void;
  scheduleTimezone: string;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
  format: PostFormat;
  nextSlotForFormat: PageSlotSummary | null;
  nextSlotOccurrence: Date | null;
}

function QueueIntentBody(props: Readonly<IntentSectionProps>): React.ReactElement {
  const { format, nextSlotForFormat, nextSlotOccurrence } = props;
  if (!nextSlotForFormat || !nextSlotOccurrence) {
    return (
      <div className="flex flex-col gap-3">
        <p data-testid="composer-no-covering-slot-notice" className="m-0 text-metadata text-ink-sub">
          No posting time covers {pluralFormatLabel(format)} yet.
        </p>
        <PostingTimeQuickAdd pageId={props.pageId} subdomain={props.subdomain} onAdded={props.onSlotAdded} />
      </div>
    );
  }
  return (
    <p data-testid="composer-queue-goes-out" className="m-0 text-metadata text-ink-sub">
      {queueGoesOutLine(format, nextSlotOccurrence, nextSlotForFormat.timezone)}
    </p>
  );
}

function ScheduleIntentBody(props: Readonly<IntentSectionProps>): React.ReactElement {
  const { scheduleValue, onScheduleChange, scheduleTimezone, scheduleDate, isScheduleInFuture } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="composer-schedule-picker" className="text-body font-medium text-ink">
        Date and time
      </label>
      <Input
        id="composer-schedule-picker"
        data-testid="composer-schedule-picker"
        type="datetime-local"
        value={scheduleValue}
        min={toDateTimeLocalValue(new Date(), scheduleTimezone)}
        onChange={(e) => onScheduleChange(e.target.value)}
      />
      <span className="text-metadata text-ink-sub">Times shown in {scheduleTimezone}.</span>
      {scheduleDate && isScheduleInFuture && (
        <span data-testid="composer-schedule-goes-out" className="text-metadata text-ink-sub">
          Goes out {formatSlotLong(scheduleDate, scheduleTimezone)}.
        </span>
      )}
    </div>
  );
}

export function IntentSection(props: Readonly<IntentSectionProps>): React.ReactElement {
  const { intent, onIntentChange, hasActiveSlots } = props;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">How should this go out?</span>
      <IntentSelector value={intent} onChange={onIntentChange} queueDisabled={!hasActiveSlots} />
      {!hasActiveSlots && (
        <div className="flex flex-col gap-3">
          <p data-testid="composer-no-slots-notice" className="m-0 text-metadata text-ink-sub">
            Set posting times first — your queued posts go out automatically at these times.
          </p>
          <PostingTimeQuickAdd pageId={props.pageId} subdomain={props.subdomain} onAdded={props.onSlotAdded} />
        </div>
      )}
      {intent === 'now' && (
        <p data-testid="composer-intent-now-note" className="m-0 text-metadata text-ink-sub">
          This will publish to Facebook immediately.
        </p>
      )}
      {intent === 'schedule' && <ScheduleIntentBody {...props} />}
      {intent === 'queue' && hasActiveSlots && <QueueIntentBody {...props} />}
    </div>
  );
}

export interface SubmitSectionProps {
  error: string | null;
  isEdit: boolean;
  intent: ComposerIntent;
  scheduleDate: Date | null;
  isScheduleInFuture: boolean;
  scheduleTimezone: string;
  /** Queue-intent explanatory line repeated under the submit button, or null. */
  queueNote: string | null;
  isSubmitDisabled: boolean;
  isSubmitting: boolean;
  onClose: () => void;
}

export function SubmitSection(props: Readonly<SubmitSectionProps>): React.ReactElement {
  const { error, isEdit, intent, isSubmitDisabled, isSubmitting, onClose } = props;
  const showNowNote = intent === 'now' && !isEdit;
  const scheduleNoteDate =
    intent === 'schedule' && !isEdit && props.isScheduleInFuture ? props.scheduleDate : null;
  const queueNote = intent === 'queue' && !isEdit ? props.queueNote : null;
  return (
    <div className="flex flex-col items-end gap-1.5">
      {error && (
        <p data-testid="post-composer-error" role="alert" className="m-0 self-stretch text-body text-brand-rose">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" data-testid="cancel-post-composer-btn" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          data-testid="submit-post-composer-btn"
          disabled={isSubmitDisabled}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Saving…' : submitButtonLabel(isEdit, intent)}
        </Button>
      </div>
      {showNowNote && (
        <span className="text-metadata text-ink-sub">This will publish to Facebook immediately.</span>
      )}
      {scheduleNoteDate && (
        <span className="text-metadata text-ink-sub">
          Goes out {formatSlotLong(scheduleNoteDate, props.scheduleTimezone)}.
        </span>
      )}
      {queueNote && (
        <span data-testid="composer-queue-submit-note" className="text-metadata text-ink-sub">
          {queueNote}
        </span>
      )}
    </div>
  );
}
