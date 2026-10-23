'use client';

import React, { useState } from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import { api, buildTenantApiPath } from '@/lib/api';
import { PageQueueSlotSchema } from '@/lib/api/schemas/queue';
import type { PageSlotSummary } from '../tab-dashboard';
import { Button } from '@/components/shared/ui/button';
import { Input } from '@/components/shared/ui/input';
import { cn } from '@/lib/utils';

const FORMAT_OPTIONS: Array<{ id: PostFormat; label: string }> = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Photo' },
  { id: 'video', label: 'Video' },
  { id: 'reel', label: 'Reel' },
  { id: 'story', label: 'Story' },
];

export interface PostingTimeQuickAddProps {
  pageId: string;
  subdomain: string;
  onAdded: (slot: PageSlotSummary) => void;
}

/**
 * Inline quick-add for posting times — used by the composer queue intent and
 * reused by specs 104/105. Adds a slot in place (no navigation to Settings);
 * the new time also appears in Settings since it shares the same store.
 * The create goes through the typed API client (spec 137 §3.1); a failure
 * surfaces inline — never silently.
 */
export function PostingTimeQuickAdd({ pageId, subdomain, onAdded }: Readonly<PostingTimeQuickAddProps>) {
  const [timeInput, setTimeInput] = useState('09:00');
  const [selectedFormats, setSelectedFormats] = useState<PostFormat[]>(['text', 'image', 'video', 'reel', 'story']);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFormat = (format: PostFormat) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const handleAdd = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeInput)) {
      setError('Enter a valid time.');
      return;
    }
    if (selectedFormats.length === 0) {
      setError('Choose at least one format this time covers.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const slot = await api.post(
        buildTenantApiPath(subdomain, `/pages/${pageId}/slots`),
        { slotTime: timeInput, allowedFormats: selectedFormats },
        { schema: PageQueueSlotSchema }
      );
      onAdded({
        id: slot.id,
        slotTime: slot.slotTime,
        timezone: slot.timezone,
        isActive: slot.isActive,
        allowedFormats: slot.allowedFormats,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this posting time. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-testid="posting-time-quick-add" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quick-add-time-input" className="text-body font-medium text-ink">
            Time
          </label>
          <Input
            id="quick-add-time-input"
            data-testid="quick-add-time-input"
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-36"
          />
        </div>
        <Button
          data-testid="quick-add-submit-btn"
          loading={isSaving}
          onClick={() => void handleAdd()}
        >
          {isSaving ? 'Adding…' : 'Add'}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-body font-medium text-ink">Covers</span>
        <div className="flex flex-wrap gap-1.5">
          {FORMAT_OPTIONS.map((option) => {
            const isSelected = selectedFormats.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`quick-add-format-${option.id}`}
                aria-pressed={isSelected}
                onClick={() => toggleFormat(option.id)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-sm border px-3 text-body outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold',
                  isSelected
                    ? 'border-line bg-subtle font-semibold text-ink'
                    : 'border-line font-medium text-ink-sub'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <span data-testid="quick-add-error" role="alert" className="text-metadata font-medium text-brand-rose">
          {error}
        </span>
      )}
    </div>
  );
}
