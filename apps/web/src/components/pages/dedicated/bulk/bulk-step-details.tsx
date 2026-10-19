'use client';

import React from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import { FormatSelector } from '../composer/format-selector';
import { PostingTimeQuickAdd } from '../composer/posting-time-quick-add';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import {
  composerLabelStyle,
  composerHintStyle,
  composerErrorStyle,
  composerFieldStyle,
  composerInputStyle,
  segmentedOptionStyle,
} from '../composer/composer-styles';
import {
  formatSlotShort,
  getNextSlotForFormat,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../composer/queue-slot-utils';
import { SPACING } from '@/lib/theme';
import {
  computeBulkQueueTimes,
  describeQueueRange,
  formatLabel,
  partitionAssets,
  suggestFormatForExcluded,
  type BulkDestination,
} from './bulk-utils';

export interface BulkStepDetailsProps {
  pageId: string;
  subdomain: string;
  assets: ComposerMediaItem[];
  format: PostFormat;
  onFormatChange: (format: PostFormat) => void;
  sharedCaption: string;
  onSharedCaptionChange: (caption: string) => void;
  destination: BulkDestination;
  onDestinationChange: (destination: BulkDestination) => void;
  scheduleDate: Date | null;
  onScheduleDateChange: (date: Date | null) => void;
  slots: PageSlotSummary[];
  onSlotAdded: (slot: PageSlotSummary) => void;
}

const CAPTION_MAX = 5000;

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function reasonForFormat(format: PostFormat): string {
  switch (format) {
    case 'image':
      return 'Photo needs images';
    case 'video':
      return 'Video needs videos';
    case 'reel':
      return 'Reels need videos';
    case 'text':
      return 'Text posts do not use media';
    default:
      return `${formatLabel(format)} does not accept this file`;
  }
}

function summarizeExcluded(excluded: ComposerMediaItem[], format: PostFormat): string {
  const videos = excluded.filter((a) => a.mediaType === 'video').length;
  const images = excluded.length - videos;
  const parts: string[] = [];
  if (videos > 0) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  if (images > 0) parts.push(`${images} image${images === 1 ? '' : 's'}`);
  const total = excluded.length;
  const noun = total === 1 ? 'file' : 'files';
  const reason = format === 'text' ? 'Text posts do not use media' : reasonForFormat(format);
  return `${parts.join(' and ')} excluded — ${reason}. ${total} ${noun} won't be added.`;
}

export interface BulkDetailsValidityInput {
  eligibleCount: number;
  destination: BulkDestination;
  scheduleDate: Date | null;
  slots: PageSlotSummary[];
  format: PostFormat;
}

/** Whether the details step may continue to review. */
export function getBulkDetailsValidity(input: BulkDetailsValidityInput): boolean {
  if (input.eligibleCount === 0) return false;
  if (input.destination === 'schedule') {
    return input.scheduleDate !== null && input.scheduleDate.getTime() > Date.now();
  }
  return getNextSlotForFormat(input.slots, input.format) !== null;
}

export function BulkStepDetails(props: Readonly<BulkStepDetailsProps>) {
  const {
    pageId,
    subdomain,
    assets,
    format,
    onFormatChange,
    sharedCaption,
    onSharedCaptionChange,
    destination,
    onDestinationChange,
    scheduleDate,
    onScheduleDateChange,
    slots,
    onSlotAdded,
  } = props;

  const { eligible, excluded } = partitionAssets(assets, format);
  const suggestedFormat = suggestFormatForExcluded(excluded);
  const scheduleTimezone = getNextSlotForFormat(slots, format)?.timezone ?? browserTimezone();

  const queueTimes = destination === 'queue' ? computeBulkQueueTimes(slots, format, eligible.length) : [];
  const queueRangeLabel = describeQueueRange(queueTimes);
  const showNoSlotsNotice = destination === 'queue' && slots.length === 0 && eligible.length > 0;
  const showNoCoverageNotice =
    destination === 'queue' && slots.length > 0 && eligible.length > 0 && queueTimes.length === 0;

  const handleScheduleInput = (value: string) => {
    onScheduleDateChange(parseDateTimeLocalValue(value, scheduleTimezone));
  };

  return (
    <div data-testid="bulk-step-details" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
      {/* Format */}
      <div style={composerFieldStyle}>
        <span style={composerLabelStyle}>Format</span>
        <FormatSelector value={format} onChange={onFormatChange} />
        {excluded.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <p data-testid="bulk-excluded-summary" style={{ ...composerErrorStyle, margin: 0 }}>
              {summarizeExcluded(excluded, format)}
            </p>
            {suggestedFormat && suggestedFormat !== format && (
              <button
                type="button"
                data-testid="bulk-switch-format-btn"
                onClick={() => onFormatChange(suggestedFormat)}
                style={{ ...segmentedOptionStyle(false), alignSelf: 'flex-start', cursor: 'pointer' }}
              >
                Switch to {formatLabel(suggestedFormat)} instead
              </button>
            )}
          </div>
        )}
        {eligible.length > 0 && (
          <p style={{ ...composerHintStyle, margin: 0 }}>
            {eligible.length} post{eligible.length === 1 ? '' : 's'} will be added.
          </p>
        )}
      </div>

      {/* Shared caption */}
      <div style={composerFieldStyle}>
        <span style={composerLabelStyle}>Caption (applies to all)</span>
        <textarea
          data-testid="bulk-shared-caption"
          value={sharedCaption}
          maxLength={CAPTION_MAX}
          rows={3}
          placeholder="Leave empty to keep each post's library caption."
          onChange={(e) => onSharedCaptionChange(e.target.value)}
          style={{ ...composerInputStyle(), resize: 'vertical', minHeight: '72px' }}
        />
        <span style={composerHintStyle}>
          {sharedCaption.length.toLocaleString('en-US')} / {CAPTION_MAX.toLocaleString('en-US')} — you can change each caption in the next step.
        </span>
      </div>

      {/* Destination */}
      <div style={composerFieldStyle}>
        <span style={composerLabelStyle}>Destination</span>
        <div style={{ display: 'flex', gap: SPACING.xs }} role="radiogroup" aria-label="Destination">
          {(
            [
              { id: 'queue', label: 'Queue' },
              { id: 'schedule', label: 'Schedule' },
            ] as Array<{ id: BulkDestination; label: string }>
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={destination === option.id}
              data-testid={`bulk-destination-${option.id}`}
              onClick={() => onDestinationChange(option.id)}
              style={{ ...segmentedOptionStyle(destination === option.id), cursor: 'pointer' }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {destination === 'queue' && queueRangeLabel && (
          <p data-testid="bulk-queue-range" style={{ ...composerHintStyle, margin: 0 }}>
            {queueRangeLabel}
          </p>
        )}

        {showNoSlotsNotice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <p style={{ ...composerHintStyle, margin: 0 }}>
              Set posting times first — your posts will go out automatically at these times.
            </p>
            <PostingTimeQuickAdd pageId={pageId} subdomain={subdomain} onAdded={onSlotAdded} />
          </div>
        )}

        {showNoCoverageNotice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <p data-testid="bulk-no-coverage-notice" style={{ ...composerErrorStyle, margin: 0 }}>
              No posting time covers {formatLabel(format)} yet.
            </p>
            <PostingTimeQuickAdd pageId={pageId} subdomain={subdomain} onAdded={onSlotAdded} />
          </div>
        )}

        {destination === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <input
              type="datetime-local"
              data-testid="bulk-schedule-datetime"
              value={scheduleDate ? toDateTimeLocalValue(scheduleDate, scheduleTimezone) : ''}
              min={toDateTimeLocalValue(new Date(), scheduleTimezone)}
              onChange={(e) => handleScheduleInput(e.target.value)}
              style={composerInputStyle()}
            />
            <p style={{ ...composerHintStyle, margin: 0 }}>
              All {eligible.length} post{eligible.length === 1 ? '' : 's'} go{eligible.length === 1 ? 'es' : ''} out at the same time
              {scheduleDate ? ` — ${formatSlotShort(scheduleDate, scheduleTimezone)}` : ''}. This is unusual for a
              queue, but allowed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}