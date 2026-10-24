'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { YOUTUBE_DESCRIPTION_MAX_BYTES } from '@fbuploadpro/contracts';
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
  buildYouTubeEnqueueRequest,
  computeYouTubeValidationError,
  YOUTUBE_COMPOSER_DEFAULT_VALUES,
  youtubeComposerFormSchema,
  type YouTubeComposerFormValues,
} from './youtube-composer-form';
import {
  YouTubeCategoryField,
  YouTubeMadeForKidsField,
  YouTubePrivacyField,
  YouTubeTagsField,
  YouTubeTitleField,
} from './youtube-composer-fields';

/**
 * YouTube composer (spec 132 G-YT) — a full-page composer inside the
 * destination frame's composer slot (PR-131-4), cloning the Facebook
 * composer's framework (PR-C1): RHF + zod on the form standard,
 * intents now/scheduled/queue through the unified destination enqueue
 * (the PR 759 enqueue client), media from the shared media area,
 * preview parity.
 *
 * Fields are exactly spec 125's shipped options schema: title,
 * description (the enqueue `caption`), privacy, made-for-kids, tags,
 * category. There is NO thumbnail control — the schema has no
 * thumbnail field (the gap is recorded in spec 125/G-YT.1; not patched
 * here) — and NO draft state (OD132-2). Made-for-kids starts unchosen
 * and blocks submit until explicitly picked (spec.md §4.3 gate).
 * YouTube's D5 windows are `{}` (no provider window resolved), so the
 * composer shows no usage indicator — only real destination state
 * (OD132-3 (a)).
 */

export interface YouTubeComposerProps {
  subdomain: string;
  destination: DestinationDetail;
}

export function YouTubeComposer({
  subdomain,
  destination,
}: Readonly<YouTubeComposerProps>) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ComposerMediaItem[]>([]);
  const [isDescriptionTouched, setIsDescriptionTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const form = useForm<YouTubeComposerFormValues>({
    resolver: zodResolver(youtubeComposerFormSchema),
    mode: 'onTouched',
    defaultValues: YOUTUBE_COMPOSER_DEFAULT_VALUES,
  });
  const values = form.watch();
  const {
    intent,
    title,
    description,
    privacy,
    madeForKids,
    tagsText,
    scheduleValue,
  } = values;
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
    () => getNextSlotForKind(slots, 'video', timezone),
    [slots, timezone],
  );

  const scheduleDate = useMemo(
    () => parseScheduleValue(scheduleValue, timezone),
    [scheduleValue, timezone],
  );
  const isScheduleInFuture = Boolean(
    scheduleDate && scheduleDate.getTime() > Date.now(),
  );

  // Mirror of the Facebook composer: with no posting times the queue
  // intent cannot stand — fall back to Post now once slots are known.
  React.useEffect(() => {
    if (slotsReady && activeSlots.length === 0 && intent === 'queue') {
      form.setValue('intent', 'now');
    }
  }, [slotsReady, activeSlots.length, intent, form]);

  const handleItemsChange = (next: ComposerMediaItem[]) => {
    setItems(next);
    // Library captions carry into the description only when the user
    // hasn't written their own yet — filename-derived pseudo-captions
    // never pre-fill (the Facebook composer's rule).
    if (!isDescriptionTouched) {
      const withCaption = next.find((item) => hasRealCaption(item));
      form.setValue('description', withCaption?.captionText?.trim() ?? '');
    }
  };

  const handleIntentChange = (next: YouTubeComposerFormValues['intent']) => {
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
  const validationError = computeYouTubeValidationError({
    hasVideo: items.length > 0,
    hasMediaTypeError: items.some(
      (item) => getMediaItemError(item, 'video') !== null,
    ),
    title,
    description,
    privacy,
    madeForKids,
    tagsText,
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
  if (fieldErrors.title?.message) {
    summaryEntries.push({
      fieldId: 'youtube-composer-title-field',
      message: fieldErrors.title.message,
    });
  }
  if (fieldErrors.description?.message) {
    summaryEntries.push({
      fieldId: 'youtube-composer-description-field',
      message: fieldErrors.description.message,
    });
  }
  if (fieldErrors.privacy?.message) {
    summaryEntries.push({
      fieldId: 'youtube-composer-privacy-field',
      message: fieldErrors.privacy.message,
    });
  }
  if (fieldErrors.madeForKids?.message) {
    summaryEntries.push({
      fieldId: 'youtube-composer-made-for-kids',
      message: fieldErrors.madeForKids.message,
    });
  }
  if (fieldErrors.tagsText?.message) {
    summaryEntries.push({
      fieldId: 'youtube-composer-tags-field',
      message: fieldErrors.tagsText.message,
    });
  }
  if (serverError) {
    summaryEntries.push({ message: serverError });
  } else if (submitAttempted && validationError && summaryEntries.length === 0) {
    summaryEntries.push({ message: validationError });
  }

  const resetComposer = () => {
    form.reset(YOUTUBE_COMPOSER_DEFAULT_VALUES);
    setItems([]);
    setIsDescriptionTouched(false);
    setServerError(null);
    setSubmitAttempted(false);
  };

  const handleValidSubmit = async (submitted: YouTubeComposerFormValues) => {
    setSubmitAttempted(true);
    setServerError(null);
    setSuccessMessage(null);
    const built = buildYouTubeEnqueueRequest({
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
        title="This channel needs attention before you can post"
        description="The connection to this YouTube channel is not active right now. Reconnect it from Accounts, then come back to write your post."
        action={
          <Button asChild variant="outline">
            <Link href={`/tenant/${subdomain}/accounts`}>Go to Accounts</Link>
          </Button>
        }
      />
    );
  }

  const previewText = [title.trim(), description.trim()]
    .filter(Boolean)
    .join('\n\n');

  return (
    <Form {...form}>
      <form
        data-testid="youtube-composer"
        data-platform="youtube"
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(handleValidSubmit, () =>
          setSubmitAttempted(true),
        )}
        noValidate
      >
        <FormErrorSummary errors={summaryEntries} />
        {successMessage && (
          <Banner
            data-testid="youtube-composer-success"
            variant="success"
            title={successMessage}
            onDismiss={() => setSuccessMessage(null)}
          />
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <ComposerMediaArea
            subdomain={subdomain}
            format="video"
            items={items}
            onItemsChange={handleItemsChange}
          />

          <YouTubeTitleField
            control={form.control}
            error={fieldErrors.title?.message}
          />

          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <PlatformCaptionField
                idStem="youtube-composer-description"
                label="Description"
                value={field.value}
                onChange={(next) => {
                  setIsDescriptionTouched(true);
                  field.onChange(next);
                }}
                onBlur={field.onBlur}
                placeholder="Tell viewers about your video…"
                error={fieldErrors.description?.message}
                limit={YOUTUBE_DESCRIPTION_MAX_BYTES}
                countMode="bytes"
                limitLabel={`${YOUTUBE_DESCRIPTION_MAX_BYTES.toLocaleString('en-US')} bytes`}
                rows={5}
              />
            )}
          />

          <YouTubePrivacyField
            control={form.control}
            error={fieldErrors.privacy?.message}
          />

          <YouTubeMadeForKidsField
            control={form.control}
            error={fieldErrors.madeForKids?.message}
          />

          <YouTubeTagsField
            control={form.control}
            error={fieldErrors.tagsText?.message}
          />

          <YouTubeCategoryField control={form.control} />

          <DestinationIntentSection
            platformLabel="YouTube"
            intent={intent}
            onIntentChange={handleIntentChange}
            slotsReady={slotsReady}
            slotsError={slotsQuery.isError}
            hasActiveSlots={activeSlots.length > 0}
            coveringKindLabel="Videos"
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
          format="video"
          pageName={destination.name}
          mediaItems={items}
          caption={previewText}
          link=""
        />

        <DestinationSubmitSection
          error={null}
          intent={intent}
          platformLabel="YouTube"
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
