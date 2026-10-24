'use client';

import React from 'react';
import { Controller, type Control } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import type { TikTokPrivacy } from '@fbuploadpro/contracts';
import { ChoiceButtons } from './choice-buttons';
import {
  TIKTOK_PRIVACY_OPTIONS,
  type TikTokComposerFormValues,
  type TikTokToggleChoice,
} from './tiktok-composer-form';

/**
 * The TikTok composer's option fields (spec 132 G-TT) — split out of
 * `tiktok-composer.tsx` so each file stays reviewable. Every field is
 * a Controller over the shared form; the option sets come from the
 * contracts schema module (via the form module), never literals.
 *
 * The interaction toggles are explicit three-way choices —
 * TikTok's default / On / Off — because an omitted key (the provider
 * default) is a real, distinct state the user should see, not a
 * switch position pretending to be a choice.
 */

type FieldProps = {
  control: Control<TikTokComposerFormValues>;
  error?: string | undefined;
};

export function TikTokKindField({ control }: Readonly<FieldProps>) {
  return (
    <Controller
      control={control}
      name="kind"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-ink">
            What are you posting?
          </span>
          <ChoiceButtons
            label="Post type"
            testId="tiktok-composer-kind"
            options={[
              { value: 'video', label: 'Video', testId: 'tiktok-composer-kind-video' },
              { value: 'image', label: 'Photo', testId: 'tiktok-composer-kind-photo' },
            ]}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
          <span className="text-metadata text-ink-sub">
            A TikTok post is one video or one photo.
          </span>
        </div>
      )}
    />
  );
}

export function TikTokPrivacyField({ control, error }: Readonly<FieldProps>) {
  return (
    <Controller
      control={control}
      name="privacy"
      render={({ field }) => {
        const selected = TIKTOK_PRIVACY_OPTIONS.find(
          (option) => option.value === field.value,
        );
        return (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="tiktok-composer-privacy-field"
              className="text-body font-medium text-ink"
            >
              Who can see this post
            </label>
            <Select
              value={field.value}
              onValueChange={(next) => field.onChange(next as TikTokPrivacy)}
            >
              <SelectTrigger
                id="tiktok-composer-privacy-field"
                data-testid="tiktok-composer-privacy-field"
                className="w-full"
                aria-invalid={error ? true : undefined}
                onBlur={field.onBlur}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIKTOK_PRIVACY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
            ) : selected ? (
              <span className="text-metadata text-ink-sub">{selected.hint}</span>
            ) : null}
          </div>
        );
      }}
    />
  );
}

interface ToggleFieldProps extends FieldProps {
  name: 'allowComment' | 'allowDuet' | 'allowStitch' | 'isAiGenerated' | 'autoAddMusic';
  label: string;
  hint: string;
  testId: string;
}

function TikTokToggleField({
  control,
  name,
  label,
  hint,
  testId,
}: Readonly<ToggleFieldProps>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium text-ink">{label}</span>
          <ChoiceButtons<TikTokToggleChoice>
            label={label}
            testId={testId}
            options={[
              { value: 'default', label: 'Default', testId: `${testId}-default` },
              { value: 'on', label: 'On', testId: `${testId}-on` },
              { value: 'off', label: 'Off', testId: `${testId}-off` },
            ]}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
          />
          <span className="text-metadata text-ink-sub">{hint}</span>
        </div>
      )}
    />
  );
}

export function TikTokInteractionFields({ control }: Readonly<FieldProps>) {
  return (
    <>
      <TikTokToggleField
        control={control}
        name="allowComment"
        label="Comments"
        hint="Let other people comment on this post. Default uses TikTok's setting for the account."
        testId="tiktok-composer-allow-comment"
      />
      <TikTokToggleField
        control={control}
        name="allowDuet"
        label="Duets"
        hint="Let other people record a side-by-side duet with this post. Default uses TikTok's setting for the account."
        testId="tiktok-composer-allow-duet"
      />
      <TikTokToggleField
        control={control}
        name="allowStitch"
        label="Stitches"
        hint="Let other people use a clip from this post in their own post. Default uses TikTok's setting for the account."
        testId="tiktok-composer-allow-stitch"
      />
      <TikTokToggleField
        control={control}
        name="isAiGenerated"
        label="AI-generated content"
        hint="Tell viewers this post was made with AI. Default sends no AI label either way."
        testId="tiktok-composer-ai-generated"
      />
    </>
  );
}

export function TikTokAutoMusicField({ control }: Readonly<FieldProps>) {
  return (
    <TikTokToggleField
      control={control}
      name="autoAddMusic"
      label="Add music automatically"
      hint="Let TikTok choose music for this photo post. Default uses TikTok's setting for the account."
      testId="tiktok-composer-auto-music"
    />
  );
}
