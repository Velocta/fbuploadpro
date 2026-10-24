'use client';

/**
 * The X composer's poll builder (spec 132 §4.5) — 2–4 options of up
 * to 25 characters and a run length, exactly the contracts
 * `XPollOptionsSchema` shape. Poll XOR media is enforced visibly in
 * both directions: with media attached, "Add a poll" explains why it
 * is blocked instead of enabling (the media stays); with a poll on,
 * the media area blocks attaching (the poll stays).
 */
import React, { useState } from 'react';
import { X_POLL_OPTION_MAX_CHARACTERS } from '@fbuploadpro/contracts';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shared/ui/select';
import { X_MAX_POLL_OPTIONS, X_POLL_MEDIA_MESSAGE, xPollError } from './x-composer-validation';

export interface XPollBuilderProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  options: string[];
  onOptionsChange: (options: string[]) => void;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  mediaAttached: boolean;
}

const DURATION_PRESETS: Array<{ minutes: number; label: string }> = [
  { minutes: 60, label: '1 hour' },
  { minutes: 360, label: '6 hours' },
  { minutes: 720, label: '12 hours' },
  { minutes: 1440, label: '1 day' },
  { minutes: 4320, label: '3 days' },
  { minutes: 10080, label: '7 days' },
];

export function XPollBuilder({
  enabled,
  onEnabledChange,
  options,
  onOptionsChange,
  durationMinutes,
  onDurationChange,
  mediaAttached,
}: Readonly<XPollBuilderProps>) {
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const pollError = enabled ? xPollError(options) : null;

  const handleAddPoll = () => {
    if (mediaAttached) {
      setBlockedNotice(X_POLL_MEDIA_MESSAGE);
      return;
    }
    setBlockedNotice(null);
    onEnabledChange(true);
  };

  const handleRemovePoll = () => {
    onEnabledChange(false);
    onOptionsChange(['', '']);
    setBlockedNotice(null);
  };

  const handleOptionChange = (index: number, value: string) => {
    onOptionsChange(options.map((option, i) => (i === index ? value : option)));
  };

  if (!enabled) {
    return (
      <div data-testid="x-composer-poll" className="flex flex-col gap-1.5">
        <div>
          <Button variant="secondary" data-testid="x-composer-add-poll-btn" onClick={handleAddPoll}>
            Add a poll
          </Button>
        </div>
        {blockedNotice && (
          <p data-testid="x-composer-poll-blocked-notice" className="m-0 text-metadata text-ink-sub">
            {blockedNotice} Remove the media to add a poll.
          </p>
        )}
      </div>
    );
  }

  return (
    <div data-testid="x-composer-poll" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-body font-medium text-ink">Poll</span>
        <Button variant="ghost" data-testid="x-composer-remove-poll-btn" onClick={handleRemovePoll}>
          Remove poll
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className="flex flex-col gap-1">
            <label htmlFor={`x-poll-option-${index}`} className="text-metadata font-medium text-ink">
              Option {index + 1}
            </label>
            <div className="flex items-center gap-2">
              <Input
                id={`x-poll-option-${index}`}
                data-testid={`x-composer-poll-option-${index}`}
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`Option ${index + 1}`}
                className="min-h-11 flex-1"
              />
              <span className="shrink-0 text-metadata text-ink-sub">
                {option.length} / {X_POLL_OPTION_MAX_CHARACTERS}
              </span>
              {options.length > 2 && (
                <Button
                  variant="ghost"
                  data-testid={`x-composer-poll-remove-option-${index}`}
                  aria-label={`Remove option ${index + 1}`}
                  onClick={() => onOptionsChange(options.filter((_, i) => i !== index))}
                >
                  ×
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pollError && (
        <p data-testid="x-composer-poll-error" className="m-0 text-metadata font-medium text-brand-rose">
          {pollError}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {options.length < X_MAX_POLL_OPTIONS && (
          <Button
            variant="secondary"
            data-testid="x-composer-poll-add-option-btn"
            onClick={() => onOptionsChange([...options, ''])}
          >
            Add option
          </Button>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="x-poll-duration" className="text-metadata font-medium text-ink">
            Poll length
          </label>
          <Select
            value={String(durationMinutes)}
            onValueChange={(value) => onDurationChange(Number(value))}
          >
            <SelectTrigger id="x-poll-duration" data-testid="x-composer-poll-duration" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_PRESETS.map((preset) => (
                <SelectItem key={preset.minutes} value={String(preset.minutes)}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
