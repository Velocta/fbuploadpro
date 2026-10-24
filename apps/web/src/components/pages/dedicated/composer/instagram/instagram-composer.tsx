'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  INSTAGRAM_MAX_CAPTION_CHARACTERS,
  ListDestinationPostingSlotsResponseSchema,
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
import { Checkbox } from '@/components/shared/ui/checkbox';
import { Switch } from '@/components/shared/ui/switch';
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
  buildInstagramEnqueueRequest,
  submitInstagramEnqueue,
} from '../destination-enqueue';
import { DestinationFormatSelector } from '../destination/destination-format-selector';
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
import {
  instagramFormSchema,
  type InstagramFormValues,
} from './instagram-form-schema';
import {
  FIRST_COMMENT_MAX_CHARACTERS,
  GRADUATION_STRATEGY_OPTIONS,
  buildInstagramOptions,
  computeInstagramValidationError,
  getInstagramItemError,
  instagramCapMessage,
  instagramCaptionError,
  instagramFormatPlural,
  instagramFormatsForAccountType,
  instagramMaxItems,
  validateInstagramOptions,
  type InstagramFormat,
  type InstagramOptionsFormState,
} from './instagram-validation';

const TEST_ID_PREFIX = 'instagram-composer';

/** The destination fields the composer reads (the frame's detail view
 *  is a structural superset). */
export interface InstagramComposerDestination {
  id: string;
  name: string;
  timezone: string;
  status: string;
}

export interface InstagramComposerProps {
  subdomain: string;
  destination: InstagramComposerDestination;
  /**
   * The destination's Instagram account type ('BUSINESS' / 'CREATOR'),
   * when the surface calling the composer knows it. The 131-4 frame
   * does NOT surface it today (the connect flow reads `account_type`
   * only to enforce the Professional rule and never persists it), so
   * the frame passes nothing and Stories stay unoffered — the §4.1
   * fallback — until the type is surfaced on the destination read.
   */
  accountType?: string | null | undefined;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}

/** Enqueue format key the slot-coverage rule matches (server rule:
 *  `platformFormat ?? kind` of the request the builder produces). */
function formatKeyFor(format: InstagramFormat): string {
  switch (format) {
    case 'photo':
      return 'image';
    case 'reel':
      return 'reel';
    case 'carousel':
      return 'carousel';
    case 'story':
      return 'story';
  }
}

export function InstagramComposer({
  subdomain,
  destination,
  accountType,
  onClose,
  onSubmitted,
}: Readonly<InstagramComposerProps>) {
  const queryClient = useQueryClient();
  const [mediaItems, setMediaItems] = useState<DestinationMediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Fields are controlled inputs (not RHF-registered), so touched state
  // for the inline-error gate is tracked here on blur — the onTouched
  // contract (an error shows once its field was touched, or after a
  // submit attempt) is preserved exactly.
  const [blurredFields, setBlurredFields] = useState<ReadonlySet<string>>(
    new Set()
  );
  const markBlurred = (field: string) =>
    setBlurredFields((prev) => new Set(prev).add(field));
  const captionEditedRef = useRef(false);
  const intentTouchedRef = useRef(false);
  const scheduleEditedRef = useRef(false);

  const formats = useMemo(
    () => instagramFormatsForAccountType(accountType),
    [accountType]
  );

  const form = useForm<InstagramFormValues>({
    resolver: zodResolver(instagramFormSchema),
    mode: 'onTouched',
    defaultValues: {
      intent: 'now',
      format: 'photo',
      caption: '',
      firstComment: '',
      collaboratorsText: '',
      coverUrl: '',
      shareToFeed: true,
      trialReel: false,
      graduationStrategy: 'SS_PERFORMANCE',
      scheduleValue: '',
    },
  });
  const { control, setValue, getValues } = form;
  const intent = useWatch({ control, name: 'intent' }) as ComposerIntent;
  const format = useWatch({ control, name: 'format' }) as InstagramFormat;
  const caption = useWatch({ control, name: 'caption' }) ?? '';
  const firstComment = useWatch({ control, name: 'firstComment' }) ?? '';
  const collaboratorsText = useWatch({ control, name: 'collaboratorsText' }) ?? '';
  const coverUrl = useWatch({ control, name: 'coverUrl' }) ?? '';
  const shareToFeed = useWatch({ control, name: 'shareToFeed' }) ?? true;
  const trialReel = useWatch({ control, name: 'trialReel' }) ?? false;
  const graduationStrategy =
    useWatch({ control, name: 'graduationStrategy' }) ?? 'SS_PERFORMANCE';
  const scheduleValue = useWatch({ control, name: 'scheduleValue' }) ?? '';

  // Posting slots: the destination's unified slots (enabling-backend
  // read API) through the typed client + React Query (§5.5).
  const slotsQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).destinations.slots(destination.id),
    queryFn: ({ signal }) =>
      api.get(
        buildTenantApiPath(
          subdomain,
          `/destinations/${destination.id}/posting-slots`
        ),
        { schema: ListDestinationPostingSlotsResponseSchema, signal }
      ),
  });
  const slots = useMemo(
    () => (slotsQuery.data ? toDestinationSlotViews(slotsQuery.data) : []),
    [slotsQuery.data]
  );
  const destinationTimezone =
    slotsQuery.data?.timezone ?? destination.timezone ?? 'UTC';
  const hasActiveSlots = slots.some((slot) => slot.isActive);
  const slotsLoadFailed = slotsQuery.isError;

  const formatKey = formatKeyFor(format);
  const nextSlot = useMemo(
    () => getNextDestinationSlot(slots, formatKey),
    [slots, formatKey]
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

  // Default intent once slots are known (FB parity: queue when the
  // destination has posting times) — only until the user picks one.
  useEffect(() => {
    if (!slotsQuery.data || intentTouchedRef.current) return;
    if (hasActiveSlots && getValues('intent') === 'now') {
      setValue('intent', 'queue');
    }
  }, [slotsQuery.data, hasActiveSlots, getValues, setValue]);

  // Schedule default: the next covering slot's occurrence, else the
  // next hour — re-derived on format change until the user edits it.
  useEffect(() => {
    if (scheduleEditedRef.current) return;
    const next = getNextDestinationSlot(slots, formatKey);
    const date = next?.occurrence ?? roundUpToNextHour(new Date());
    setValue(
      'scheduleValue',
      toDateTimeLocalValue(date, next?.slot.timezone ?? destinationTimezone)
    );
  }, [slots, formatKey, destinationTimezone, setValue]);

  const optionsState: InstagramOptionsFormState = {
    collaboratorsText,
    shareToFeed,
    coverUrl,
    trialReel,
    graduationStrategy,
  };

  const captionError = instagramCaptionError(format, caption);
  const firstCommentTooLong =
    format !== 'story' &&
    firstComment.trim().length > FIRST_COMMENT_MAX_CHARACTERS;
  const optionsError = validateInstagramOptions(format, optionsState);

  const validationError =
    intent === 'queue' && slotsLoadFailed
      ? "Couldn't load this account's posting times — try again."
      : intent === 'queue' && slotsQuery.isPending
        ? null
        : computeInstagramValidationError({
            format,
            items: mediaItems,
            caption,
            firstComment,
            optionsState,
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
    if (captionError) {
      entries.push({ fieldId: `${TEST_ID_PREFIX}-caption-field`, message: captionError });
    }
    if (firstCommentTooLong) {
      entries.push({
        fieldId: `${TEST_ID_PREFIX}-first-comment-field`,
        message: `First comments can be at most ${FIRST_COMMENT_MAX_CHARACTERS.toLocaleString('en-US')} characters.`,
      });
    }
    if (optionsError) {
      entries.push({
        ...(optionsError.field === 'collaborators'
          ? { fieldId: `${TEST_ID_PREFIX}-collaborators-field` }
          : optionsError.field === 'coverUrl'
            ? { fieldId: `${TEST_ID_PREFIX}-cover-url-field` }
            : {}),
        message: optionsError.message,
      });
    }
    if (validationError && !entries.some((e) => e.message === validationError)) {
      entries.push({ message: validationError });
    }
    if (submitError) entries.push({ message: submitError });
    return entries;
  }, [submitAttempted, captionError, firstCommentTooLong, optionsError, validationError, submitError]);

  const handleItemsChange = (next: DestinationMediaItem[]) => {
    setMediaItems(next);
    // A real library caption pre-fills the caption until the user types
    // (filename-derived captions never do — `hasRealCaption`).
    if (format === 'story' || captionEditedRef.current) return;
    const first = next.at(0);
    if (first && hasRealCaption(first)) {
      setValue('caption', first.captionText ?? '');
    }
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitAttempted(true);
    if (validationError) return;
    const typedFormat = values.format as InstagramFormat;
    const finalScheduleDate =
      values.intent === 'schedule'
        ? parseDateTimeLocalValue(values.scheduleValue, destinationTimezone)
        : null;
    const options = buildInstagramOptions(typedFormat, {
      collaboratorsText: values.collaboratorsText,
      shareToFeed: values.shareToFeed,
      coverUrl: values.coverUrl,
      trialReel: values.trialReel,
      graduationStrategy: values.graduationStrategy,
    });
    const request = buildInstagramEnqueueRequest(destination.id, {
      format: typedFormat,
      caption: values.caption,
      firstComment: values.firstComment,
      items: mediaItems,
      options,
      intent: values.intent as ComposerIntent,
      scheduleDate: finalScheduleDate,
    });
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await submitInstagramEnqueue(subdomain, request);
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
  const captionInlineError =
    captionError && (blurredFields.has('caption') || showFieldErrors)
      ? captionError
      : undefined;
  const firstCommentInlineError =
    firstCommentTooLong && (blurredFields.has('firstComment') || showFieldErrors)
      ? `First comments can be at most ${FIRST_COMMENT_MAX_CHARACTERS.toLocaleString('en-US')} characters.`
      : undefined;
  const collaboratorsInlineError =
    optionsError?.field === 'collaborators' &&
    (blurredFields.has('collaboratorsText') || showFieldErrors)
      ? optionsError.message
      : undefined;
  const coverUrlInlineError =
    optionsError?.field === 'coverUrl' &&
    (blurredFields.has('coverUrl') || showFieldErrors)
      ? optionsError.message
      : undefined;

  const limitNote = getDestinationLimitNote('instagram');
  const queueNote =
    intent === 'queue' && nextSlot
      ? `Goes out ${formatSlotShort(nextSlot.occurrence, destinationTimezone)} ${destinationTimezone}.`
      : null;
  const isStory = format === 'story';
  const formatLabel =
    formats.find((f) => f.id === format)?.label ??
    (format === 'story' ? 'Story' : 'Photo');

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
          <DestinationFormatSelector
            options={formats.map((f) => ({ id: f.id, label: f.label }))}
            value={format}
            onChange={(id) => setValue('format', id as InstagramFormValues['format'])}
            testIdPrefix={TEST_ID_PREFIX}
          />

          <DestinationMediaArea
            subdomain={subdomain}
            items={mediaItems}
            onItemsChange={handleItemsChange}
            maxItems={instagramMaxItems(format)}
            capMessage={instagramCapMessage(format)}
            getItemError={(item) => getInstagramItemError(item, format)}
            accept={format === 'photo' ? 'image/*' : format === 'reel' ? 'video/*' : 'image/*,video/*'}
            testIdPrefix={TEST_ID_PREFIX}
          />

          {isStory ? (
            <p
              data-testid={`${TEST_ID_PREFIX}-story-note`}
              className="m-0 text-body text-ink-sub"
            >
              Stories publish as a single photo or video, without a caption.
            </p>
          ) : (
            <>
              <div
                data-testid={`${TEST_ID_PREFIX}-caption`}
                className="flex flex-col gap-1.5"
              >
                <label
                  htmlFor={`${TEST_ID_PREFIX}-caption-field`}
                  className="text-body font-medium text-ink"
                >
                  Caption
                </label>
                <Textarea
                  id={`${TEST_ID_PREFIX}-caption-field`}
                  data-testid={`${TEST_ID_PREFIX}-caption-field`}
                  rows={4}
                  value={caption}
                  onChange={(e) => {
                    captionEditedRef.current = true;
                    setValue('caption', e.target.value);
                  }}
                  onBlur={() => markBlurred('caption')}
                  placeholder="Write a caption for this post…"
                  aria-invalid={captionInlineError ? true : undefined}
                  aria-describedby={
                    captionInlineError ? `${TEST_ID_PREFIX}-caption-error` : undefined
                  }
                  className="min-h-24 resize-y"
                />
                {captionInlineError ? (
                  <p
                    id={`${TEST_ID_PREFIX}-caption-error`}
                    role="alert"
                    className="text-metadata font-medium text-brand-rose"
                  >
                    {captionInlineError}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <span
                    data-testid={`${TEST_ID_PREFIX}-caption-count`}
                    className={cn(
                      'text-metadata tabular-nums',
                      caption.length > INSTAGRAM_MAX_CAPTION_CHARACTERS
                        ? 'text-brand-rose'
                        : 'text-ink-sub'
                    )}
                  >
                    {caption.length.toLocaleString('en-US')} /{' '}
                    {INSTAGRAM_MAX_CAPTION_CHARACTERS.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${TEST_ID_PREFIX}-first-comment-field`}
                  className="text-body font-medium text-ink"
                >
                  First comment (optional)
                </label>
                <Textarea
                  id={`${TEST_ID_PREFIX}-first-comment-field`}
                  data-testid={`${TEST_ID_PREFIX}-first-comment-field`}
                  rows={2}
                  value={firstComment}
                  onChange={(e) => setValue('firstComment', e.target.value)}
                  onBlur={() => markBlurred('firstComment')}
                  placeholder="Add a first comment — handy for extra hashtags…"
                  aria-invalid={firstCommentInlineError ? true : undefined}
                  aria-describedby={
                    firstCommentInlineError
                      ? `${TEST_ID_PREFIX}-first-comment-error`
                      : undefined
                  }
                  className="resize-y"
                />
                {firstCommentInlineError ? (
                  <p
                    id={`${TEST_ID_PREFIX}-first-comment-error`}
                    role="alert"
                    className="text-metadata font-medium text-brand-rose"
                  >
                    {firstCommentInlineError}
                  </p>
                ) : null}
                <div className="flex justify-end">
                  <span className="text-metadata tabular-nums text-ink-sub">
                    {firstComment.trim().length.toLocaleString('en-US')} /{' '}
                    {FIRST_COMMENT_MAX_CHARACTERS.toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={`${TEST_ID_PREFIX}-collaborators-field`}
                  className="text-body font-medium text-ink"
                >
                  Collaborators (optional)
                </label>
                <Input
                  id={`${TEST_ID_PREFIX}-collaborators-field`}
                  data-testid={`${TEST_ID_PREFIX}-collaborators-field`}
                  value={collaboratorsText}
                  onChange={(e) => setValue('collaboratorsText', e.target.value)}
                  onBlur={() => markBlurred('collaboratorsText')}
                  placeholder="e.g. brand.account, creator.name"
                  aria-invalid={collaboratorsInlineError ? true : undefined}
                  aria-describedby={
                    collaboratorsInlineError
                      ? `${TEST_ID_PREFIX}-collaborators-error`
                      : undefined
                  }
                />
                {collaboratorsInlineError ? (
                  <p
                    id={`${TEST_ID_PREFIX}-collaborators-error`}
                    role="alert"
                    className="text-metadata font-medium text-brand-rose"
                  >
                    {collaboratorsInlineError}
                  </p>
                ) : (
                  <span className="text-metadata text-ink-sub">
                    Invite up to 3 Instagram accounts to co-author this post,
                    separated by commas.
                  </span>
                )}
              </div>

              {format === 'reel' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor={`${TEST_ID_PREFIX}-share-to-feed`}
                      className="text-body font-medium text-ink"
                    >
                      Also share to feed
                    </label>
                    <Switch
                      id={`${TEST_ID_PREFIX}-share-to-feed`}
                      data-testid={`${TEST_ID_PREFIX}-share-to-feed`}
                      checked={shareToFeed}
                      onCheckedChange={(checked) => setValue('shareToFeed', checked)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`${TEST_ID_PREFIX}-cover-url-field`}
                      className="text-body font-medium text-ink"
                    >
                      Cover image link (optional)
                    </label>
                    <Input
                      id={`${TEST_ID_PREFIX}-cover-url-field`}
                      data-testid={`${TEST_ID_PREFIX}-cover-url-field`}
                      value={coverUrl}
                      onChange={(e) => setValue('coverUrl', e.target.value)}
                      onBlur={() => markBlurred('coverUrl')}
                      placeholder="https://…"
                      aria-invalid={coverUrlInlineError ? true : undefined}
                      aria-describedby={
                        coverUrlInlineError
                          ? `${TEST_ID_PREFIX}-cover-url-error`
                          : undefined
                      }
                    />
                    {coverUrlInlineError ? (
                      <p
                        id={`${TEST_ID_PREFIX}-cover-url-error`}
                        role="alert"
                        className="text-metadata font-medium text-brand-rose"
                      >
                        {coverUrlInlineError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`${TEST_ID_PREFIX}-trial-reel`}
                        data-testid={`${TEST_ID_PREFIX}-trial-reel`}
                        checked={trialReel}
                        onCheckedChange={(checked) =>
                          setValue('trialReel', checked === true)
                        }
                      />
                      <label
                        htmlFor={`${TEST_ID_PREFIX}-trial-reel`}
                        className="text-body font-medium text-ink"
                      >
                        Trial Reel — show it to non-followers first
                      </label>
                    </div>
                    {trialReel && (
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`${TEST_ID_PREFIX}-graduation-strategy`}
                          className="text-body font-medium text-ink"
                        >
                          When it performs well
                        </label>
                        <Select
                          value={graduationStrategy}
                          onValueChange={(value) =>
                            setValue(
                              'graduationStrategy',
                              value as InstagramFormValues['graduationStrategy']
                            )
                          }
                        >
                          <SelectTrigger
                            id={`${TEST_ID_PREFIX}-graduation-strategy`}
                            data-testid={`${TEST_ID_PREFIX}-graduation-strategy`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRADUATION_STRATEGY_OPTIONS.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {destination.status === 'action_required' && (
            <Banner
              variant="warning"
              title="This account needs attention before it can publish."
              description="Reconnect it from Accounts — posts you queue will wait until it is healthy again."
            />
          )}

          <DestinationPreview
            destinationName={destination.name}
            formatLabel={formatLabel}
            text={isStory ? '' : caption}
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
            platformName="Instagram"
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
            formatPluralLabel={instagramFormatPlural(format)}
            nextSlotOccurrence={nextSlot?.occurrence ?? null}
            testIdPrefix={TEST_ID_PREFIX}
          />

          {submitAttempted && summaryEntries.length > 0 && (
            <FormErrorSummary errors={summaryEntries} />
          )}

          <DestinationSubmitSection
            platformName="Instagram"
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
