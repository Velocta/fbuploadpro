'use client';

import React from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import { FormatSelector } from '../composer/format-selector';
import { PostingTimeQuickAdd } from '../composer/posting-time-quick-add';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import {
  formatSlotShort,
  getNextSlotForFormat,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../composer/queue-slot-utils';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import { cn } from '@/lib/utils';
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

const DESTINATIONS: Array<{ id: BulkDestination; label: string }> = [
  { id: 'queue', label: 'Queue' },
  { id: 'schedule', label: 'Schedule' },
];

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
    <div data-testid="bulk-step-details" className="flex flex-col gap-6">
      {/* Format */}
      <div className="flex flex-col gap-1.5">
        <span className="text-body font-medium text-ink">Format</span>
        <FormatSelector value={format} onChange={onFormatChange} />
        {excluded.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p data-testid="bulk-excluded-summary" className="m-0 text-metadata font-medium text-brand-rose">
              {summarizeExcluded(excluded, format)}
            </p>
            {suggestedFormat && suggestedFormat !== format && (
              <div>
                <Button
                  variant="secondary"
                  data-testid="bulk-switch-format-btn"
                  onClick={() => onFormatChange(suggestedFormat)}
                >
                  Switch to {formatLabel(suggestedFormat)} instead
                </Button>
              </div>
            )}
          </div>
        )}
        {eligible.length > 0 && (
          <p className="m-0 text-metadata text-ink-sub">
            {eligible.length} post{eligible.length === 1 ? '' : 's'} will be added.
          </p>
        )}
      </div>

      {/* Shared caption */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="bulk-shared-caption-field" className="text-body font-medium text-ink">
          Caption (applies to all)
        </label>
        <Textarea
          id="bulk-shared-caption-field"
          data-testid="bulk-shared-caption"
          value={sharedCaption}
          maxLength={CAPTION_MAX}
          rows={3}
          placeholder="Leave empty to keep each post's library caption."
          onChange={(e) => onSharedCaptionChange(e.target.value)}
          className="min-h-18 resize-y"
        />
        <span className="text-metadata text-ink-sub">
          {sharedCaption.length.toLocaleString('en-US')} / {CAPTION_MAX.toLocaleString('en-US')} — you can change each caption in the next step.
        </span>
      </div>

      {/* Destination — queue-first: there is no Post now in bulk (§5.11). */}
      <div className="flex flex-col gap-1.5">
        <span className="text-body font-medium text-ink">Destination</span>
        <div
          role="radiogroup"
          aria-label="Destination"
          className="flex max-w-full flex-wrap gap-1 border-b border-line"
        >
          {DESTINATIONS.map((option) => {
            const isActive = destination === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                data-testid={`bulk-destination-${option.id}`}
                onClick={() => onDestinationChange(option.id)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
                  isActive
                    ? 'border-brand-gold font-semibold text-ink'
                    : 'border-transparent text-ink-sub hover:text-ink'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {destination === 'queue' && queueRangeLabel && (
          <p data-testid="bulk-queue-range" className="m-0 text-metadata text-ink-sub">
            {queueRangeLabel}
          </p>
        )}

        {showNoSlotsNotice && (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-metadata text-ink-sub">
              Set posting times first — your posts will go out automatically at these times.
            </p>
            <PostingTimeQuickAdd pageId={pageId} subdomain={subdomain} onAdded={onSlotAdded} />
          </div>
        )}

        {showNoCoverageNotice && (
          <div className="flex flex-col gap-1.5">
            <p data-testid="bulk-no-coverage-notice" className="m-0 text-metadata font-medium text-brand-rose">
              No posting time covers {formatLabel(format)} yet.
            </p>
            <PostingTimeQuickAdd pageId={pageId} subdomain={subdomain} onAdded={onSlotAdded} />
          </div>
        )}

        {destination === 'schedule' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-schedule-datetime-field" className="text-body font-medium text-ink">
              Date and time
            </label>
            <Input
              id="bulk-schedule-datetime-field"
              type="datetime-local"
              data-testid="bulk-schedule-datetime"
              value={scheduleDate ? toDateTimeLocalValue(scheduleDate, scheduleTimezone) : ''}
              min={toDateTimeLocalValue(new Date(), scheduleTimezone)}
              onChange={(e) => handleScheduleInput(e.target.value)}
            />
            <p className="m-0 text-metadata text-ink-sub">
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
