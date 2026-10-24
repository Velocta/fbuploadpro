'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TIKTOK_CAPTION_MAX_LENGTH } from '@fbuploadpro/contracts';
import { ApiError } from '@/lib/api';
import type { DestinationDetail } from '@/lib/api/schemas/connect';
import { queryKeys } from '@/lib/data/query-keys';
import { Banner } from '@/components/shared/ui/banner';
import { Button } from '@/components/shared/ui/button';
import {
  Form,
  FormErrorSummary,
  type FormErrorSummaryEntry,
} from '@/components/shared/ui/form';
import {
  ComposerMediaArea,
  getMediaItemError,
  type ComposerMediaItem,
} from '../composer/composer-media-area';
import { ComposerPreview } from '../composer/composer-preview';
import {
  formatSlotLong,
  formatSlotShort,
  hasRealCaption,
} from '../composer/queue-slot-utils';
import {
  DestinationIntentSection,
  DestinationSubmitSection,
  defaultScheduleValue,
  parseScheduleValue,
} from './destination-composer-sections';
import {
  fetchDestinationPostingSlots,
  submitPlatformEnqueue,
} from './destination-enqueue-client';
import { getNextSlotForKind } from './destination-slot-utils';
import { PlatformCaptionField } from './platform-caption-field';
import {
  buildTikTokEnqueueRequest,
  computeTikTokValidationError,
  TIKTOK_COMPOSER_DEFAULT_VALUES,
  tiktokComposerFormSchema,
  type TikTokComposerFormValues,
} from './tiktok-composer-form';
import {
  TikTokAutoMusicField,
  TikTokInteractionFields,
  TikTokKindField,
  TikTokPrivacyField,
} from './tiktok-composer-fields';

/**
 * TikTok composer (spec 132 G-TT) — a full-page composer inside the
 * destination frame's composer slot (PR-131-4), cloning the family
 * framework (PR-C1): RHF + zod on the form standard, intents
 * now/scheduled/queue through the unified destination enqueue, media
 * from the shared media area, preview parity.
 *
 * Fields are exactly spec 126's shipped options schema: caption,
 * privacy, and the interaction toggles as explicit Default/On/Off
 * choices (an omitted key means TikTok's own default applies — the
 * form never invents a value). `autoAddMusic` appears for photo
 * posts only, per the schema. There is NO draft option — `isDraft`
 * is deliberately unmodelled in spec 126 — and no other field the
 * schema cannot carry. Posting runs through Post for Me (D1): the
 * composer is fully correct against the schema whether or not the
 * provider key is configured yet. TikTok's D5 limits are `{}` (no
 * provider window resolved), so no usage indicator is shown — only
 * real destination state (OD132-3 (a)).
 */

export interface TikTokComposerProps {
  subdomain: string;
  destination: DestinationDetail;
}

export function TikTokComposer({
  subdomain,
  destination,
}: Readonly<TikTokComposerProps>) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ComposerMediaItem[]>([]);
  const [isCaptionTouched, setIsCaptionTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const form = useForm<TikTokComposerFormValues>({
    resolver: zodResolver(tiktokComposerFormSchema),
    mode: 'onTouched',
    defaultValues: TIKTOK_COMPOSER_DEFAULT_VALUES,
  });
  const values = form.watch();
  const { intent, kind, caption, scheduleValue } = values;
  const fieldErrors = form.formState.errors;
  const isSubmitting = form.formState.isSubmitting;

  const slotsQuery = useQuery({
    queryKey: queryKeys.tenant(subdomain).destinations.slots(destination.id),
    queryFn: ({ signal }) =>
      fetchDestinationPostingSlots(subdomain, destination.id, signal),
  });
  const slotsReady = slotsQuery.isSuccess;
  const slots = useMemo(() => slotsQuery.data?.slots ?? [], [slotsQuery.data]);
  const timezone = slotsQuery.data?.timezone ?? destination.timezone;
  const activeSlots = useMemo(() => slots.filter((s) => s.isActive), [slots]);
  const nextForKind = useMemo(
    () => getNextSlotForKind(slots, kind, timezone),
    [slots, kind, timezone],
  );

  const scheduleDate = useMemo(
    () => parseScheduleValue(scheduleValue, timezone),
    [scheduleValue, timezone],
  );
  const isScheduleInFuture = Boolean(
    scheduleDate && scheduleDate.getTime() > Date.now(),
  );

  // Mirror of the family: with no posting times the queue intent
  // cannot stand — fall back to Post now once slots are known.
  React.useEffect(() => {
    if (slotsReady && activeSlots.length === 0 && intent === 'queue') {
      form.setValue('intent', 'now');
    }
  }, [slotsReady, activeSlots.length, intent, form]);

  const handleItemsChange = (next: ComposerMediaItem[]) => {
    setItems(next);
    // Library captions carry into the caption only when the user
    // hasn't written their own yet — filename-derived pseudo-captions
    // never pre-fill (the family rule).
    if (!isCaptionTouched) {
      const withCaption = next.find((item) => hasRealCaption(item));
      form.setValue('caption', withCaption?.captionText?.trim() ?? '');
    }
  };

  const handleIntentChange = (next: TikTokComposerFormValues['intent']) => {
    form.setValue('intent', next);
    if (next === 'schedule' && !form.getValues('scheduleValue')) {
      form.setValue(
        'scheduleValue',
        defaultScheduleValue(nextForKind?.occurrence ?? null, timezone),
      );
    }
  };

  // Slot facts gate only the queue checks: until the slots read lands
  // they are treated as satisfied here, and the queue intent itself
  // stays unsubmittable (below) — Post now / Schedule never wait on it.
  const validationError = computeTikTokValidationError({
    mediaCount: items.length,
    hasMediaTypeError: items.some(
      (item) => getMediaItemError(item, kind) !== null,
    ),
    kind,
    caption,
    intent,
    isScheduleInFuture,
    hasActiveSlots: slotsReady ? activeSlots.length > 0 : true,
    hasCoveringSlot: slotsReady ? nextForKind !== null : true,
  });
  const isSubmitDisabled =
    isSubmitting ||
    validationError !== null ||
    (intent === 'queue' && !slotsReady);

  const summaryEntries: FormErrorSummaryEntry[] = [];
  if (fieldErrors.caption?.message) {
    summaryEntries.push({
      fieldId: 'tiktok-composer-caption-field',
      message: fieldErrors.caption.message,
    });
  }
  if (serverError) {
    summaryEntries.push({ message: serverError });
  } else if (submitAttempted && validationError && summaryEntries.length === 0) {
    summaryEntries.push({ message: validationError });
  }

  const resetComposer = () => {
    form.reset(TIKTOK_COMPOSER_DEFAULT_VALUES);
    setItems([]);
    setIsCaptionTouched(false);
    setServerError(null);
    setSubmitAttempted(false);
  };

  const handleValidSubmit = async (submitted: TikTokComposerFormValues) => {
    setSubmitAttempted(true);
    setServerError(null);
    setSuccessMessage(null);
    const built = buildTikTokEnqueueRequest({
      destinationId: destination.id,
      values: submitted,
      mediaItemIds: items.map((item) => item.id),
      scheduleDate,
    });
    if (!built.ok) {
      setServerError(built.error);
      return;
    }
    try {
      await submitPlatformEnqueue(subdomain, built.request);
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.message
          : "Couldn't save this post. Please try again.",
      );
      return;
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tenant(subdomain).queue.all,
    });
    await queryClient.invalidateQueries({
      queryKey: queryKeys.tenant(subdomain).destinations.detail(destination.id),
    });
    setSuccessMessage(
      submitted.intent === 'now'
        ? `Posted to ${destination.name}.`
        : submitted.intent === 'schedule' && scheduleDate
          ? `Scheduled for ${formatSlotLong(scheduleDate, timezone)}.`
          : nextForKind
            ? `Added to queue — goes out ${formatSlotShort(nextForKind.occurrence, timezone)}.`
            : 'Added to queue.',
    );
    resetComposer();
  };

  if (destination.status !== 'active') {
    return (
      <Banner
        variant="warning"
        title="This account needs attention before you can post"
        description="The connection to this TikTok account is not active right now. Reconnect it from Accounts, then come back to write your post."
        action={
          <Button asChild variant="outline">
            <Link href={`/tenant/${subdomain}/accounts`}>Go to Accounts</Link>
          </Button>
        }
      />
    );
  }

  const kindLabel = kind === 'video' ? 'Videos' : 'Photos';

  return (
    <Form {...form}>
      <form
        data-testid="tiktok-composer"
        data-platform="tiktok"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(handleValidSubmit, () =>
          setSubmitAttempted(true),
        )}
        noValidate
      >
        <FormErrorSummary errors={summaryEntries} />
        {successMessage && (
          <Banner
            data-testid="tiktok-composer-success"
            variant="success"
            title={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <TikTokKindField control={form.control} />

          <ComposerMediaArea
            subdomain={subdomain}
            format={kind}
            items={items}
            onItemsChange={handleItemsChange}
          />

          <Controller
            control={form.control}
            name="caption"
            render={({ field }) => (
              <PlatformCaptionField
                idStem="tiktok-composer-caption"
                label="Caption"
                value={field.value}
                onChange={(next) => {
                  setIsCaptionTouched(true);
                  field.onChange(next);
                }}
                onBlur={field.onBlur}
                placeholder="Write your caption…"
                error={fieldErrors.caption?.message}
                limit={TIKTOK_CAPTION_MAX_LENGTH}
                countMode="characters"
                limitLabel={`${TIKTOK_CAPTION_MAX_LENGTH.toLocaleString('en-US')} characters`}
                rows={4}
              />
            )}
          />

          <TikTokPrivacyField
            control={form.control}
            error={fieldErrors.privacy?.message}
          />

          <TikTokInteractionFields control={form.control} />

          {kind === 'image' ? (
            <TikTokAutoMusicField control={form.control} />
          ) : null}

          <DestinationIntentSection
            platformLabel="TikTok"
            intent={intent}
            onIntentChange={handleIntentChange}
            slotsReady={slotsReady}
            slotsError={slotsQuery.isError}
            hasActiveSlots={activeSlots.length > 0}
            coveringKindLabel={kindLabel}
            hasCoveringSlot={nextForKind !== null}
            nextOccurrence={nextForKind?.occurrence ?? null}
            timezone={timezone}
            scheduleValue={scheduleValue}
            onScheduleChange={(next) => form.setValue('scheduleValue', next)}
            scheduleDate={scheduleDate}
            isScheduleInFuture={isScheduleInFuture}
          />
        </div>

        <ComposerPreview
          format={kind}
          pageName={destination.name}
          mediaItems={items}
          caption={caption}
          link=""
        />

        <DestinationSubmitSection
          error={null}
          intent={intent}
          platformLabel="TikTok"
          scheduleDate={scheduleDate}
          isScheduleInFuture={isScheduleInFuture}
          scheduleTimezone={timezone}
          queueNote={
            nextForKind
              ? `Goes out ${formatSlotShort(nextForKind.occurrence, timezone)} ${timezone}.`
              : null
          }
          isSubmitDisabled={isSubmitDisabled}
          isSubmitting={isSubmitting}
          onCancel={() => {
            resetComposer();
            setSuccessMessage(null);
          }}
        />
      </form>
    </Form>
  );
}
