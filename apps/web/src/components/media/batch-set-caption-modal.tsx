'use client';

import React, { useState } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';
import type { BatchCaptionMode } from './media-types';

export interface BatchSetCaptionModalProps {
  isOpen: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (captionText: string, mode: BatchCaptionMode) => Promise<void>;
}

export function BatchSetCaptionModal({
  isOpen,
  selectedCount,
  onClose,
  onApply,
}: Readonly<BatchSetCaptionModalProps>) {
  const [mode, setMode] = useState<BatchCaptionMode>('replace');
  const [captionText, setCaptionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const trimmedText = captionText.trim();
  const canSubmit = trimmedText.length > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onApply(trimmedText, mode);
      setCaptionText('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-caption-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9500,
        padding: SPACING.md,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
          borderRadius: RADII.md,
          padding: SPACING.xl,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2
            id="batch-caption-title"
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Set caption
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Applies to {selectedCount} file{selectedCount === 1 ? '' : 's'}.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {/* Modes: Replace vs Append */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                fontSize: '0.8125rem',
                color: `var(--text-main, ${THEME.default.text.primary})`,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="captionMode"
                value="replace"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                style={{ accentColor: PALETTE.primary, cursor: 'pointer' }}
              />
              Replace existing captions
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                fontSize: '0.8125rem',
                color: `var(--text-main, ${THEME.default.text.primary})`,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="captionMode"
                value="append"
                checked={mode === 'append'}
                onChange={() => setMode('append')}
                style={{ accentColor: PALETTE.primary, cursor: 'pointer' }}
              />
              Add to the end of existing captions
            </label>
          </div>

          {/* Caption Textarea + Character Counter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <textarea
              data-testid="batch-caption-textarea"
              rows={4}
              value={captionText}
              onChange={(e) => setCaptionText(e.target.value)}
              placeholder="Enter caption text..."
              style={{
                width: '100%',
                padding: SPACING.sm,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: '1px solid var(--border-strong, rgba(255,255,255,0.15))',
                borderRadius: RADII.xs,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                lineHeight: 1.45,
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                fontVariantNumeric: TYPOGRAPHY.tabularNums,
              }}
            >
              {captionText.length} / 2,200
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: SPACING.sm,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: `${SPACING.xs} ${SPACING.md}`,
                backgroundColor: 'transparent',
                border: 'none',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                fontSize: '0.8125rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="apply-batch-caption"
              disabled={!canSubmit}
              style={{
                padding: `${SPACING.xs} ${SPACING.lg}`,
                backgroundColor: canSubmit ? PALETTE.primary : 'rgba(250, 215, 52, 0.3)',
                color: '#000000',
                border: 'none',
                borderRadius: RADII.xs,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {isSubmitting
                ? 'Applying...'
                : `Apply to ${selectedCount} file${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
