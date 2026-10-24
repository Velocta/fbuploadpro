'use client';

import React, { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { XIcon } from 'lucide-react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { queryKeys } from '@/lib/data/query-keys';
import type { PageSlotSummary } from '../tab-dashboard';
import { type ComposerIntent } from './intent-selector';
import { FormatSelector } from './format-selector';
import {
  ComposerMediaArea,
  getMediaItemError,
  type ComposerMediaItem,
} from './composer-media-area';
import { ComposerCaption } from './composer-caption';
import { ComposerLink, isValidLink } from './composer-link';
import { ComposerPreview } from './composer-preview';
import { submitCreatePost, submitEditPost } from './composer-submit';
import {
  getNextSlotForFormat,
  getNextOccurrence,
  queueGoesOutLine,
  parseDateTimeLocalValue,
  hasRealCaption,
} from './queue-slot-utils';
import {
  computeValidationError,
  composerDescription,
  composerTitle,
  getMediaCountError,
  resolveInitialIntent,
  resolveInitialItems,
  resolveInitialScheduleValue,
  timezoneForFormat,
} from './composer-validation';
import {
  composerFormSchema,
  type ComposerFormValues,
} from './composer-form-schema';
import { getFacebookCooldownState } from './facebook-cooldown';
import { IntentSection, SubmitSection } from './composer-sections';
import { Form, FormErrorSummary, type FormErrorSummaryEntry } from '@/components/shared/ui/form';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';

/** Subset of a queue item needed to pre-fill the composer for editing. */
export interface ComposerInitialPost {
  id: string;
  /**
   * The unified destination this item belongs to, when it is a
   * unified queue item — the edit then settles through the unified
   * item actions instead of the legacy route (spec 134 PR-134-3).
   * Absent/null for legacy queue items.
   */
  destinationId?: string | null;
  mediaId?: string | null;
  postFormat?: PostFormat;
  linkUrl?: string | null;
  caption?: string | null;
  scheduledTime: string;
  status?: string;
  media?: {
    name: string;
    mediaType: 'video' | 'image';
    thumbnailUrl?: string | null;
    url: string;
    durationSeconds?: number | null;
    width?: number | null;
    height?: number | null;
  } | null;
}

export interface PostComposerProps {
  pageId: string;
  subdomain: string;
  slots: PageSlotSummary[];
  initialIntent?: ComposerIntent;
  /** Pre-fills the composer for editing an existing queue item. */
  initialPost?: ComposerInitialPost;
  onClose: () => void;
  /** Called with the success message to toast after a successful submit. */
  onSubmitted: (message: string) => void;
}

/**
 * Page-read shape the composer consumes (name + D5 cooldown status +
 * the Facebook page id the unified destination resolution keys on).
 * Lenient by design: the composer only reads these fields, and the
 * failure mode that matters — a failed read — still throws through the
 * typed client and leaves the "your Page" fallback, exactly as before.
 */
const ComposerPageResponseSchema = z
  .object({
    page: z
      .object({
        pageName: z.string(),
        fbPageId: z.string().nullable().optional(),
        status: z.string().optional(),
        rateLimitedAt: z.string().nullable().optional(),
      })
      .passthrough(),
  })
  .passthrough();

/**
 * The Facebook composer, rebuilt as a FULL PAGE (OD132-1 DECIDED (a))
 * on shared/ui primitives + the form standard (RHF + zod, onTouched)
 * + the typed API client (spec 132 PR-C1). The §3.3 host contract is
 * preserved as it exists on current main — same props, same callbacks —
 * so the hosts compile untouched; the launch-contract change to
 * navigation is the separate joint 132↔134 coordination PR. No draft
 * mechanism is built (OD132-2 DECIDED (c): UX Rule 14 is a deliberate
 * not-applied deviation, by Shahzeb's ruling).
 */
export function PostComposer({
  pageId,
  subdomain,
  slots: slotsProp,
  initialIntent,
  initialPost,
  onClose,
  onSubmitted,
}: Readonly<PostComposerProps>) {
  const isEdit = Boolean(initialPost);
  const queryClient = useQueryClient();

  const [slots, setSlots] = useState<PageSlotSummary[]>(slotsProp);
  const [items, setItems] = useState<ComposerMediaItem[]>(() => resolveInitialItems(initialPost));
  const [isCaptionTouched, setIsCaptionTouched] = useState(Boolean(initialPost?.caption));
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const form = useForm<ComposerFormValues>({
    resolver: zodResolver(composerFormSchema),
    mode: 'onTouched',
    defaultValues: {
      intent: resolveInitialIntent(slotsProp, initialIntent, initialPost),
      format: initialPost?.postFormat ?? 'reel',
      caption: initialPost?.caption ?? '',
      link: initialPost?.linkUrl ?? '',
      scheduleValue: resolveInitialScheduleValue(initialPost, slotsProp),
    },
  });
  const values = form.watch();
  const { intent, format, caption, link, scheduleValue } = values;
  const fieldErrors = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting;

  // Page read (name for the destination context + toast copy, and the
  // D5 cooldown status) through the typed client + React Query. A failed
  // read is non-blocking — the copy falls back to "your Page" — but it is
  // no longer a silent swallow: React Query holds the error state and
  // the typed client reports it (spec 137 §3.1).
  const pageQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).pages.detail(pageId),
    queryFn: ({ signal }) =>
      api.get(buildTenantApiPath(subdomain, `/pages/${pageId}`), {
        schema: ComposerPageResponseSchema,
        signal,
      }),
  });
  const pageName = pageQuery.data?.page.pageName.trim() || 'your Page';
  const cooldown = getFacebookCooldownState(pageQuery.data?.page);

  const scheduleTimezone = useMemo(() => timezoneForFormat(slots, format), [slots, format]);
  const activeSlots = useMemo(() => slots.filter((s) => s.isActive), [slots]);
  const nextSlotForFormat = useMemo(
    () => getNextSlotForFormat(activeSlots, format),
    [activeSlots, format]
  );
  const nextSlotOccurrence = useMemo(
    () => (nextSlotForFormat ? getNextOccurrence(nextSlotForFormat, new Date()) : null),
    [nextSlotForFormat]
  );
  const scheduleDate = useMemo(
    () => parseDateTimeLocalValue(scheduleValue, scheduleTimezone),
    [scheduleValue, scheduleTimezone]
  );
  const isScheduleInFuture = Boolean(scheduleDate && scheduleDate.getTime() > Date.now());

  const handleItemsChange = (next: ComposerMediaItem[]) => {
    setItems(next);
    // Library captions carry through only when the user hasn't written their
    // own caption yet — filename-derived pseudo-captions never pre-fill.
    if (!isCaptionTouched) {
      const withCaption = next.find((item) => hasRealCaption(item));
      form.setValue('caption', withCaption?.captionText?.trim() ?? '');
    }
  };

  const validationError = computeValidationError({
    format,
    caption,
    hasItems: items.length > 0,
    hasMediaTypeError: items.some((item) => getMediaItemError(item, format) !== null),
    mediaCountError: getMediaCountError(items, format),
    linkValid: isValidLink(link),
    intent,
    isScheduleInFuture,
    hasActiveSlots: activeSlots.length > 0,
    hasCoveringSlot: nextSlotForFormat !== null,
  });
  const isSubmitDisabled = isSubmitting || validationError !== null;

  const summaryEntries: FormErrorSummaryEntry[] = [];
  if (fieldErrors.caption?.message) {
    summaryEntries.push({ fieldId: 'composer-caption-field', message: fieldErrors.caption.message });
  }
  if (fieldErrors.link?.message) {
    summaryEntries.push({ fieldId: 'composer-link-field', message: fieldErrors.link.message });
  }
  if (serverError) {
    summaryEntries.push({ message: serverError });
  } else if (
    submitAttempted &&
    validationError &&
    summaryEntries.length === 0
  ) {
    summaryEntries.push({ message: validationError });
  }

  const handleValidSubmit = async (submitted: ComposerFormValues) => {
    setSubmitAttempted(true);
    setServerError(null);
    try {
      const message =
        isEdit && initialPost
          ? await submitEditPost({
              subdomain,
              itemId: initialPost.id,
              destinationId: initialPost.destinationId ?? null,
              format: submitted.format,
              caption: submitted.caption,
              link: submitted.link,
              intent: submitted.intent,
              scheduleDate,
              wasFailed: initialPost.status === 'failed',
              pageName,
            })
          : await submitCreatePost({
              pageId,
              subdomain,
              fbPageId: pageQuery.data?.page.fbPageId ?? null,
              format: submitted.format,
              items,
              caption: submitted.caption,
              link: submitted.link,
              intent: submitted.intent,
              scheduleDate,
              scheduleTimezone,
              nextSlotForFormat,
              nextSlotOccurrence,
              pageName,
            });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(subdomain).queue.all,
      });
      onSubmitted(message);
      onClose();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Couldn't save this post. Please try again."
      );
    }
  };

  const title = composerTitle(isEdit, format);
  const description = composerDescription(isEdit, format);

  return (
    <section
      data-testid="post-composer"
      aria-label={title}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-3">
            <div
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-body font-semibold text-ink"
            >
              {pageName.charAt(0).toUpperCase() || 'P'}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-body font-semibold text-ink">{pageName}</span>
              <span className="text-metadata text-ink-sub">Facebook Page</span>
            </div>
          </div>
          <h1 className="m-0 text-lg leading-heading font-semibold text-ink">{title}</h1>
          <p className="m-0 text-body text-ink-sub">{description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          data-testid="close-post-composer-btn"
          aria-label="Close composer"
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>

      {cooldown.inCooldown && cooldown.message && (
        <div data-testid="composer-cooldown-notice">
          <Banner variant="warning" title={cooldown.message} />
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleValidSubmit, () => setSubmitAttempted(true))}
          className="flex flex-col gap-6"
          noValidate
        >
          {submitAttempted && summaryEntries.length > 0 && (
            <FormErrorSummary errors={summaryEntries} />
          )}

          <IntentSection
            intent={intent}
            onIntentChange={(next) => form.setValue('intent', next)}
            hasActiveSlots={activeSlots.length > 0}
            pageId={pageId}
            subdomain={subdomain}
            onSlotAdded={(slot) => setSlots((prev) => [...prev, slot])}
            scheduleValue={scheduleValue}
            onScheduleChange={(value) => form.setValue('scheduleValue', value)}
            scheduleTimezone={scheduleTimezone}
            scheduleDate={scheduleDate}
            isScheduleInFuture={isScheduleInFuture}
            format={format}
            nextSlotForFormat={nextSlotForFormat}
            nextSlotOccurrence={nextSlotOccurrence}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-body font-medium text-ink">Format</span>
            <FormatSelector
              value={format}
              onChange={(next) => form.setValue('format', next)}
              disabled={isEdit}
            />
            {isEdit && (
              <span data-testid="composer-format-locked-hint" className="text-metadata text-ink-sub">
                Format can&apos;t be changed when editing.
              </span>
            )}
            {format === 'reel' && (
              <span data-testid="composer-reel-hint" className="text-metadata text-ink-sub">
                Portrait works best for reels.
              </span>
            )}
          </div>

          {format === 'text' && items.length > 0 && (
            <div data-testid="composer-text-media-notice" className="flex flex-col gap-1.5">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col gap-0.5">
                  <span className="text-metadata font-medium text-brand-rose">
                    {getMediaItemError(item, format)}
                  </span>
                  <span className="text-metadata text-ink-sub">{item.name}</span>
                  {!isEdit && (
                    <button
                      type="button"
                      data-testid={`composer-text-remove-media-${item.id}`}
                      onClick={() => setItems(items.filter((i) => i.id !== item.id))}
                      className="min-h-11 self-start text-left text-metadata font-semibold text-brand-rose outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {format !== 'text' && (
            <ComposerMediaArea
              pageId={pageId}
              subdomain={subdomain}
              format={format}
              items={items}
              onItemsChange={handleItemsChange}
              readOnly={isEdit}
            />
          )}

          <Controller
            control={form.control}
            name="caption"
            render={({ field, fieldState }) => (
              <ComposerCaption
                ref={field.ref}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  setIsCaptionTouched(true);
                }}
                onBlur={field.onBlur}
                required={format === 'text'}
                error={fieldState.error?.message}
              />
            )}
          />

          <Controller
            control={form.control}
            name="link"
            render={({ field, fieldState }) => (
              <ComposerLink
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                visible={format === 'text' || format === 'image' || format === 'video'}
                error={fieldState.error?.message}
              />
            )}
          />

          <ComposerPreview
            pageName={pageName}
            format={format}
            caption={caption}
            link={link}
            mediaItems={items}
          />

          <SubmitSection
            error={serverError}
            isEdit={isEdit}
            intent={intent}
            scheduleDate={scheduleDate}
            isScheduleInFuture={isScheduleInFuture}
            scheduleTimezone={scheduleTimezone}
            queueNote={
              nextSlotForFormat && nextSlotOccurrence
                ? queueGoesOutLine(format, nextSlotOccurrence, nextSlotForFormat.timezone)
                : null
            }
            isSubmitDisabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            onClose={onClose}
          />
        </form>
      </Form>
    </section>
  );
}
