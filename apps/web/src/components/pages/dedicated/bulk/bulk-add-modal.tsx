'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  BulkEnqueueResponseSchema,
  type PostFormat,
} from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import { type ComposerMediaItem } from '../composer/composer-media-area';
import {
  formatSlotLong,
  formatSlotShort,
  getNextOccurrence,
  getNextSlotForFormat,
} from '../composer/queue-slot-utils';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from '../modal-styles';
import { composerErrorStyle } from '../composer/composer-styles';
import { COMPONENT_STYLES, SPACING, PALETTE, TYPOGRAPHY } from '@/lib/theme';
import { BulkStepMedia } from './bulk-step-media';
import { BulkStepDetails, getBulkDetailsValidity } from './bulk-step-details';
import { BulkStepReview, type BulkReviewResult, type BulkReviewRow } from './bulk-step-review';
import {
  computeBulkQueueTimes,
  partitionAssets,
  resolveRowCaption,
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

export function BulkAddModal(props: Readonly<BulkAddModalProps>) {
  const { pageId, subdomain, slots, isOpen, onClose, onComplete } = props;

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

  // Fresh run each time the modal opens.
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
    return eligible.map((asset, index) => {
      const caption = resolveRowCaption(asset, sharedCaption, captionOverrides);
      let timeLabel: string;
      let scheduledISO: string;
      if (destination === 'queue') {
        const assigned = queueTimes.at(index);
        timeLabel = assigned ? formatSlotShort(assigned.date, assigned.timezone) : 'No slot';
        scheduledISO = assigned ? assigned.date.toISOString() : new Date().toISOString();
      } else {
        const date = scheduleDate ?? new Date();
        timeLabel = formatSlotLong(date, scheduleTimezone);
        scheduledISO = date.toISOString();
      }
      return {
        asset,
        caption,
        timeLabel,
        onCaptionChange: (next: string) =>
          setCaptionOverrides((prev) => ({ ...prev, [asset.id]: next })),
        onRemove: () => setAssets((prev) => prev.filter((a) => a.id !== asset.id)),
        scheduledISO,
      };
    });
  }, [eligible, destination, localSlots, format, sharedCaption, captionOverrides, scheduleDate]);

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
      const res = await fetch(`/api/tenant/${subdomain}/publishing/queue/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId, items }),
      });
      const data = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) {
        const message =
          (data as { message?: string; error?: string } | null)?.message ||
          (data as { message?: string; error?: string } | null)?.error ||
          "Couldn't add these posts. Please try again.";
        setResults(
          reviewRows.map((row) => ({
            assetId: row.asset.id,
            assetName: row.asset.name,
            thumbnailUrl: row.asset.thumbnailUrl || row.asset.url,
            ok: false,
            error: message,
          }))
        );
      } else {
        const parsed = BulkEnqueueResponseSchema.safeParse(data);
        const itemResults = parsed.success ? parsed.data.results : [];
        setResults(
          reviewRows.map((row, index) => {
            const itemResult = itemResults.at(index);
            return {
              assetId: row.asset.id,
              assetName: row.asset.name,
              thumbnailUrl: row.asset.thumbnailUrl || row.asset.url,
              ok: itemResult?.ok ?? false,
              error: itemResult?.error,
            };
          })
        );
      }
      onComplete();
    } catch (_e) {
      setSubmitError("Couldn't add these posts. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    onClose();
  };

  const canContinueFromMedia = assets.length > 0;

  return (
    <div
      data-testid="bulk-add-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Bulk add"
      style={MODAL_BACKDROP_STYLE}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div style={{ ...MODAL_CONTAINER_STYLE, maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: TYPOGRAPHY.weights.semibold }}>
            Bulk add
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: SPACING.md, borderBottom: '1px solid var(--border-subtle)', paddingBottom: SPACING.sm }}>
          {STEP_LABELS.map(({ step: s, label }) => {
            const isActive = s === step;
            const isDone = s < step;
            const clickable = isDone && !isSubmitting && !results;
            return (
              <button
                key={s}
                type="button"
                data-testid={`bulk-step-${s}`}
                disabled={!clickable}
                onClick={() => {
                  if (clickable) setStep(s);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: clickable ? 'pointer' : 'default',
                  color: isActive ? PALETTE.primary : isDone ? 'var(--text)' : 'var(--text-sub)',
                  fontWeight: isActive ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.regular,
                  fontSize: '0.875rem',
                  borderBottom: isActive ? `2px solid ${PALETTE.primary}` : '2px solid transparent',
                  paddingBottom: '4px',
                }}
              >
                {s}. {label}
              </button>
            );
          })}
        </div>

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
          <p data-testid="bulk-submit-error" style={{ ...composerErrorStyle, margin: 0 }}>
            {submitError}
          </p>
        )}

        {/* Footer nav (review owns its submit; summary owns its Done) */}
        {!results && step < 3 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: SPACING.sm }}>
            <button
              type="button"
              onClick={() => (step === 1 ? onClose() : setStep((s) => (s === 3 ? 2 : 1) as BulkStep))}
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                color: 'var(--text-sub)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: `${SPACING.xs} ${SPACING.lg}`,
                cursor: 'pointer',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            <button
              type="button"
              data-testid="bulk-continue-btn"
              onClick={() => setStep((s) => (s === 1 ? 2 : 3) as BulkStep)}
              disabled={step === 1 ? !canContinueFromMedia : !detailsValid}
              style={{
                ...COMPONENT_STYLES.primaryButton,
                padding: `${SPACING.xs} ${SPACING.lg}`,
                cursor: step === 1 ? (canContinueFromMedia ? 'pointer' : 'not-allowed') : detailsValid ? 'pointer' : 'not-allowed',
                opacity: step === 1 ? (canContinueFromMedia ? 1 : 0.7) : detailsValid ? 1 : 0.7,
              }}
            >
              Continue
            </button>
          </div>
        )}
        {!results && step === 3 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                color: 'var(--text-sub)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: `${SPACING.xs} ${SPACING.lg}`,
                cursor: 'pointer',
                fontWeight: TYPOGRAPHY.weights.medium,
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
