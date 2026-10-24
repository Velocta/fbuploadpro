'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  THREADS_CAROUSEL_MAX_ITEMS,
  THREADS_MAX_TEXT_ATTACHMENT_CHARACTERS,
  THREADS_MAX_TEXT_WEIGHTED_CHARACTERS,
  ListDestinationPostingSlotsResponseSchema,
  threadsWeightedTextLength,
  validateThreadsText,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { queryKeys } from '@/lib/data/query-keys';
import {
  Form,
  FormErrorSummary,
  type FormErrorSummaryEntry,
} from '@/components/shared/ui/form';
import { Banner } from '@/components/shared/ui/banner';
import { Input } from '@/components/shared/ui/input';
import { Textarea } from '@/components/shared/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import { cn } from '@/lib/utils';
import type { ComposerIntent } from '../intent-selector';
import {
  hasRealCaption,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../queue-slot-utils';
import { roundUpToNextHour } from '../composer-validation';
import {
  buildThreadsEnqueueRequest,
  submitThreadsEnqueue,
} from '../destination-enqueue';
import { DestinationMediaArea } from '../destination/destination-media-area';
import { DestinationPreview } from '../destination/destination-preview';
import {
  DestinationIntentSection,
  DestinationSubmitSection,
} from '../destination/destination-intent';
import {
  formatSlotLong,
  formatSlotShort,
  getNextDestinationSlot,
  toDestinationSlotViews,
} from '../destination/destination-slots';
import { getDestinationLimitNote } from '../destination/destination-limit';
import type { DestinationMediaItem } from '../destination/destination-media';
import { threadsFormSchema, type ThreadsFormValues } from './threads-form-schema';
import {
  REPLY_CONTROL_OPTIONS,
  THREADS_CAROUSEL_CAP_MESSAGE,
  THREADS_KIND_LABELS,
  buildThreadsOptions,
  computeThreadsValidationError,
  getThreadsItemError,
  threadsKindForItems,
  validateThreadsOptions,
  type ThreadsOptionsFormState,
} from './threads-validation';

const TEST_ID_PREFIX = 'threads-composer';

/** The destination fields the composer reads (the frame's detail view
 *  is a structural superset). */
export interface ThreadsComposerDestination {
  id: string;
  name: string;
  timezone: string;
  status: string;
}

export interface ThreadsComposerProps {
  subdomain: string;
  destination: ThreadsComposerDestination;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

export function ThreadsComposer({
  subdomain,
  destination,
  onClose,
  onSubmitted,
}: Readonly<ThreadsComposerProps>) {
  const queryClient = useQueryClient();
  const [mediaItems, setMediaItems] = useState<DestinationMediaItem[]>([]);
  const [carouselAltTexts, setCarouselAltTexts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [blurredFields, setBlurredFields] = useState<ReadonlySet<string>>(new Set());
  const markBlurred = (field: string) =>
    setBlurredFields((prev) => new Set(prev).add(field));
  const textEditedRef = useRef(false);
  const intentTouchedRef = useRef(false);
  const scheduleEditedRef = useRef(false);

  const form = useForm<ThreadsFormValues>({
    resolver: zodResolver(threadsFormSchema),
    mode: 'onTouched',
    defaultValues: {
      intent: 'now',
      text: '',
      replyControl: 'everyone',
      topicTag: '',
      quotePostId: '',
      replyToId: '',
      linkAttachment: '',
      altText: '',
      textAttachment: '',
      scheduleValue: '',
    },
  });
  const { control, setValue, getValues } = form;
  const intent = useWatch({ control, name: 'intent' }) as ComposerIntent;
  const text = useWatch({ control, name: 'text' }) ?? '';
  const replyControl = useWatch({ control, name: 'replyControl' }) ?? 'everyone';
  const topicTag = useWatch({ control, name: 'topicTag' }) ?? '';
  const quotePostId = useWatch({ control, name: 'quotePostId' }) ?? '';
  const replyToId = useWatch({ control, name: 'replyToId' }) ?? '';
  const linkAttachment = useWatch({ control, name: 'linkAttachment' }) ?? '';
  const altText = useWatch({ control, name: 'altText' }) ?? '';
  const textAttachment = useWatch({ control, name: 'textAttachment' }) ?? '';
  const scheduleValue = useWatch({ control, name: 'scheduleValue' }) ?? '';

  const kind = threadsKindForItems(mediaItems);

  // Posting slots: the destination's unified slots through the typed
  // client + React Query (§5.5) — the destination framework's pattern.
  const slotsQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).destinations.slots(destination.id),
    queryFn: ({ signal }) =>
      api.get(
        buildTenantApiPath(subdomain, `/destinations/${destination.id}/posting-slots`),
        { schema: ListDestinationPostingSlotsResponseSchema, signal }
      ),
  });
  const slots = useMemo(
    () => (slotsQuery.data ? toDestinationSlotViews(slotsQuery.data) : []),
    [slotsQuery.data]
  );
  const destinationTimezone = slotsQuery.data?.timezone ?? destination.timezone ?? 'UTC';
  const hasActiveSlots = slots.some((slot) => slot.isActive);
  const slotsLoadFailed = slotsQuery.isError;

  const nextSlot = useMemo(
    () => getNextDestinationSlot(slots, kind),
    [slots, kind]
  );
  const hasCoveringSlot = nextSlot !== null;

  const scheduleDate = useMemo(
    () =>
      scheduleValue
        ? parseDateTimeLocalValue(scheduleValue, destinationTimezone)
        : null,
    [scheduleValue, destinationTimezone]
  );
  const isScheduleInFuture = scheduleDate
    ? scheduleDate.getTime() > Date.now()
    : false;

  useEffect(() => {
    if (!slotsQuery.data || intentTouchedRef.current) return;
    if (hasActiveSlots && getValues('intent') === 'now') {
      setValue('intent', 'queue');
    }
  }, [slotsQuery.data, hasActiveSlots, getValues, setValue]);

  useEffect(() => {
    if (scheduleEditedRef.current) return;
    const next = getNextDestinationSlot(slots, kind);
    const date = next?.occurrence ?? roundUpToNextHour(new Date());
    setValue(
      'scheduleValue',
      toDateTimeLocalValue(date, next?.slot.timezone ?? destinationTimezone)
    );
  }, [slots, kind, destinationTimezone, setValue]);

  const optionsState: ThreadsOptionsFormState = {
    replyControl,
    topicTag,
    quotePostId,
    replyToId,
    linkAttachment,
    altText,
    textAttachment,
  };

  const textError = validateThreadsText(text);
  const optionsError = validateThreadsOptions(
    kind,
    optionsState,
    carouselAltTexts,
    mediaItems
  );

  const validationError =
    intent === 'queue' && slotsLoadFailed
      ? "Couldn't load this account's posting times — try again."
      : intent === 'queue' && slotsQuery.isPending
        ? null
        : computeThreadsValidationError({
            kind,
            items: mediaItems,
            text,
            optionsState,
            carouselAltTexts,
            intent,
            isScheduleInFuture,
            hasActiveSlots,
            hasCoveringSlot,
          });
  const isSubmitDisabled =
    isSubmitting ||
    validationError !== null ||
    (intent === 'queue' && slotsQuery.isPending);

  const summaryEntries = useMemo<FormErrorSummaryEntry[]>(() => {
    if (!submitAttempted) return [];
    const entries: FormErrorSummaryEntry[] = [];
    if (textError) {
      entries.push({ fieldId: `${TEST_ID_PREFIX}-text-field`, message: textError });
    }
    if (optionsError) {
      const fieldId =
        optionsError.field === 'topicTag'
          ? `${TEST_ID_PREFIX}-topic-tag-field`
          : optionsError.field === 'linkAttachment'
            ? `${TEST_ID_PREFIX}-link-attachment-field`
            : optionsError.field === 'altText'
              ? `${TEST_ID_PREFIX}-alt-text-field`
              : optionsError.field === 'textAttachment'
                ? `${TEST_ID_PREFIX}-text-attachment-field`
                : optionsError.field === 'quotePostId'
                  ? `${TEST_ID_PREFIX}-quote-post-field`
                  : undefined;
      entries.push({ ...(fieldId ? { fieldId } : {}), message: optionsError.message });
    }
    if (validationError && !entries.some((e) => e.message === validationError)) {
      entries.push({ message: validationError });
    }
    if (submitError) entries.push({ message: submitError });
    return entries;
  }, [submitAttempted, textError, optionsError, validationError, submitError]);

  const handleItemsChange = (next: DestinationMediaItem[]) => {
    setMediaItems(next);
    // A real library caption pre-fills the post text until the user
    // types (filename-derived captions never do — `hasRealCaption`).
    if (textEditedRef.current) return;
    const first = next.at(0);
    if (first && hasRealCaption(first)) {
      setValue('text', first.captionText ?? '');
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitAttempted(true);
    if (validationError) return;
    const finalKind = threadsKindForItems(mediaItems);
    const finalScheduleDate =
      values.intent === 'schedule'
        ? parseDateTimeLocalValue(values.scheduleValue, destinationTimezone)
        : null;
    const options = buildThreadsOptions(finalKind, {
      replyControl: values.replyControl,
      topicTag: values.topicTag,
      quotePostId: values.quotePostId,
      replyToId: values.replyToId,
      linkAttachment: values.linkAttachment,
      altText: values.altText,
      textAttachment: values.textAttachment,
    });
    const request = buildThreadsEnqueueRequest(destination.id, {
      kind: finalKind,
      text: values.text,
      items: mediaItems,
      carouselAltTexts,
      options,
      intent: values.intent as ComposerIntent,
      scheduleDate: finalScheduleDate,
    });
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await submitThreadsEnqueue(subdomain, request);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Couldn't save this post. Please try again."
      );
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tenant(subdomain).queue.all,
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.tenant(subdomain).destinations.all,
    });
    const message =
      values.intent === 'now'
        ? `Posted to ${destination.name}.`
        : values.intent === 'schedule' && finalScheduleDate
          ? `Scheduled for ${formatSlotLong(finalScheduleDate, destinationTimezone)}.`
          : nextSlot
            ? `Added to queue — goes out ${formatSlotShort(nextSlot.occurrence, destinationTimezone)}.`
            : 'Added to queue.';
    onSubmitted(message);
  });

  const showFieldErrors = submitAttempted;
  const fieldError = (
    field: string,
    message: string | null | undefined
  ): string | undefined =>
    message && (blurredFields.has(field) || showFieldErrors) ? message : undefined;
  const textInlineError = fieldError('text', textError);
  const topicTagInlineError = fieldError(
    'topicTag',
    optionsError?.field === 'topicTag' ? optionsError.message : undefined
  );
  const linkInlineError = fieldError(
    'linkAttachment',
    optionsError?.field === 'linkAttachment'
      ? optionsError.message
      : mediaItems.length > 0 && linkAttachment.trim()
        ? 'Link attachments only go on text posts. Remove the link to publish with media.'
        : undefined
  );
  const altTextInlineError = fieldError(
    'altText',
    optionsError?.field === 'altText' ? optionsError.message : undefined
  );
  const textAttachmentInlineError = fieldError(
    'textAttachment',
    optionsError?.field === 'textAttachment' ? optionsError.message : undefined
  );
  const quoteInlineError = fieldError(
    'quotePostId',
    optionsError?.field === 'quotePostId' ? optionsError.message : undefined
  );

  const limitNote = getDestinationLimitNote('threads');
  const queueNote =
    intent === 'queue' && nextSlot
      ? `Goes out ${formatSlotShort(nextSlot.occurrence, destinationTimezone)} ${destinationTimezone}.`
      : null;
  const weightedCount = threadsWeightedTextLength(text);
  const singleMedia = mediaItems.length === 1;

  return (
    <section
      data-testid={TEST_ID_PREFIX}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6"
    >
      <div className="flex flex-col gap-1.5">
        <h3 className="text-title font-semibold text-ink">Create post</h3>
        <p className="m-0 text-body text-ink-sub">
          Put together a post for {destination.name}.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <div data-testid={`${TEST_ID_PREFIX}-text`} className="flex flex-col gap-1.5">
            <label
              htmlFor={`${TEST_ID_PREFIX}-text-field`}
              className="text-body font-medium text-ink"
            >
              Text
            </label>
            <Textarea
              id={`${TEST_ID_PREFIX}-text-field`}
              data-testid={`${TEST_ID_PREFIX}-text-field`}
              rows={4}
              value={text}
              onChange={(e) => {
                textEditedRef.current = true;
                setValue('text', e.target.value);
              }}
              onBlur={() => markBlurred('text')}
              placeholder="Write your post…"
              aria-invalid={textInlineError ? true : undefined}
              aria-describedby={
                textInlineError ? `${TEST_ID_PREFIX}-text-error` : undefined
              }
              className="min-h-24 resize-y"
            />
            {textInlineError ? (
              <p
                id={`${TEST_ID_PREFIX}-text-error`}
                role="alert"
                className="text-metadata font-medium text-brand-rose"
              >
                {textInlineError}
              </p>
            ) : null}
            <div className="flex justify-end">
              <span
                data-testid={`${TEST_ID_PREFIX}-text-count`}
                className={cn(
                  'text-metadata tabular-nums',
                  weightedCount > THREADS_MAX_TEXT_WEIGHTED_CHARACTERS
                    ? 'text-brand-rose'
                    : 'text-ink-sub'
                )}
              >
                {weightedCount.toLocaleString('en-US')} /{' '}
                {THREADS_MAX_TEXT_WEIGHTED_CHARACTERS.toLocaleString('en-US')}
              </span>
            </div>
          </div>

          <DestinationMediaArea
            subdomain={subdomain}
            items={mediaItems}
            onItemsChange={handleItemsChange}
            maxItems={THREADS_CAROUSEL_MAX_ITEMS}
            capMessage={THREADS_CAROUSEL_CAP_MESSAGE}
            getItemError={getThreadsItemError}
            accept="image/*,video/*"
            testIdPrefix={TEST_ID_PREFIX}
            renderItemExtra={
              mediaItems.length >= 2
                ? (item) => (
                    <Input
                      data-testid={`${TEST_ID_PREFIX}-carousel-alt-${item.id}`}
                      aria-label={`Alt text for ${item.name}`}
                      placeholder="Alt text (optional)"
                      value={carouselAltTexts[item.id] ?? ''}
                      onChange={(e) =>
                        setCarouselAltTexts((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  )
                : undefined
            }
          />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${TEST_ID_PREFIX}-reply-control`}
                className="text-body font-medium text-ink"
              >
                Who can reply
              </label>
              <Select
                value={replyControl}
                onValueChange={(value) =>
                  setValue(
                    'replyControl',
                    value as ThreadsFormValues['replyControl']
                  )
                }
              >
                <SelectTrigger
                  id={`${TEST_ID_PREFIX}-reply-control`}
                  data-testid={`${TEST_ID_PREFIX}-reply-control`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPLY_CONTROL_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${TEST_ID_PREFIX}-topic-tag-field`}
                className="text-body font-medium text-ink"
              >
                Topic tag (optional)
              </label>
              <Input
                id={`${TEST_ID_PREFIX}-topic-tag-field`}
                data-testid={`${TEST_ID_PREFIX}-topic-tag-field`}
                value={topicTag}
                onChange={(e) => setValue('topicTag', e.target.value)}
                onBlur={() => markBlurred('topicTag')}
                placeholder="e.g. Photography"
                aria-invalid={topicTagInlineError ? true : undefined}
                aria-describedby={
                  topicTagInlineError ? `${TEST_ID_PREFIX}-topic-tag-error` : undefined
                }
              />
              {topicTagInlineError ? (
                <p
                  id={`${TEST_ID_PREFIX}-topic-tag-error`}
                  role="alert"
                  className="text-metadata font-medium text-brand-rose"
                >
                  {topicTagInlineError}
                </p>
              ) : (
                <span className="text-metadata text-ink-sub">
                  One topic, up to 50 characters — no periods or &amp;.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${TEST_ID_PREFIX}-text-attachment-field`}
                className="text-body font-medium text-ink"
              >
                Long text attachment (optional)
              </label>
              <Textarea
                id={`${TEST_ID_PREFIX}-text-attachment-field`}
                data-testid={`${TEST_ID_PREFIX}-text-attachment-field`}
                rows={3}
                value={textAttachment}
                onChange={(e) => setValue('textAttachment', e.target.value)}
                onBlur={() => markBlurred('textAttachment')}
                placeholder="Attach a longer piece of writing to this post…"
                aria-invalid={textAttachmentInlineError ? true : undefined}
                aria-describedby={
                  textAttachmentInlineError
                    ? `${TEST_ID_PREFIX}-text-attachment-error`
                    : undefined
                }
                className="resize-y"
              />
              {textAttachmentInlineError ? (
                <p
                  id={`${TEST_ID_PREFIX}-text-attachment-error`}
                  role="alert"
                  className="text-metadata font-medium text-brand-rose"
                >
                  {textAttachmentInlineError}
                </p>
              ) : null}
              <div className="flex justify-end">
                <span className="text-metadata tabular-nums text-ink-sub">
                  {textAttachment.length.toLocaleString('en-US')} /{' '}
                  {THREADS_MAX_TEXT_ATTACHMENT_CHARACTERS.toLocaleString('en-US')}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${TEST_ID_PREFIX}-link-attachment-field`}
                className="text-body font-medium text-ink"
              >
                Link attachment (optional)
              </label>
              <Input
                id={`${TEST_ID_PREFIX}-link-attachment-field`}
                data-testid={`${TEST_ID_PREFIX}-link-attachment-field`}
                value={linkAttachment}
                onChange={(e) => setValue('linkAttachment', e.target.value)}
                onBlur={() => markBlurred('linkAttachment')}
                placeholder="https://…"
                aria-invalid={linkInlineError ? true : undefined}
                aria-describedby={
                  linkInlineError ? `${TEST_ID_PREFIX}-link-error` : undefined
                }
              />
              {linkInlineError ? (
                <p
                  id={`${TEST_ID_PREFIX}-link-error`}
                  role="alert"
                  className="text-metadata font-medium text-brand-rose"
                >
                  {linkInlineError}
                </p>
              ) : (
                <span className="text-metadata text-ink-sub">
                  A link preview for text posts — a post can carry a link
                  attachment or a long text attachment, not both.
                </span>
              )}
            </div>

            {singleMedia && (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${TEST_ID_PREFIX}-alt-text-field`}
                  className="text-body font-medium text-ink"
                >
                  Alt text (optional)
                </label>
                <Textarea
                  id={`${TEST_ID_PREFIX}-alt-text-field`}
                  data-testid={`${TEST_ID_PREFIX}-alt-text-field`}
                  rows={2}
                  value={altText}
                  onChange={(e) => setValue('altText', e.target.value)}
                  onBlur={() => markBlurred('altText')}
                  placeholder="Describe the media for screen readers…"
                  aria-invalid={altTextInlineError ? true : undefined}
                  aria-describedby={
                    altTextInlineError ? `${TEST_ID_PREFIX}-alt-text-error` : undefined
                  }
                  className="resize-y"
                />
                {altTextInlineError ? (
                  <p
                    id={`${TEST_ID_PREFIX}-alt-text-error`}
                    role="alert"
                    className="text-metadata font-medium text-brand-rose"
                  >
                    {altTextInlineError}
                  </p>
                ) : null}
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex flex-1 flex-col gap-1.5">
                <label
                  htmlFor={`${TEST_ID_PREFIX}-quote-post-field`}
                  className="text-body font-medium text-ink"
                >
                  Quote post ID (optional)
                </label>
                <Input
                  id={`${TEST_ID_PREFIX}-quote-post-field`}
                  data-testid={`${TEST_ID_PREFIX}-quote-post-field`}
                  value={quotePostId}
                  onChange={(e) => setValue('quotePostId', e.target.value)}
                  onBlur={() => markBlurred('quotePostId')}
                  placeholder="Post ID to quote"
                  aria-invalid={quoteInlineError ? true : undefined}
                  aria-describedby={
                    quoteInlineError ? `${TEST_ID_PREFIX}-quote-error` : undefined
                  }
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <label
                  htmlFor={`${TEST_ID_PREFIX}-reply-to-field`}
                  className="text-body font-medium text-ink"
                >
                  Reply-to post ID (optional)
                </label>
                <Input
                  id={`${TEST_ID_PREFIX}-reply-to-field`}
                  data-testid={`${TEST_ID_PREFIX}-reply-to-field`}
                  value={replyToId}
                  onChange={(e) => setValue('replyToId', e.target.value)}
                  onBlur={() => markBlurred('quotePostId')}
                  placeholder="Post ID to reply to"
                />
              </div>
            </div>
            {quoteInlineError ? (
              <p
                id={`${TEST_ID_PREFIX}-quote-error`}
                role="alert"
                className="text-metadata font-medium text-brand-rose"
              >
                {quoteInlineError}
              </p>
            ) : (
              <span className="text-metadata text-ink-sub">
                A post can quote another post or reply to one — not both.
              </span>
            )}
          </div>

          {destination.status === 'action_required' && (
            <Banner
              variant="warning"
              title="This account needs attention before it can publish."
              description="Reconnect it from Accounts — posts you queue will wait until it is healthy again."
            />
          )}

          <DestinationPreview
            destinationName={destination.name}
            formatLabel={THREADS_KIND_LABELS[kind].label}
            text={text}
            mediaItems={mediaItems}
            testIdPrefix={TEST_ID_PREFIX}
          />

          {limitNote && (
            <p
              data-testid={`${TEST_ID_PREFIX}-limit-note`}
              className="m-0 text-metadata text-ink-sub"
            >
              {limitNote}
            </p>
          )}

          <DestinationIntentSection
            platformName="Threads"
            intent={intent}
            onIntentChange={(next) => {
              intentTouchedRef.current = true;
              setValue('intent', next);
            }}
            slotsLoadFailed={slotsLoadFailed}
            hasActiveSlots={hasActiveSlots}
            scheduleValue={scheduleValue}
            onScheduleChange={(value) => {
              scheduleEditedRef.current = true;
              setValue('scheduleValue', value);
            }}
            scheduleTimezone={destinationTimezone}
            scheduleDate={scheduleDate}
            isScheduleInFuture={isScheduleInFuture}
            formatPluralLabel={THREADS_KIND_LABELS[kind].plural}
            nextSlotOccurrence={nextSlot?.occurrence ?? null}
            testIdPrefix={TEST_ID_PREFIX}
          />

          {submitAttempted && summaryEntries.length > 0 && (
            <FormErrorSummary errors={summaryEntries} />
          )}

          <DestinationSubmitSection
            platformName="Threads"
            error={submitError}
            intent={intent}
            scheduleDate={scheduleDate}
            isScheduleInFuture={isScheduleInFuture}
            scheduleTimezone={destinationTimezone}
            queueNote={queueNote}
            isSubmitDisabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            onClose={onClose}
            testIdPrefix={TEST_ID_PREFIX}
          />
        </form>
      </Form>
    </section>
  );
}
