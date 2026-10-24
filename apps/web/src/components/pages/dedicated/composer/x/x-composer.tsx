'use client';

/**
 * The X composer (spec 132 §4.5), a FULL PAGE section (OD132-1 (a))
 * mounted in the destination frame's composer slot (spec 131 PR-131-4)
 * on shared/ui primitives + the form standard (RHF + zod, onTouched) +
 * the typed API client. X runs on the GLOBAL app (spec 127) — no
 * per-workspace credentials — and the destination's connection state
 * decides usability: a destination (or its owning account) that is not
 * active renders the frame's not-connected pattern with no form.
 *
 * X rules (all single-sourced from contracts): 280 weighted characters
 * via the contracts counter; MAX-1 media attachment; poll XOR media,
 * blocked visibly in both directions; options strictly the strict
 * `XPlatformOptionsSchema` shape (poll / replySettings / quote /
 * altText — no thread-chain authoring, chains are absent in v1);
 * intents now / scheduled / queue through the unified destination
 * enqueue; the limit indicator derives from the contracts limits
 * config (OD132-3(a) — no usage counts exist to read). No drafts
 * (OD132-2 (c)).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ListDestinationPostingSlotsResponseSchema,
  X_ALT_TEXT_MAX_CHARACTERS,
  XReplySettingsSchema,
  type XReplySettings,
} from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { queryKeys } from '@/lib/data/query-keys';
import { socialStatusLabel } from '@/components/accounts/social-accounts-list';
import { Form, FormErrorSummary, type FormErrorSummaryEntry } from '@/components/shared/ui/form';
import { Banner } from '@/components/shared/ui/banner';
import { Input } from '@/components/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import { submitDestinationEnqueue } from '../destination-enqueue';
import { formatSlotLong, formatSlotShort, parseDateTimeLocalValue } from '../queue-slot-utils';
import { getXLimitIndicator } from './x-limit-indicator';
import { buildXEnqueueRequest, xPostKind } from './x-destination-enqueue';
import { nextXSlotOccurrence, xQueueGoesOutLine } from './x-slot-utils';
import {
  X_COMPOSER_DEFAULT_VALUES,
  xComposerFormSchema,
  type XComposerFormValues,
} from './x-composer-form-schema';
import { computeXValidationError, resolveXInitialScheduleValue, xSubmitButtonLabel } from './x-composer-validation';
import { getXMediaItemError, XMediaArea, type XMediaItem } from './x-media-area';
import { XComposerText } from './x-composer-text';
import { XPollBuilder } from './x-poll-builder';
import { XComposerPreview } from './x-composer-preview';
import { XIntentSection, XSubmitSection, type XQueueSlotsState } from './x-composer-sections';

export interface XComposerProps {
  subdomain: string;
  destination: DestinationDetail;
  /** Called with the success message after a successful submit (the
   *  frame has no toast wiring today, so the composer also shows it). */
  onSubmitted?: (message: string) => void;
}

const REPLY_SETTINGS_OPTIONS: Array<{ value: XReplySettings; label: string }> = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'mentionedUsers', label: 'Mentioned users' },
  { value: 'following', label: 'People you follow' },
  { value: 'verified', label: 'Verified accounts' },
];

const DEFAULT_POLL_DURATION_MINUTES = 1440;

export function XComposer({ subdomain, destination, onSubmitted }: Readonly<XComposerProps>) {
  const queryClient = useQueryClient();
  const isConnected = destination.status === 'active' && destination.account.status === 'active';

  const [item, setItem] = useState<XMediaItem | null>(null);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDurationMinutes, setPollDurationMinutes] = useState(DEFAULT_POLL_DURATION_MINUTES);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const intentTouchedRef = useRef(false);
  const scheduleTouchedRef = useRef(false);

  const form = useForm<XComposerFormValues>({
    resolver: zodResolver(xComposerFormSchema),
    mode: 'onTouched',
    defaultValues: X_COMPOSER_DEFAULT_VALUES,
  });
  const values = form.watch();
  const { intent, text, scheduleValue, altText } = values;
  const fieldErrors = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting;

  // The destination's unified posting slots (enabling backend, PR 756) —
  // reference data, 60s stale per spec 132 §7. Queue availability,
  // the schedule default and every "goes out" line derive from it.
  const slotsQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).destinations.slots(destination.id),
    queryFn: ({ signal }) =>
      api.get(buildTenantApiPath(subdomain, `/destinations/${destination.id}/posting-slots`), {
        schema: ListDestinationPostingSlotsResponseSchema,
        signal,
      }),
    staleTime: 60_000,
    enabled: isConnected,
  });
  const timezone = slotsQuery.data?.timezone ?? destination.timezone;
  const activeSlots = useMemo(
    () => (slotsQuery.data?.slots ?? []).filter((slot) => slot.isActive),
    [slotsQuery.data]
  );
  const kind = xPostKind(item);
  const nextSlot = useMemo(
    () => nextXSlotOccurrence(activeSlots, timezone, kind),
    [activeSlots, timezone, kind]
  );

  const queueSlotsState: XQueueSlotsState = slotsQuery.isPending
    ? 'loading'
    : slotsQuery.isError
      ? 'error'
      : activeSlots.length === 0
        ? 'no-slots'
        : nextSlot === null
          ? 'no-covering'
          : 'ready';
  const queueDisabled =
    queueSlotsState === 'loading' || queueSlotsState === 'error' || queueSlotsState === 'no-slots';
  const queueLine = nextSlot ? xQueueGoesOutLine(nextSlot.occurrence, timezone) : null;

  // Safest-intent fallback: the default is queue, but a destination
  // with no usable posting times starts on "Post now" instead (the
  // user can still pick Queue's neighbours freely afterwards).
  useEffect(() => {
    if (slotsQuery.isPending || intentTouchedRef.current) return;
    if (
      (queueSlotsState === 'no-slots' || queueSlotsState === 'error') &&
      form.getValues('intent') === 'queue'
    ) {
      form.setValue('intent', 'now');
    }
  }, [slotsQuery.isPending, queueSlotsState, form]);

  // The schedule field defaults to the next covering slot occurrence
  // (else the next whole hour) until the user edits it.
  useEffect(() => {
    if (slotsQuery.isPending || scheduleTouchedRef.current) return;
    form.setValue('scheduleValue', resolveXInitialScheduleValue(nextSlot?.occurrence ?? null, timezone));
  }, [slotsQuery.isPending, nextSlot, timezone, form]);

  const scheduleDate = useMemo(
    () => parseDateTimeLocalValue(scheduleValue, timezone),
    [scheduleValue, timezone]
  );
  const isScheduleInFuture = Boolean(scheduleDate && scheduleDate.getTime() > Date.now());

  const mediaError = item ? getXMediaItemError(item) : null;
  const validationError = computeXValidationError({
    text,
    hasMedia: item !== null,
    mediaError,
    pollEnabled,
    pollOptions,
    pollDurationMinutes,
    intent,
    isScheduleInFuture,
    hasActiveSlots: activeSlots.length > 0,
    hasCoveringSlot: nextSlot !== null,
  });
  const isSubmitDisabled = isSubmitting || validationError !== null;

  const summaryEntries: FormErrorSummaryEntry[] = [];
  if (fieldErrors.text?.message) {
    summaryEntries.push({ fieldId: 'x-composer-text-field', message: fieldErrors.text.message });
  }
  if (fieldErrors.altText?.message) {
    summaryEntries.push({ fieldId: 'x-composer-alt-text-field', message: fieldErrors.altText.message });
  }
  if (serverError) {
    summaryEntries.push({ message: serverError });
  } else if (submitAttempted && validationError && summaryEntries.length === 0) {
    summaryEntries.push({ message: validationError });
  }

  const handleValidSubmit = async (submitted: XComposerFormValues) => {
    setSubmitAttempted(true);
    setServerError(null);
    try {
      const request = buildXEnqueueRequest(destination.id, {
        text: submitted.text,
        item,
        intent: submitted.intent,
        scheduleDate,
        replySettings: submitted.replySettings,
        quoteTweetId: submitted.quoteTweetId,
        altText: submitted.altText,
        poll: pollEnabled ? { options: pollOptions, durationMinutes: pollDurationMinutes } : null,
      });
      await submitDestinationEnqueue(subdomain, request);
      const message =
        submitted.intent === 'now'
          ? `Posted to ${destination.name}.`
          : submitted.intent === 'schedule' && scheduleDate
            ? `Scheduled for ${formatSlotLong(scheduleDate, timezone)}.`
            : nextSlot
              ? `Added to queue — goes out ${formatSlotShort(nextSlot.occurrence, timezone)}.`
              : 'Added to queue.';
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tenant(subdomain).queue.all,
      });
      setSuccessMessage(message);
      onSubmitted?.(message);
      form.reset(X_COMPOSER_DEFAULT_VALUES);
      setItem(null);
      setPollEnabled(false);
      setPollOptions(['', '']);
      setPollDurationMinutes(DEFAULT_POLL_DURATION_MINUTES);
      intentTouchedRef.current = false;
      scheduleTouchedRef.current = false;
      setSubmitAttempted(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save this post. Please try again.");
    }
  };

  if (!isConnected) {
    const blockingStatus = destination.status !== 'active' ? destination.status : destination.account.status;
    return (
      <section data-testid="x-composer-not-connected" aria-label="New X post" className="flex flex-col gap-3">
        <Banner
          variant="warning"
          title={socialStatusLabel(blockingStatus)}
          description="Reconnect this account from Accounts to start posting."
        />
      </section>
    );
  }

  const limitIndicator = getXLimitIndicator();

  return (
    <section data-testid="x-composer" aria-label="New X post" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-body font-semibold text-ink"
        >
          {destination.name.charAt(0).toUpperCase() || 'X'}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold text-ink">{destination.name}</span>
          <span className="text-metadata text-ink-sub">
            {destination.handle ? `${destination.handle} · X` : 'X account'}
          </span>
        </div>
      </div>

      {limitIndicator && (
        <p data-testid="x-composer-limit-note" className="m-0 text-metadata text-ink-sub">
          {limitIndicator.message}
        </p>
      )}

      {successMessage && (
        <div data-testid="x-composer-success">
          <Banner variant="success" title={successMessage} onDismiss={() => setSuccessMessage(null)} />
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleValidSubmit, () => setSubmitAttempted(true))}
          className="flex flex-col gap-6"
          noValidate
        >
          {submitAttempted && summaryEntries.length > 0 && <FormErrorSummary errors={summaryEntries} />}

          <XIntentSection
            intent={intent}
            onIntentChange={(next) => {
              intentTouchedRef.current = true;
              form.setValue('intent', next);
            }}
            queueDisabled={queueDisabled}
            timezone={timezone}
            scheduleValue={scheduleValue}
            onScheduleChange={(value) => {
              scheduleTouchedRef.current = true;
              form.setValue('scheduleValue', value);
            }}
            scheduleDate={scheduleDate}
            isScheduleInFuture={isScheduleInFuture}
            queueSlotsState={queueSlotsState}
            queueLine={queueLine}
          />

          <Controller
            control={form.control}
            name="text"
            render={({ field, fieldState }) => (
              <XComposerText
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                required={item === null}
                error={fieldState.error?.message}
              />
            )}
          />

          <XMediaArea subdomain={subdomain} item={item} onItemChange={setItem} pollEnabled={pollEnabled} />

          {item && (
            <Controller
              control={form.control}
              name="altText"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="x-composer-alt-text-field" className="text-body font-medium text-ink">
                    Alt text
                  </label>
                  <Input
                    id="x-composer-alt-text-field"
                    data-testid="x-composer-alt-text-field"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Describe the media for people who can't see it"
                    aria-invalid={fieldState.error ? true : undefined}
                    className="min-h-11"
                  />
                  {fieldState.error?.message ? (
                    <p role="alert" className="m-0 text-metadata font-medium text-brand-rose">
                      {fieldState.error.message}
                    </p>
                  ) : (
                    <div className="flex justify-end">
                      <span className="text-metadata tabular-nums text-ink-sub">
                        {altText.length} / {X_ALT_TEXT_MAX_CHARACTERS}
                      </span>
                    </div>
                  )}
                </div>
              )}
            />
          )}

          <XPollBuilder
            enabled={pollEnabled}
            onEnabledChange={setPollEnabled}
            options={pollOptions}
            onOptionsChange={setPollOptions}
            durationMinutes={pollDurationMinutes}
            onDurationChange={setPollDurationMinutes}
            mediaAttached={item !== null}
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <Controller
              control={form.control}
              name="replySettings"
              render={({ field }) => (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="x-composer-reply-settings" className="text-body font-medium text-ink">
                    Who can reply
                  </label>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(XReplySettingsSchema.parse(value))}
                  >
                    <SelectTrigger
                      id="x-composer-reply-settings"
                      data-testid="x-composer-reply-settings"
                      className="min-h-11"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPLY_SETTINGS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />

            <Controller
              control={form.control}
              name="quoteTweetId"
              render={({ field }) => (
                <div className="flex flex-1 flex-col gap-1.5">
                  <label htmlFor="x-composer-quote-field" className="text-body font-medium text-ink">
                    Quote a post (optional)
                  </label>
                  <Input
                    id="x-composer-quote-field"
                    data-testid="x-composer-quote-field"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder="Post ID to quote"
                    className="min-h-11"
                  />
                  <p className="m-0 text-metadata text-ink-sub">
                    Paste the ID of the X post you want to quote.
                  </p>
                </div>
              )}
            />
          </div>

          <XComposerPreview
            destinationName={destination.name}
            handle={destination.handle}
            text={text}
            item={item}
            pollOptions={pollEnabled ? pollOptions : null}
            quoteTweetId={values.quoteTweetId}
          />

          <XSubmitSection
            error={serverError}
            isSubmitDisabled={isSubmitDisabled}
            isSubmitting={isSubmitting}
            submitLabel={xSubmitButtonLabel(intent)}
          />
        </form>
      </Form>
    </section>
  );
}
