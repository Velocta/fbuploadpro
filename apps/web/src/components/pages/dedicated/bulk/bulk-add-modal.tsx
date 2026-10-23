'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { XIcon } from 'lucide-react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/data/query-keys';
import type { PageSlotSummary } from '../tab-dashboard';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import {
  formatSlotLong,
  formatSlotShort,
  getNextOccurrence,
  getNextSlotForFormat,
} from '../composer/queue-slot-utils';
import { Button } from '@/components/shared/ui/button';
import { cn } from '@/lib/utils';
import { BulkStepMedia } from './bulk-step-media';
import { BulkStepDetails, getBulkDetailsValidity } from './bulk-step-details';
import { BulkStepReview, type BulkReviewResult, type BulkReviewRow } from './bulk-step-review';
import { submitBulkCreate } from './bulk-submit';
import {
  computeBulkQueueTimes,
  partitionAssets,
  resolveRowCaption,
  type BulkAssignedTime,
  type BulkDestination,
} from './bulk-utils';

export interface BulkAddModalProps {
  pageId: string;
  subdomain: string;
  slots: PageSlotSummary[];
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type BulkStep = 1 | 2 | 3;

const STEP_LABELS: Array<{ step: BulkStep; label: string }> = [
  { step: 1, label: 'Choose media' },
  { step: 2, label: 'Details' },
  { step: 3, label: 'Review' },
];

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function defaultScheduleDate(slots: PageSlotSummary[], format: PostFormat): Date {
  const slot = getNextSlotForFormat(slots, format);
  if (slot) {
    const occurrence = getNextOccurrence(slot, new Date());
    if (occurrence) return occurrence;
  }
  const fallback = new Date(Date.now() + 60 * 60 * 1000);
  fallback.setMinutes(0, 0, 0);
  return fallback;
}

interface ReviewRowContext {
  destination: BulkDestination;
  queueTimes: BulkAssignedTime[];
  scheduleDate: Date | null;
  scheduleTimezone: string;
  sharedCaption: string;
  captionOverrides: Readonly<Record<string, string>>;
}

/** Builds one review row: caption default + computed slot/schedule time. */
function buildReviewRow(
  asset: ComposerMediaItem,
  index: number,
  ctx: ReviewRowContext,
  onCaptionChange: (id: string, caption: string) => void,
  onRemove: (id: string) => void
): BulkReviewRow {
  const caption = resolveRowCaption(asset, ctx.sharedCaption, ctx.captionOverrides);
  let timeLabel: string;
  let scheduledISO: string;
  if (ctx.destination === 'queue') {
    const assigned = ctx.queueTimes.at(index);
    if (assigned) {
      timeLabel = formatSlotShort(assigned.date, assigned.timezone);
      scheduledISO = assigned.date.toISOString();
    } else {
      timeLabel = 'No slot';
      scheduledISO = new Date().toISOString();
    }
  } else {
    const date = ctx.scheduleDate ?? new Date();
    timeLabel = formatSlotLong(date, ctx.scheduleTimezone);
    scheduledISO = date.toISOString();
  }
  return {
    asset,
    caption,
    timeLabel,
    scheduledISO,
    onCaptionChange: (next: string) => onCaptionChange(asset.id, next),
    onRemove: () => onRemove(asset.id),
  };
}

/**
 * The bulk creation flow, rebuilt as a FULL PAGE (OD132-1 DECIDED (a),
 * aligned with PR-C1's composer) on shared/ui primitives + the typed
 * API client (spec 132 PR-C2). The §3.3 host contract is preserved as it
 * exists on current main — same props, same callbacks — so the hosts
 * compile untouched; the launch-contract change to navigation is the
 * separate joint 132↔134 coordination PR. No draft mechanism is built
 * (OD132-2 DECIDED (c): UX Rule 14 is a deliberate not-applied
 * deviation, by Shahzeb's ruling — see PR-C1).
 *
 * One deliberate completion-semantics fix against the legacy overlay:
 * the legacy code called `onComplete` the moment the submit returned,
 * and the host closes on `onComplete` — so the §5.15 end summary could
 * never be read. The summary now stays on screen and `onComplete` fires
 * from its Done button (which also closes).
 */
export function BulkAddModal(props: Readonly<BulkAddModalProps>) {
  const { pageId, subdomain, slots, isOpen, onClose, onComplete } = props;
  const queryClient = useQueryClient();

  const [step, setStep] = useState<BulkStep>(1);
  const [assets, setAssets] = useState<ComposerMediaItem[]>([]);
  const [format, setFormat] = useState<PostFormat>('image');
  const [sharedCaption, setSharedCaption] = useState('');
  const [destination, setDestination] = useState<BulkDestination>('queue');
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [captionOverrides, setCaptionOverrides] = useState<Record<string, string>>({});
  const [localSlots, setLocalSlots] = useState<PageSlotSummary[]>(slots);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkReviewResult[] | null>(null);

  // Fresh run each time the flow opens.
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setAssets([]);
      setFormat('image');
      setSharedCaption('');
      setDestination('queue');
      setScheduleDate(null);
      setCaptionOverrides({});
      setLocalSlots(slots);
      setIsSubmitting(false);
      setSubmitError(null);
      setResults(null);
    }
  }, [isOpen]);

  const { eligible } = useMemo(() => partitionAssets(assets, format), [assets, format]);

  const detailsValid = getBulkDetailsValidity({
    eligibleCount: eligible.length,
    destination,
    scheduleDate,
    slots: localSlots,
    format,
  });

  const scheduleTimezone = getNextSlotForFormat(localSlots, format)?.timezone ?? browserTimezone();

  const reviewRows: BulkReviewRow[] = useMemo(() => {
    const queueTimes =
      destination === 'queue' ? computeBulkQueueTimes(localSlots, format, eligible.length) : [];
    const ctx: ReviewRowContext = {
      destination,
      queueTimes,
      scheduleDate,
      scheduleTimezone,
      sharedCaption,
      captionOverrides,
    };
    const handleCaptionChange = (id: string, caption: string) =>
      setCaptionOverrides((prev) => ({ ...prev, [id]: caption }));
    const handleRemove = (id: string) => setAssets((prev) => prev.filter((a) => a.id !== id));
    return eligible.map((asset, index) => buildReviewRow(asset, index, ctx, handleCaptionChange, handleRemove));
  }, [eligible, destination, localSlots, format, sharedCaption, captionOverrides, scheduleDate, scheduleTimezone]);

  if (!isOpen) return null;

  const handleDestinationChange = (next: BulkDestination) => {
    setDestination(next);
    if (next === 'schedule' && !scheduleDate) {
      setScheduleDate(defaultScheduleDate(localSlots, format));
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting || reviewRows.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const items = reviewRows.map((row) => ({
        mediaId: row.asset.id,
        format,
        caption: row.caption,
        scheduledTime: row.scheduledISO,
      }));
      const data = await submitBulkCreate({ pageId, subdomain, items });
      setResults(
        reviewRows.map((row, index) => {
          const itemResult = data.results.at(index);
          return {
            assetId: row.asset.id,
            assetName: row.asset.name,
            thumbnailUrl: row.asset.thumbnailUrl || row.asset.url,
            ok: itemResult?.ok ?? false,
            error: itemResult?.error,
          };
        })
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(subdomain).queue.all,
      });
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'http') {
        // Server refused the run: report it per row in the summary,
        // exactly where the legacy overlay reported a non-OK response.
        setResults(
          reviewRows.map((row) => ({
            assetId: row.asset.id,
            assetName: row.asset.name,
            thumbnailUrl: row.asset.thumbnailUrl || row.asset.url,
            ok: false,
            error: err.message,
          }))
        );
      } else {
        setSubmitError("Couldn't add these posts. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    onComplete();
    onClose();
  };

  const canContinueFromMedia = assets.length > 0;
  const continueEnabled = step === 1 ? canContinueFromMedia : detailsValid;

  return (
    <section
      data-testid="bulk-add-modal"
      aria-label="Bulk add"
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 className="m-0 text-lg leading-heading font-semibold text-ink">Bulk add</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={onClose}
          disabled={isSubmitting}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      {/* Stepper — named steps per §5.11 ("1. Choose media · 2. Details · 3. Review") */}
      <nav aria-label="Bulk add steps" className="flex max-w-full flex-wrap gap-1 border-b border-line">
        {STEP_LABELS.map(({ step: s, label }) => {
          const isActive = s === step;
          const isDone = s < step;
          const clickable = isDone && !isSubmitting && !results;
          return (
            <button
              key={s}
              type="button"
              data-testid={`bulk-step-${s}`}
              aria-current={isActive ? 'step' : undefined}
              disabled={!clickable}
              onClick={() => {
                if (clickable) setStep(s);
              }}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-body font-medium whitespace-nowrap transition-colors duration-fast outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold disabled:opacity-100',
                isActive
                  ? 'border-brand-gold font-semibold text-ink'
                  : 'border-transparent text-ink-sub',
                clickable ? 'cursor-pointer hover:text-ink' : 'cursor-default'
              )}
            >
              {s}. {label}
            </button>
          );
        })}
      </nav>

      {step === 1 && (
        <BulkStepMedia subdomain={subdomain} selected={assets} onSelectedChange={setAssets} />
      )}

      {step === 2 && (
        <BulkStepDetails
          pageId={pageId}
          subdomain={subdomain}
          assets={assets}
          format={format}
          onFormatChange={setFormat}
          sharedCaption={sharedCaption}
          onSharedCaptionChange={setSharedCaption}
          destination={destination}
          onDestinationChange={handleDestinationChange}
          scheduleDate={scheduleDate}
          onScheduleDateChange={setScheduleDate}
          slots={localSlots}
          onSlotAdded={(slot) => setLocalSlots((prev) => [...prev, slot])}
        />
      )}

      {step === 3 && (
        <BulkStepReview
          rows={reviewRows}
          format={format}
          destination={destination}
          isSubmitting={isSubmitting}
          results={results}
          onSubmit={handleSubmit}
          onDone={handleDone}
        />
      )}

      {submitError && (
        <p data-testid="bulk-submit-error" role="alert" className="m-0 text-body text-brand-rose">
          {submitError}
        </p>
      )}

      {/* Footer nav (review owns its submit; summary owns its Done) */}
      {!results && step < 3 && (
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s === 3 ? 2 : 1) as BulkStep))}
            disabled={isSubmitting}
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            data-testid="bulk-continue-btn"
            onClick={() => setStep((s) => (s === 1 ? 2 : 3) as BulkStep)}
            disabled={!continueEnabled}
          >
            Continue
          </Button>
        </div>
      )}
      {!results && step === 3 && (
        <div className="flex justify-start">
          <Button variant="outline" onClick={() => setStep(2)} disabled={isSubmitting}>
            Back
          </Button>
        </div>
      )}
    </section>
  );
}
