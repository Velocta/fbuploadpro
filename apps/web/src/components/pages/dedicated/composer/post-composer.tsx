'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from '../modal-styles';
import type { PageSlotSummary } from '../tab-dashboard';
import { IntentSelector, type ComposerIntent } from './intent-selector';
import { FormatSelector } from './format-selector';
import {
  ComposerMediaArea,
  getMediaItemError,
  type ComposerMediaItem,
} from './composer-media-area';
import { ComposerCaption } from './composer-caption';
import { ComposerLink, isValidLink } from './composer-link';
import { ComposerPreview } from './composer-preview';
import { PostingTimeQuickAdd } from './posting-time-quick-add';
import { submitCreatePost, submitEditPost } from './composer-submit';
import {
  getNextSlotForFormat,
  getNextOccurrence,
  formatSlotLong,
  formatSlotShort,
  toDateTimeLocalValue,
  parseDateTimeLocalValue,
  hasRealCaption,
} from './queue-slot-utils';
import {
  composerLabelStyle,
  composerHintStyle,
  composerErrorStyle,
  composerFieldStyle,
  composerInputStyle,
  SPACING,
  COMPONENT_STYLES,
  TYPOGRAPHY,
} from './composer-styles';

/** Subset of a queue item needed to pre-fill the composer for editing. */
export interface ComposerInitialPost {
  id: string;
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

const FORMAT_LABELS: Record<PostFormat, string> = {
  text: 'Text',
  image: 'Photo',
  video: 'Video',
  reel: 'Reel',
  story: 'Story',
};

const SINGLE_MEDIA_FORMATS: PostFormat[] = ['video', 'reel', 'story'];

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function roundUpToNextHour(from: Date): Date {
  const d = new Date(from.getTime());
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function timezoneForFormat(slots: PageSlotSummary[], format: PostFormat): string {
  return getNextSlotForFormat(slots, format)?.timezone ?? browserTimezone();
}

function resolveInitialIntent(
  slots: PageSlotSummary[],
  initialIntent: ComposerIntent | undefined,
  initialPost: ComposerInitialPost | undefined
): ComposerIntent {
  if (initialIntent) return initialIntent;
  if (initialPost) {
    // Best-effort intent guess: a future scheduled time reads as a custom
    // schedule, otherwise the queue. (105's edit flow can pass initialIntent.)
    const scheduled = new Date(initialPost.scheduledTime);
    if (!Number.isNaN(scheduled.getTime()) && scheduled.getTime() > Date.now()) return 'schedule';
    return 'queue';
  }
  return slots.some((s) => s.isActive) ? 'queue' : 'now';
}

function resolveInitialItems(initialPost: ComposerInitialPost | undefined): ComposerMediaItem[] {
  const media = initialPost?.media;
  if (!media) return [];
  return [
    {
      id: initialPost.mediaId ?? 'initial-media',
      name: media.name,
      mediaType: media.mediaType,
      url: media.url,
      thumbnailUrl: media.thumbnailUrl,
      durationSeconds: media.durationSeconds,
      width: media.width,
      height: media.height,
    },
  ];
}

function resolveInitialScheduleValue(
  initialPost: ComposerInitialPost | undefined,
  slots: PageSlotSummary[]
): string {
  if (initialPost) {
    const parsed = new Date(initialPost.scheduledTime);
    if (!Number.isNaN(parsed.getTime())) {
      return toDateTimeLocalValue(parsed, timezoneForFormat(slots, initialPost.postFormat ?? 'reel'));
    }
  }
  const format = initialPost?.postFormat ?? 'reel';
  const nextSlot = getNextSlotForFormat(slots, format);
  const fallback = nextSlot ? getNextOccurrence(nextSlot, new Date()) : null;
  const date = fallback ?? roundUpToNextHour(new Date());
  return toDateTimeLocalValue(date, nextSlot?.timezone ?? browserTimezone());
}

function getMediaCountError(items: ComposerMediaItem[], format: PostFormat): string | null {
  if (format === 'text' || items.length <= 1) return null;
  if (!SINGLE_MEDIA_FORMATS.includes(format)) return null;
  const noun = format === 'story' ? 'file' : 'video';
  return `Choose one ${noun} for this ${FORMAT_LABELS[format].toLowerCase()}.`;
}

interface ValidationContext {
  format: PostFormat;
  caption: string;
  hasItems: boolean;
  hasMediaTypeError: boolean;
  mediaCountError: string | null;
  linkValid: boolean;
  intent: ComposerIntent;
  isScheduleInFuture: boolean;
  hasActiveSlots: boolean;
  hasCoveringSlot: boolean;
}

/** Single place deciding whether submit is allowed and why not. */
function computeValidationError(ctx: ValidationContext): string | null {
  if (ctx.format === 'text' && !ctx.caption.trim()) return 'Write a caption for your text post.';
  if (ctx.format !== 'text' && !ctx.hasItems) return 'Choose media for this post.';
  if (ctx.hasMediaTypeError) return 'Remove or replace the flagged media to continue.';
  if (ctx.mediaCountError) return ctx.mediaCountError;
  if (!ctx.linkValid) return 'Fix the link before submitting.';
  if (ctx.intent === 'schedule' && !ctx.isScheduleInFuture) return 'Pick a time in the future.';
  if (ctx.intent === 'queue' && !ctx.hasActiveSlots) return 'Set posting times first.';
  if (ctx.intent === 'queue' && !ctx.hasCoveringSlot) {
    return `No posting time covers ${FORMAT_LABELS[ctx.format]}s yet.`;
  }
  return null;
}

function submitButtonLabel(isEdit: boolean, intent: ComposerIntent): string {
  if (isEdit) return 'Save changes';
  if (intent === 'now') return 'Post now';
  if (intent === 'schedule') return 'Schedule post';
  return 'Add to queue';
}

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

  const [slots, setSlots] = useState<PageSlotSummary[]>(slotsProp);
  const [intent, setIntent] = useState<ComposerIntent>(() =>
    resolveInitialIntent(slotsProp, initialIntent, initialPost)
  );
  const [format, setFormat] = useState<PostFormat>(initialPost?.postFormat ?? 'reel');
  const [items, setItems] = useState<ComposerMediaItem[]>(() => resolveInitialItems(initialPost));
  const [caption, setCaption] = useState(initialPost?.caption ?? '');
  const [isCaptionTouched, setIsCaptionTouched] = useState(Boolean(initialPost?.caption));
  const [link, setLink] = useState(initialPost?.linkUrl ?? '');
  const [pageName, setPageName] = useState('your Page');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Schedule intent: timezone comes from the default slot, else the browser.
  const scheduleTimezone = useMemo(
    () => timezoneForFormat(slots, format),
    [slots, format]
  );

  const [scheduleValue, setScheduleValue] = useState(() =>
    resolveInitialScheduleValue(initialPost, slotsProp)
  );

  useEffect(() => {
    let active = true;
    const loadPageName = async () => {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/pages/${pageId}`);
        if (!res.ok) return;
        const data = await res.json();
        const name = data?.page?.pageName ?? data?.pageName;
        if (active && typeof name === 'string' && name.trim()) setPageName(name.trim());
      } catch {
        // Non-blocking: toast copy falls back to "your Page".
      }
    };
    void loadPageName();
    return () => {
      active = false;
    };
  }, [subdomain, pageId]);

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

  // ---- Media / caption handling -------------------------------------------

  const handleItemsChange = (next: ComposerMediaItem[]) => {
    setItems(next);
    // Library captions carry through only when the user hasn't written their
    // own caption yet — filename-derived pseudo-captions never pre-fill.
    if (!isCaptionTouched) {
      const withCaption = next.find((item) => hasRealCaption(item));
      setCaption(withCaption?.captionText?.trim() ?? '');
    }
  };

  const handleCaptionChange = (value: string) => {
    setCaption(value);
    setIsCaptionTouched(true);
  };

  const handleSlotAdded = (slot: PageSlotSummary) => {
    setSlots((prev) => [...prev, slot]);
  };

  // ---- Validation -----------------------------------------------------------

  const hasMediaTypeError = items.some((item) => getMediaItemError(item, format) !== null);
  const validationError = computeValidationError({
    format,
    caption,
    hasItems: items.length > 0,
    hasMediaTypeError,
    mediaCountError: getMediaCountError(items, format),
    linkValid: isValidLink(link),
    intent,
    isScheduleInFuture,
    hasActiveSlots: activeSlots.length > 0,
    hasCoveringSlot: nextSlotForFormat !== null,
  });
  const isSubmitDisabled = isSubmitting || validationError !== null;

  // ---- Submit ---------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const message =
        isEdit && initialPost
          ? await submitEditPost({
              subdomain,
              itemId: initialPost.id,
              format,
              caption,
              link,
              intent,
              scheduleDate,
              wasFailed: initialPost.status === 'failed',
              pageName,
            })
          : await submitCreatePost({
              pageId,
              subdomain,
              format,
              items,
              caption,
              link,
              intent,
              scheduleDate,
              scheduleTimezone,
              nextSlotForFormat,
              nextSlotOccurrence,
              pageName,
            });
      onSubmitted(message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Intent block ----------------------------------------------------------

  const renderQueueBlock = () => {
    if (activeSlots.length === 0) {
      // Covered by the always-visible notice under the intent selector.
      return null;
    }
    if (!nextSlotForFormat || !nextSlotOccurrence) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
          <p data-testid="composer-no-covering-slot-notice" style={{ ...composerHintStyle, margin: 0 }}>
            No posting time covers {FORMAT_LABELS[format]}s yet.
          </p>
          <PostingTimeQuickAdd pageId={pageId} subdomain={subdomain} onAdded={handleSlotAdded} />
        </div>
      );
    }
    return (
      <p data-testid="composer-queue-goes-out" style={{ ...composerHintStyle, margin: 0 }}>
        Goes out at the next posting time for {FORMAT_LABELS[format]}s:{' '}
        {formatSlotShort(nextSlotOccurrence, nextSlotForFormat.timezone)}.
      </p>
    );
  };

  const renderScheduleBlock = () => (
    <div style={composerFieldStyle}>
      <label htmlFor="composer-schedule-picker" style={composerLabelStyle}>
        Date and time
      </label>
      <input
        id="composer-schedule-picker"
        data-testid="composer-schedule-picker"
        type="datetime-local"
        value={scheduleValue}
        min={toDateTimeLocalValue(new Date(), scheduleTimezone)}
        onChange={(e) => setScheduleValue(e.target.value)}
        style={composerInputStyle()}
      />
      <span style={composerHintStyle}>Times shown in {scheduleTimezone}.</span>
      {scheduleDate && isScheduleInFuture && (
        <span data-testid="composer-schedule-goes-out" style={composerHintStyle}>
          Goes out {formatSlotLong(scheduleDate, scheduleTimezone)}.
        </span>
      )}
    </div>
  );

  const renderIntentBlock = () => {
    if (intent === 'now') {
      return (
        <p data-testid="composer-intent-now-note" style={{ ...composerHintStyle, margin: 0 }}>
          This will publish to Facebook immediately.
        </p>
      );
    }
    if (intent === 'schedule') return renderScheduleBlock();
    return renderQueueBlock();
  };

  const title = isEdit ? 'Edit post' : format === 'text' ? 'Create text post' : 'Create post';
  const description = isEdit
    ? 'Update this post — it keeps its scheduled time unless you change it.'
    : format === 'text'
      ? 'Write a post — it publishes as text on your Page.'
      : 'Put together a post for your Page.';
  const submitLabel = submitButtonLabel(isEdit, intent);

  return (
    <div data-testid="post-composer-backdrop" style={MODAL_BACKDROP_STYLE}>
      <div
        data-testid="post-composer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ ...MODAL_CONTAINER_STYLE, maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACING.md }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: 'var(--text-main)',
              }}
            >
              {title}
            </h3>
            <p style={{ margin: `${SPACING.xs} 0 0 0`, fontSize: '0.8125rem', color: 'var(--text-sub)' }}>
              {description}
            </p>
          </div>
          <button
            type="button"
            data-testid="close-post-composer-btn"
            aria-label="Close composer"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-sub)', cursor: 'pointer', padding: SPACING.xs }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          {/* Intent */}
          <div style={composerFieldStyle}>
            <span style={composerLabelStyle}>How should this go out?</span>
            <IntentSelector value={intent} onChange={setIntent} queueDisabled={activeSlots.length === 0} />
            {activeSlots.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
                <p data-testid="composer-no-slots-notice" style={{ ...composerHintStyle, margin: 0 }}>
                  Set posting times first — your queued posts go out automatically at these times.
                </p>
                <PostingTimeQuickAdd pageId={pageId} subdomain={subdomain} onAdded={handleSlotAdded} />
              </div>
            )}
            {renderIntentBlock()}
          </div>

          {/* Format */}
          <div style={composerFieldStyle}>
            <span style={composerLabelStyle}>Format</span>
            <FormatSelector value={format} onChange={setFormat} />
            {format === 'reel' && (
              <span data-testid="composer-reel-hint" style={composerHintStyle}>
                Portrait works best for reels.
              </span>
            )}
          </div>

          {/* Media (hidden for text) */}
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

          {/* Caption */}
          <ComposerCaption
            value={caption}
            onChange={handleCaptionChange}
            required={format === 'text'}
          />

          {/* Link — text, photo, and video only */}
          <ComposerLink
            value={link}
            onChange={setLink}
            visible={format === 'text' || format === 'image' || format === 'video'}
          />

          {/* Preview */}
          <ComposerPreview
            pageName={pageName}
            format={format}
            caption={caption}
            link={link}
            mediaItems={items}
          />

          {/* Server error */}
          {error && (
            <p data-testid="post-composer-error" style={{ ...composerErrorStyle, margin: 0 }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
              <button
                type="button"
                data-testid="cancel-post-composer-btn"
                onClick={onClose}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  backgroundColor: 'transparent',
                  color: 'var(--text-sub)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="submit-post-composer-btn"
                disabled={isSubmitDisabled}
                style={{
                  ...COMPONENT_STYLES.primaryButton,
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                  opacity: isSubmitDisabled ? 0.7 : 1,
                }}
              >
                {isSubmitting ? 'Saving…' : submitLabel}
              </button>
            </div>
            {intent === 'now' && !isEdit && (
              <span style={composerHintStyle}>This will publish to Facebook immediately.</span>
            )}
            {intent === 'schedule' && scheduleDate && isScheduleInFuture && !isEdit && (
              <span style={composerHintStyle}>
                Goes out {formatSlotLong(scheduleDate, scheduleTimezone)}.
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
