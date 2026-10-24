'use client';

import React from 'react';
import { Controller, type Control } from 'react-hook-form';
import {
  YOUTUBE_PRIVACY_STATUSES,
  YOUTUBE_TAGS_MAX_CHARS,
  YOUTUBE_TITLE_MAX_CHARS,
  youtubeTagsTotalChars,
  type YouTubePrivacyStatus,
} from '@fbuploadpro/contracts';
import { Input } from '@/components/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import { cn } from '@/lib/utils';
import { ChoiceButtons } from './choice-buttons';
import {
  parseYouTubeTags,
  YOUTUBE_CATEGORIES,
  type YouTubeComposerFormValues,
} from './youtube-composer-form';

/**
 * The YouTube composer's option fields (spec 132 G-YT) — split out of
 * `youtube-composer.tsx` so each file stays reviewable. Every field is
 * a Controller over the shared form; the option sets and limits come
 * from the contracts schema module, never from literals here.
 */

type FieldProps = {
  control: Control<YouTubeComposerFormValues>;
  error?: string | undefined;
};

const PRIVACY_LABELS: Record<YouTubePrivacyStatus, string> = {
  public: 'Public',
  private: 'Private',
  unlisted: 'Unlisted',
};

const PRIVACY_HINTS: Record<YouTubePrivacyStatus, string> = {
  public: 'Anyone can find and watch this video.',
  private: 'Only you can watch this video.',
  unlisted:
    'Anyone with the link can watch this video — it will not appear in search.',
};

export function YouTubeTitleField({ control, error }: Readonly<FieldProps>) {
  return (
    <Controller
      control={control}
      name="title"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="youtube-composer-title-field"
            className="text-body font-medium text-ink"
          >
            Title (required)
          </label>
          <Input
            id="youtube-composer-title-field"
            data-testid="youtube-composer-title-field"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            placeholder="Give your video a title"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'youtube-composer-title-error' : undefined}
          />
          {error ? (
            <p
              id="youtube-composer-title-error"
              role="alert"
              className="text-metadata font-medium text-brand-rose"
            >
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <span
              data-testid="youtube-composer-title-count"
              className={cn(
                'text-metadata tabular-nums',
                [...field.value].length > YOUTUBE_TITLE_MAX_CHARS
                  ? 'text-brand-rose'
                  : 'text-ink-sub',
              )}
            >
              {[...field.value].length.toLocaleString('en-US')} /{' '}
              {YOUTUBE_TITLE_MAX_CHARS.toLocaleString('en-US')} characters
            </span>
          </div>
        </div>
      )}
    />
  );
}

export function YouTubePrivacyField({ control, error }: Readonly<FieldProps>) {
  return (
    <Controller
      control={control}
      name="privacy"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="youtube-composer-privacy-field"
            className="text-body font-medium text-ink"
          >
            Who can see this video (required)
          </label>
          <Select
            value={field.value}
            onValueChange={(next) =>
              field.onChange(next as YouTubePrivacyStatus)
            }
          >
            <SelectTrigger
              id="youtube-composer-privacy-field"
              data-testid="youtube-composer-privacy-field"
              aria-invalid={error ? true : undefined}
              onBlur={field.onBlur}
            >
              <SelectValue placeholder="Choose who can see this video" />
            </SelectTrigger>
            <SelectContent>
              {YOUTUBE_PRIVACY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {PRIVACY_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? (
            <p
              role="alert"
              className="text-metadata font-medium text-brand-rose"
            >
              {error}
            </p>
          ) : field.value ? (
            <span className="text-metadata text-ink-sub">
              {PRIVACY_HINTS[field.value]}
            </span>
          ) : null}
        </div>
      )}
    />
  );
}

export function YouTubeMadeForKidsField({
  control,
  error,
}: Readonly<FieldProps>) {
  return (
    <Controller
      control={control}
      name="madeForKids"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-ink">
            Is this video made for kids? (required)
          </span>
          <ChoiceButtons
            label="Made for kids"
            testId="youtube-composer-made-for-kids"
            options={[
              {
                value: 'yes',
                label: 'Made for kids',
                testId: 'youtube-composer-mfk-yes',
              },
              {
                value: 'no',
                label: 'Not made for kids',
                testId: 'youtube-composer-mfk-no',
              },
            ]}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
          {error ? (
            <p
              role="alert"
              className="text-metadata font-medium text-brand-rose"
            >
              {error}
            </p>
          ) : (
            <span className="text-metadata text-ink-sub">
              YouTube asks this for every upload. There is no default — pick
              the one that fits this video.
            </span>
          )}
        </div>
      )}
    />
  );
}

export function YouTubeTagsField({ control, error }: Readonly<FieldProps>) {
  return (
    <Controller
      control={control}
      name="tagsText"
      render={({ field }) => {
        const tagsTotal = youtubeTagsTotalChars(parseYouTubeTags(field.value));
        return (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="youtube-composer-tags-field"
              className="text-body font-medium text-ink"
            >
              Tags
            </label>
            <Input
              id="youtube-composer-tags-field"
              data-testid="youtube-composer-tags-field"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="e.g. cooking, morning routine"
              aria-invalid={error ? true : undefined}
            />
            {error ? (
              <p
                role="alert"
                className="text-metadata font-medium text-brand-rose"
              >
                {error}
              </p>
            ) : (
              <span className="text-metadata text-ink-sub">
                Separate tags with commas — they help people find your video.
              </span>
            )}
            <div className="flex justify-end">
              <span
                data-testid="youtube-composer-tags-count"
                className={cn(
                  'text-metadata tabular-nums',
                  tagsTotal > YOUTUBE_TAGS_MAX_CHARS
                    ? 'text-brand-rose'
                    : 'text-ink-sub',
                )}
              >
                {tagsTotal.toLocaleString('en-US')} /{' '}
                {YOUTUBE_TAGS_MAX_CHARS.toLocaleString('en-US')} characters
                total
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}

export function YouTubeCategoryField({ control }: Readonly<{ control: Control<YouTubeComposerFormValues> }>) {
  return (
    <Controller
      control={control}
      name="categoryId"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="youtube-composer-category-field"
            className="text-body font-medium text-ink"
          >
            Category
          </label>
          <Select
            value={field.value || 'none'}
            onValueChange={(next) =>
              field.onChange(next === 'none' ? '' : next)
            }
          >
            <SelectTrigger
              id="youtube-composer-category-field"
              data-testid="youtube-composer-category-field"
              onBlur={field.onBlur}
            >
              <SelectValue placeholder="No category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {YOUTUBE_CATEGORIES.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  );
}
