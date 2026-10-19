'use client';

import React, { useState } from 'react';
import { type PostFormat } from '@fbuploadpro/contracts';
import type { PageSlotSummary } from '../tab-dashboard';
import {
  composerLabelStyle,
  composerErrorStyle,
  composerFieldStyle,
  composerInputStyle,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
  THEME,
} from './composer-styles';

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
      const res = await fetch(`/api/tenant/${subdomain}/pages/${pageId}/slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotTime: timeInput, allowedFormats: selectedFormats }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || "Couldn't add this posting time. Please try again.");
      }
      const slot: PageSlotSummary = {
        id: String(data.id),
        slotTime: String(data.slotTime ?? timeInput),
        timezone: String(data.timezone ?? 'UTC'),
        isActive: data.isActive !== false,
        allowedFormats: Array.isArray(data.allowedFormats) ? data.allowedFormats : selectedFormats,
      };
      onAdded(slot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this posting time. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-testid="posting-time-quick-add" style={{ ...composerFieldStyle, gap: SPACING.sm }}>
      <div style={{ display: 'flex', gap: SPACING.sm, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <label htmlFor="quick-add-time-input" style={composerLabelStyle}>
            Time
          </label>
          <input
            id="quick-add-time-input"
            data-testid="quick-add-time-input"
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            style={{ ...composerInputStyle(), width: '130px' }}
          />
        </div>
        <button
          type="button"
          data-testid="quick-add-submit-btn"
          disabled={isSaving}
          onClick={() => void handleAdd()}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            height: '38px',
            opacity: isSaving ? 0.7 : 1,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'Adding…' : 'Add'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
        <span style={composerLabelStyle}>Covers</span>
        <div style={{ display: 'flex', gap: SPACING.xs, flexWrap: 'wrap' }}>
          {FORMAT_OPTIONS.map((option) => {
            const isSelected = selectedFormats.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`quick-add-format-${option.id}`}
                aria-pressed={isSelected}
                onClick={() => toggleFormat(option.id)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.sm}`,
                  borderRadius: '4px',
                  fontSize: '0.8125rem',
                  fontWeight: isSelected ? TYPOGRAPHY.weights.semibold : TYPOGRAPHY.weights.medium,
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: isSelected ? `var(--bg-active, ${THEME.default.surfaces.active})` : 'transparent',
                  color: isSelected ? `var(--text-main)` : `var(--text-sub)`,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <span data-testid="quick-add-error" style={composerErrorStyle}>
          {error}
        </span>
      )}
    </div>
  );
}
