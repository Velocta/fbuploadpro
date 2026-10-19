'use client';

import React, { useState } from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  STATUS_SIGNALS,
  TYPOGRAPHY,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import { ScheduleTimezoneModal } from './schedule-timezone-modal';
import type { FacebookPageItem } from '../page-card';
import type { PageSlotSummary } from './tab-dashboard';

export interface PageTabPostingTimesProps {
  page: FacebookPageItem;
  slots: PageSlotSummary[];
  isLoading?: boolean;
  pendingQueueCount?: number;
  onAddSlot: (data: {
    slotTime: string;
    timezone: string;
    allowedFormats?: string[];
  }) => Promise<void>;
  onUpdateSlot?: (
    slotId: string,
    data: {
      slotTime?: string;
      timezone?: string;
      isActive?: boolean;
      allowedFormats?: string[];
    }
  ) => Promise<void>;
  onUpdateTimezone?: (newTimezone: string) => Promise<void>;
  onToggleSlot: (slotId: string, isActive: boolean) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
}

export const ALL_POST_FORMATS: Array<{ id: string; label: string }> = [
  { id: 'reel', label: 'Reels' },
  { id: 'image', label: 'Photos' },
  { id: 'video', label: 'Videos' },
  { id: 'story', label: 'Stories' },
  { id: 'text', label: 'Text Updates' },
];

export interface FormattedSlotTime {
  time12: string;
  ampm: string;
  time24: string;
}

export function formatSlotDisplay(slotTime: string): FormattedSlotTime {
  const parts = slotTime.split(':');
  const rawHour = Number.parseInt(parts[0] || '9', 10);
  const rawMinute = Number.parseInt(parts[1] || '0', 10);

  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12;
  const ampm = rawHour >= 12 ? 'PM' : 'AM';
  const paddedMinute = rawMinute < 10 ? `0${rawMinute}` : `${rawMinute}`;
  const paddedHour12 = hour12 < 10 ? `0${hour12}` : `${hour12}`;
  const paddedHour24 = rawHour < 10 ? `0${rawHour}` : `${rawHour}`;

  return {
    time12: `${paddedHour12}:${paddedMinute}`,
    ampm,
    time24: `${paddedHour24}:${paddedMinute}`,
  };
}

function resolveFormatLabel(formatId: string): string {
  const match = ALL_POST_FORMATS.find((f) => f.id === formatId);
  return match ? match.label : formatId.toUpperCase();
}

interface HeaderProps {
  activeTimezone: string;
  onOpenAddModal: () => void;
  onOpenTimezoneModal: () => void;
}

function PostingTimesHeader({
  activeTimezone,
  onOpenAddModal,
  onOpenTimezoneModal,
}: Readonly<HeaderProps>) {
  return (
    <div
      data-testid="posting-times-header"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: SPACING.md,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            letterSpacing: TYPOGRAPHY.tracking.h2,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Posting Times
        </h2>
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Daily posting windows and the post types that can go out in each.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
        <button
          type="button"
          data-testid="schedule-timezone-trigger"
          onClick={onOpenTimezoneModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: `0 ${SPACING.sm}`,
            height: '34px',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
            fontSize: '0.75rem',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: STATUS_SIGNALS.operational.dot,
              boxShadow: STATUS_SIGNALS.operational.halo,
            }}
          />
          <span style={{ color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Timezone:
          </span>
          <span style={{ fontWeight: TYPOGRAPHY.weights.semibold }}>
            {activeTimezone}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              color: PALETTE.primary,
              textDecoration: 'underline',
              marginLeft: '2px',
            }}
          >
            Change
          </span>
        </button>

        <button
          type="button"
          data-testid="add-slot-button"
          onClick={onOpenAddModal}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            height: '34px',
            padding: `0 ${SPACING.md}`,
            color: PALETTE.background,
            border: `1px solid ${PALETTE.primary}`,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
            transition: 'transform 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Posting Time</span>
        </button>
      </div>
    </div>
  );
}

export interface PostingTimeRowProps {
  slot: PageSlotSummary;
  isToggling: boolean;
  onToggle: (slot: PageSlotSummary) => void;
  onEdit: (slot: PageSlotSummary) => void;
  onRemove: (slot: PageSlotSummary) => void;
}

export function PostingTimeRow({ slot, isToggling, onToggle, onEdit, onRemove }: Readonly<PostingTimeRowProps>) {
  const formatted = formatSlotDisplay(slot.slotTime);
  const statusColor = slot.isActive ? PALETTE.accent4 : `var(--text-dim, ${THEME.default.text.muted})`;
  const formats = slot.allowedFormats && slot.allowedFormats.length > 0
    ? slot.allowedFormats
    : ['reel', 'image', 'video', 'story', 'text'];
  const isAllFormats = formats.length >= 5;

  return (
    <div
      data-testid={`posting-time-row-${slot.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `${SPACING.md} ${SPACING.lg}`,
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.sm,
        gap: SPACING.md,
        transition: 'border-color 0.15s ease',
        flexWrap: 'wrap',
      }}
    >
      {/* Left: Status dot + Tabular Time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md, minWidth: '180px' }}>
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            boxShadow: slot.isActive ? `0 0 6px ${PALETTE.accent4}` : 'none',
            flexShrink: 0,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              color: slot.isActive
                ? `var(--text-main, ${THEME.default.text.primary})`
                : `var(--text-dim, ${THEME.default.text.muted})`,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}
          >
            {formatted.time12}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: slot.isActive
                ? `var(--text-sub, ${THEME.default.text.secondary})`
                : `var(--text-dim, ${THEME.default.text.muted})`,
            }}
          >
            {formatted.ampm}
          </span>
        </div>
      </div>

      {/* Center: Permitted Content Formats Selection Display */}
      <div
        data-testid={`slot-format-container-${slot.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: '1 1 280px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            marginRight: '2px',
          }}
        >
          Post types:
        </span>
        {isAllFormats ? (
          <span
            data-testid={`slot-format-badge-all-${slot.id}`}
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            All post types
          </span>
        ) : (
          formats.map((fmt, index) => (
            <React.Fragment key={fmt}>
              {index > 0 && (
                <span
                  aria-hidden="true"
                  style={{ color: `var(--text-dim, ${THEME.default.text.muted})` }}
                >
                  ·
                </span>
              )}
              <span
                data-testid={`slot-format-badge-${slot.id}-${fmt}`}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                {resolveFormatLabel(fmt)}
              </span>
            </React.Fragment>
          ))
        )}
      </div>

      {/* Right Controls: Edit Formats, Tactile Switch, Remove Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
        <button
          type="button"
          data-testid={`edit-slot-btn-${slot.id}`}
          onClick={() => onEdit(slot)}
          style={{
            background: 'none',
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: 'pointer',
            padding: `3px ${SPACING.sm}`,
            borderRadius: RADII.xs,
            transition: 'color 0.12s ease, border-color 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
            e.currentTarget.style.borderColor = `var(--border-strong, ${THEME.default.borders.strong})`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
            e.currentTarget.style.borderColor = `var(--border-subtle, ${THEME.default.borders.hairline})`;
          }}
        >
          Edit
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={slot.isActive}
          aria-label={slot.isActive ? 'Pause posting time' : 'Activate posting time'}
          data-testid={`toggle-slot-btn-${slot.id}`}
          disabled={isToggling}
          onClick={() => onToggle(slot)}
          style={{
            width: '36px',
            height: '20px',
            borderRadius: RADII.full,
            backgroundColor: slot.isActive
              ? PALETTE.primary
              : `var(--bg-active, ${THEME.default.surfaces.active})`,
            border: `1px solid ${
              slot.isActive
                ? PALETTE.primary
                : `var(--border-subtle, ${THEME.default.borders.hairline})`
            }`,
            position: 'relative',
            cursor: isToggling ? 'not-allowed' : 'pointer',
            padding: 0,
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: slot.isActive ? '18px' : '2px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: slot.isActive
                ? PALETTE.background
                : `var(--text-sub, ${THEME.default.text.secondary})`,
              transition: 'left 0.15s ease, background-color 0.15s ease',
            }}
          />
        </button>

        <button
          type="button"
          data-testid={`delete-slot-btn-${slot.id}`}
          onClick={() => onRemove(slot)}
          style={{
            background: 'none',
            border: 'none',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            cursor: 'pointer',
            padding: `${SPACING.xs} ${SPACING.xs}`,
            borderRadius: RADII.xs,
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = PALETTE.accent3;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = `var(--text-dim, ${THEME.default.text.muted})`;
          }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onOpenAddModal: () => void;
}

function PostingTimesEmptyState({ onOpenAddModal }: Readonly<EmptyStateProps>) {
  return (
    <div
      data-testid="calendar-empty-state"
      style={{
        padding: SPACING.xxl,
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px dashed var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: SPACING.md,
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: RADII.full,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: PALETTE.primary,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>

      <div style={{ maxWidth: '440px' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          No daily posting times set yet
        </h4>
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.5,
          }}
        >
          Set up your daily posting times and choose which post types go out in each. Posts added to your queue go out automatically at these times.
        </p>
      </div>

      <button
        type="button"
        data-testid="empty-add-slot-button"
        onClick={onOpenAddModal}
        style={{
          ...COMPONENT_STYLES.primaryButton,
          height: '34px',
          padding: `0 ${SPACING.lg}`,
          color: PALETTE.background,
          border: `1px solid ${PALETTE.primary}`,
          fontSize: '0.8125rem',
          fontWeight: TYPOGRAPHY.weights.semibold,
        }}
      >
        Add First Posting Time
      </button>
    </div>
  );
}

interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTimezone: string;
  slotToEdit?: PageSlotSummary | null;
  onSave: (data: {
    slotTime: string;
    timezone: string;
    allowedFormats: string[];
  }) => Promise<void>;
}

function AddEditPostingTimeModal({
  isOpen,
  onClose,
  activeTimezone,
  slotToEdit,
  onSave,
}: Readonly<AddEditModalProps>) {
  const [timeInput, setTimeInput] = useState(() => slotToEdit?.slotTime.slice(0, 5) || '09:00');
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() => {
    if (slotToEdit?.allowedFormats && slotToEdit.allowedFormats.length > 0) {
      return slotToEdit.allowedFormats;
    }
    return ['reel', 'image', 'video', 'story', 'text'];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isEditing = Boolean(slotToEdit);

  const toggleFormat = (formatId: string) => {
    setSelectedFormats((prev) => {
      if (prev.includes(formatId)) {
        if (prev.length === 1) {
          setError('Choose at least one post type.');
          return prev;
        }
        setError(null);
        return prev.filter((f) => f !== formatId);
      }
      setError(null);
      return [...prev, formatId];
    });
  };

  const handleSelectAll = () => {
    setError(null);
    setSelectedFormats(['reel', 'image', 'video', 'story', 'text']);
  };

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(timeInput)) {
      setError('Enter a valid time (for example, 09:00 or 17:30).');
      return;
    }

    if (selectedFormats.length === 0) {
      setError('Choose at least one post type.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        slotTime: timeInput,
        timezone: activeTimezone,
        allowedFormats: selectedFormats,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't save this posting time. Please try again.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitleText = isEditing ? 'Edit Posting Time' : 'Add Daily Posting Time';
  const preview = formatSlotDisplay(/^\d{2}:\d{2}$/.test(timeInput) ? timeInput : '09:00');
  let submitButtonText = 'Save Posting Time';
  if (isSubmitting) {
    submitButtonText = 'Saving...';
  } else if (isEditing) {
    submitButtonText = 'Update Posting Time';
  }

  return (
    <div style={MODAL_BACKDROP_STYLE}>
      <div
        data-testid="add-posting-time-modal"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '480px',
          padding: SPACING.xl,
        }}
      >
        <div style={{ marginBottom: SPACING.lg }}>
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {modalTitleText}
          </h3>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Set the time and choose which post types go out at this time.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {error && (
            <div
              style={{
                padding: `${SPACING.xs} ${SPACING.sm}`,
                backgroundColor: 'rgba(246, 70, 93, 0.1)',
                border: `1px solid ${PALETTE.accent3}`,
                borderRadius: RADII.xs,
                color: PALETTE.accent3,
                fontSize: '0.8125rem',
              }}
            >
              {error}
            </div>
          )}

          {/* Time Input */}
          <div>
            <label
              htmlFor="posting-time-input"
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                marginBottom: '6px',
              }}
            >
              Time of day
            </label>
            <input
              id="posting-time-input"
              data-testid="posting-time-input"
              type="time"
              required
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                padding: `0 ${SPACING.sm}`,
                backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.75rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Posts at {preview.time12} {preview.ampm}.
            </p>
          </div>

          {/* Schedule Timezone Note */}
          <div
            data-testid="modal-schedule-timezone-note"
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Active schedule timezone:</span>
            <span
              style={{
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {activeTimezone}
            </span>
          </div>

          {/* Permitted Content Formats Multi-Select */}
          <fieldset
            style={{
              border: 'none',
              margin: 0,
              padding: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <legend
                style={{
                  fontSize: '0.75rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  padding: 0,
                  margin: 0,
                }}
              >
                Post types
              </legend>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: PALETTE.primary,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Select All
              </button>
            </div>

            <div
              data-testid="modal-format-selection-group"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: SPACING.xs,
              }}
            >
              {ALL_POST_FORMATS.map((format) => {
                const isSelected = selectedFormats.includes(format.id);
                return (
                  <button
                    key={format.id}
                    type="button"
                    data-testid={`modal-format-toggle-${format.id}`}
                    onClick={() => toggleFormat(format.id)}
                    style={{
                      padding: `6px ${SPACING.md}`,
                      borderRadius: RADII.sm,
                      fontSize: '0.8125rem',
                      fontWeight: TYPOGRAPHY.weights.medium,
                      backgroundColor: isSelected
                        ? 'rgba(250, 215, 52, 0.12)'
                        : `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
                      color: isSelected
                        ? PALETTE.primary
                        : `var(--text-sub, ${THEME.default.text.secondary})`,
                      border: `1px solid ${
                        isSelected
                          ? PALETTE.primary
                          : `var(--border-subtle, ${THEME.default.borders.hairline})`
                      }`,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.12s ease',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem' }}>{isSelected ? '✓' : '+'}</span>
                    <span>{format.label}</span>
                  </button>
                );
              })}
            </div>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              Only queued posts matching the selected post types go out during this window.
            </p>
          </fieldset>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: SPACING.sm,
              marginTop: SPACING.md,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                height: '34px',
                padding: `0 ${SPACING.md}`,
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              data-testid="save-slot-btn"
              disabled={isSubmitting}
              style={{
                ...COMPONENT_STYLES.primaryButton,
                height: '34px',
                padding: `0 ${SPACING.md}`,
                border: `1px solid ${PALETTE.primary}`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: PALETTE.background,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  slotToDelete: PageSlotSummary | null;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

function DeleteSlotConfirmModal({
  slotToDelete,
  onClose,
  onConfirmDelete,
  isDeleting,
}: Readonly<DeleteModalProps>) {
  if (!slotToDelete) return null;
  const formatted = formatSlotDisplay(slotToDelete.slotTime);

  return (
    <div style={MODAL_BACKDROP_STYLE}>
      <div
        data-testid="delete-posting-time-modal"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '400px',
          padding: SPACING.xl,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Remove Posting Time?
        </h3>
        <p
          style={{
            margin: `${SPACING.sm} 0 ${SPACING.lg} 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.5,
          }}
        >
          Are you sure you want to remove the daily {formatted.time12} {formatted.ampm} posting window?
          Any queued posts currently scheduled for this window will automatically roll to your next active posting time.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              height: '34px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: 'transparent',
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="confirm-delete-slot-btn"
            disabled={isDeleting}
            onClick={onConfirmDelete}
            style={{
              height: '34px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.accent3,
              border: `1px solid ${PALETTE.accent3}`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: PALETTE.text,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            {isDeleting ? 'Removing...' : 'Remove Time'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PageTabPostingTimes({
  page,
  slots,
  isLoading = false,
  pendingQueueCount = 0,
  onAddSlot,
  onUpdateSlot,
  onUpdateTimezone,
  onToggleSlot,
  onDeleteSlot,
}: Readonly<PageTabPostingTimesProps>) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PageSlotSummary | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<PageSlotSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fallbackTimezone, setFallbackTimezone] = useState('UTC');

  const activeTimezone = page.timezone || slots[0]?.timezone || fallbackTimezone;

  const handleTimezoneChange = async (newTz: string) => {
    setFallbackTimezone(newTz);
    if (onUpdateTimezone) {
      await onUpdateTimezone(newTz);
    }
  };

  const handleToggle = async (slot: PageSlotSummary) => {
    setTogglingId(slot.id);
    try {
      await onToggleSlot(slot.id, !slot.isActive);
    } finally {
      setTogglingId(null);
    }
  };

  const handleOpenAdd = () => {
    setEditingSlot(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (slot: PageSlotSummary) => {
    setEditingSlot(slot);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (data: {
    slotTime: string;
    timezone: string;
    allowedFormats: string[];
  }) => {
    if (editingSlot) {
      if (onUpdateSlot) {
        await onUpdateSlot(editingSlot.id, data);
      } else {
        await onDeleteSlot(editingSlot.id);
        await onAddSlot(data);
      }
    } else {
      await onAddSlot(data);
    }
  };

  const handleConfirmDelete = async () => {
    if (!slotToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteSlot(slotToDelete.id);
      setSlotToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      data-testid="page-tab-calendar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
      }}
    >
      {/* 1. Header with Timezone Indicator */}
      <PostingTimesHeader
        activeTimezone={activeTimezone}
        onOpenAddModal={handleOpenAdd}
        onOpenTimezoneModal={() => setIsTimezoneModalOpen(true)}
      />

      {/* Loading state */}
      {isLoading && (
        <div
          data-testid="calendar-loading"
          style={{
            padding: SPACING.xl,
            textAlign: 'center',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.8125rem',
          }}
        >
          Loading posting schedule...
        </div>
      )}

      {/* 2. Empty State */}
      {!isLoading && slots.length === 0 && (
        <PostingTimesEmptyState onOpenAddModal={handleOpenAdd} />
      )}

      {/* 3. Non-Empty Ledger */}
      {!isLoading && slots.length > 0 && (
        <div
          data-testid="slots-grid"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.sm,
          }}
        >
          {slots.map((slot) => (
            <PostingTimeRow
              key={slot.id}
              slot={slot}
              isToggling={togglingId === slot.id}
              onToggle={handleToggle}
              onEdit={handleOpenEdit}
              onRemove={setSlotToDelete}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal with Format Selection */}
      <AddEditPostingTimeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        activeTimezone={activeTimezone}
        slotToEdit={editingSlot}
        onSave={handleSaveModal}
      />

      {/* Delete Confirmation Modal */}
      <DeleteSlotConfirmModal
        slotToDelete={slotToDelete}
        onClose={() => setSlotToDelete(null)}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* 2-Step Schedule Timezone Modal */}
      <ScheduleTimezoneModal
        isOpen={isTimezoneModalOpen}
        activeTimezone={activeTimezone}
        slotsCount={slots.length}
        pendingQueueCount={pendingQueueCount}
        onClose={() => setIsTimezoneModalOpen(false)}
        onConfirmTimezone={handleTimezoneChange}
      />
    </div>
  );
}

// Backwards-compatible alias for existing imports
export const PageTabCalendar = PageTabPostingTimes;
export type PageTabCalendarProps = PageTabPostingTimesProps;
