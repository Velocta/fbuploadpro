'use client';

import React, { useState } from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  COMPONENT_STYLES,
  STATUS_SIGNALS,
} from '@/lib/theme';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import type { FacebookPageItem } from '../page-card';
import type { PageSlotSummary } from './tab-dashboard';

export interface PageTabCalendarProps {
  page: FacebookPageItem;
  slots: PageSlotSummary[];
  isLoading?: boolean;
  onAddSlot: (data: { slotTime: string; timezone: string; allowedFormats?: string[] }) => Promise<void>;
  onToggleSlot: (slotId: string, isActive: boolean) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getSlotToggleLabel(isToggling: boolean, isActive: boolean): string {
  if (isToggling) return '...';
  return isActive ? 'Pause' : 'Activate';
}

export function PageTabCalendar({
  page: _page,
  slots,
  isLoading = false,
  onAddSlot,
  onToggleSlot,
  onDeleteSlot,
}: Readonly<PageTabCalendarProps>) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [slotTimeInput, setSlotTimeInput] = useState('09:00');
  const [timezoneInput, setTimezoneInput] = useState('UTC');
  const [allowedFormatsInput, setAllowedFormatsInput] = useState<string[]>([
    'text',
    'image',
    'reel',
    'video',
    'story',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<PageSlotSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeSlots = slots.filter((s) => s.isActive);

  const handleOpenAddModal = () => {
    setSlotTimeInput('09:00');
    setTimezoneInput('UTC');
    setAllowedFormatsInput(['text', 'image', 'reel', 'video', 'story']);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateSlot = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    // Validate HH:MM
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(slotTimeInput)) {
      setFormError('Please enter a valid time in 24-hour format (e.g. 09:00 or 14:30).');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddSlot({
        slotTime: slotTimeInput,
        timezone: timezoneInput,
        allowedFormats: allowedFormatsInput,
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create publishing slot.');
    } finally {
      setIsSubmitting(false);
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
    <div data-testid="page-tab-calendar" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {/* Header bar: Info & Add Slot trigger */}
      <div
        data-testid="calendar-header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.md,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Recurring Publishing Slots
          </h3>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Automated publishing dispatches queued content into these recurring time windows.
          </p>
        </div>

        <button
          type="button"
          data-testid="add-slot-button"
          onClick={handleOpenAddModal}
          style={{
            ...COMPONENT_STYLES.primaryButton,
            display: 'inline-flex',
            alignItems: 'center',
            gap: SPACING.xs,
            padding: `${SPACING.sm} ${SPACING.md}`,
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Time Slot
        </button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div
          data-testid="calendar-loading"
          style={{
            padding: SPACING.xl,
            textAlign: 'center',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            fontSize: '0.875rem',
          }}
        >
          Loading publishing schedule...
        </div>
      )}

      {/* Empty State */}
      {!isLoading && slots.length === 0 && (
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
              width: '48px',
              height: '48px',
              borderRadius: RADII.full,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              No publishing slots scheduled
            </h4>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                maxWidth: '400px',
              }}
            >
              Configure daily recurring slots so your queued posts are automatically distributed at optimal audience hours.
            </p>
          </div>
          <button
            type="button"
            data-testid="empty-add-slot-button"
            onClick={handleOpenAddModal}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              padding: `${SPACING.sm} ${SPACING.lg}`,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Add First Time Slot
          </button>
        </div>
      )}

      {/* Slots List */}
      {!isLoading && slots.length > 0 && (
        <div
          data-testid="slots-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: SPACING.md,
          }}
        >
          {slots.map((slot) => {
            const isToggling = togglingId === slot.id;
            const signal = slot.isActive ? STATUS_SIGNALS.operational : STATUS_SIGNALS.idle;

            return (
              <div
                key={slot.id}
                data-testid={`slot-card-${slot.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: SPACING.md,
                  backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  borderRadius: RADII.md,
                  boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
                  {/* Status Indicator */}
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: signal.dot,
                      boxShadow: slot.isActive ? signal.halo : 'none',
                      flexShrink: 0,
                    }}
                  />

                  <div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: TYPOGRAPHY.weights.bold,
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {slot.slotTime}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: `var(--text-sub, ${THEME.default.text.secondary})`,
                        marginTop: '2px',
                      }}
                    >
                      {slot.timezone} {slot.isActive ? '• Active' : '• Paused'}
                    </div>
                    {slot.allowedFormats && slot.allowedFormats.length > 0 && (
                      <div
                        data-testid={`slot-format-chips-${slot.id}`}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '4px',
                          marginTop: '6px',
                        }}
                      >
                        {slot.allowedFormats.map((fmt) => (
                          <span
                            key={fmt}
                            data-testid={`slot-format-chip-${slot.id}-${fmt}`}
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: TYPOGRAPHY.weights.semibold,
                              padding: '2px 5px',
                              borderRadius: RADII.xs,
                              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                              color: `var(--text-sub, ${THEME.default.text.secondary})`,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {fmt}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions: Toggle & Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                  <button
                    type="button"
                    data-testid={`toggle-slot-btn-${slot.id}`}
                    disabled={isToggling}
                    onClick={() => handleToggle(slot)}
                    style={{
                      padding: `${SPACING.xs} ${SPACING.sm}`,
                      borderRadius: RADII.sm,
                      fontSize: '0.75rem',
                      fontWeight: TYPOGRAPHY.weights.medium,
                      backgroundColor: slot.isActive
                        ? `var(--bg-active, ${THEME.default.surfaces.active})`
                        : 'transparent',
                      color: slot.isActive
                        ? `var(--text-main, ${THEME.default.text.primary})`
                        : `var(--text-sub, ${THEME.default.text.secondary})`,
                      border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                      cursor: isToggling ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {getSlotToggleLabel(isToggling, slot.isActive)}
                  </button>

                  <button
                    type="button"
                    data-testid={`delete-slot-btn-${slot.id}`}
                    onClick={() => setSlotToDelete(slot)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: SPACING.xs,
                      color: `var(--text-sub, ${THEME.default.text.secondary})`,
                      cursor: 'pointer',
                      borderRadius: RADII.sm,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Delete Slot"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Schedule Preview Grid */}
      {!isLoading && slots.length > 0 && (
        <div
          data-testid="weekly-schedule-view"
          style={{
            backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.md,
            padding: SPACING.lg,
          }}
        >
          <div style={{ marginBottom: SPACING.md }}>
            <h4
              style={{
                margin: 0,
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Weekly Schedule Preview
            </h4>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              {activeSlots.length} active time {activeSlots.length === 1 ? 'window' : 'windows'} recurring daily across the week.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: SPACING.sm,
            }}
          >
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                style={{
                  padding: SPACING.sm,
                  borderRadius: RADII.sm,
                  backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACING.xs,
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: TYPOGRAPHY.weights.bold,
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {day.slice(0, 3)}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                  {activeSlots.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                      None
                    </span>
                  ) : (
                    activeSlots.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: TYPOGRAPHY.weights.medium,
                          color: PALETTE.primary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span
                          style={{
                            width: '4px',
                            height: '4px',
                            borderRadius: '50%',
                            backgroundColor: PALETTE.primary,
                          }}
                        />
                        {s.slotTime}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Slot Modal */}
      {isAddModalOpen && (
        <div
          data-testid="add-slot-modal-backdrop"
          style={MODAL_BACKDROP_STYLE}
        >
          <div
            data-testid="add-slot-modal"
            style={{
              ...MODAL_CONTAINER_STYLE,
              maxWidth: '460px',
              gap: SPACING.lg,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                Add Recurring Slot
              </h3>
              <button
                type="button"
                data-testid="close-add-slot-btn"
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  cursor: 'pointer',
                  padding: SPACING.xs,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateSlot} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
              {formError && (
                <div
                  data-testid="add-slot-error"
                  style={{
                    padding: SPACING.sm,
                    borderRadius: RADII.sm,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: PALETTE.accent3,
                    fontSize: '0.8125rem',
                  }}
                >
                  {formError}
                </div>
              )}

              {/* Slot Time Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                <label
                  htmlFor="slot-time-input"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Publishing Time (24-Hour Format)
                </label>
                <input
                  id="slot-time-input"
                  data-testid="slot-time-input"
                  type="text"
                  required
                  placeholder="09:00"
                  value={slotTimeInput}
                  onChange={(e) => setSlotTimeInput(e.target.value)}
                  style={{
                    padding: SPACING.sm,
                    borderRadius: RADII.sm,
                    backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontSize: '0.875rem',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                  Use HH:MM format (e.g. 09:00, 13:30, 20:15)
                </span>
              </div>

              {/* Timezone Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                <label
                  htmlFor="slot-timezone-select"
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Timezone
                </label>
                <select
                  id="slot-timezone-select"
                  data-testid="slot-timezone-select"
                  value={timezoneInput}
                  onChange={(e) => setTimezoneInput(e.target.value)}
                  style={{
                    padding: SPACING.sm,
                    borderRadius: RADII.sm,
                    backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    color: `var(--text-main, ${THEME.default.text.primary})`,
                    fontSize: '0.875rem',
                  }}
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Allowed Content Formats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
                <label
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  }}
                >
                  Allowed Content Formats
                </label>
                <div
                  data-testid="slot-allowed-formats-selector"
                  style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.xs }}
                >
                  {(['text', 'image', 'reel', 'video', 'story'] as const).map((fmt) => {
                    const isSelected = allowedFormatsInput.includes(fmt);
                    return (
                      <button
                        key={fmt}
                        type="button"
                        data-testid={`slot-format-chip-${fmt}`}
                        onClick={() => {
                          if (isSelected) {
                            if (allowedFormatsInput.length > 1) {
                              setAllowedFormatsInput(allowedFormatsInput.filter((f) => f !== fmt));
                            }
                          } else {
                            setAllowedFormatsInput([...allowedFormatsInput, fmt]);
                          }
                        }}
                        style={{
                          padding: `${SPACING.xs} ${SPACING.sm}`,
                          borderRadius: RADII.xs,
                          fontSize: '0.75rem',
                          fontWeight: TYPOGRAPHY.weights.medium,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'rgba(14, 165, 233, 0.15)'
                            : `var(--bg-active, ${THEME.default.surfaces.active})`,
                          borderColor: isSelected
                            ? PALETTE.primary
                            : `var(--border-subtle, ${THEME.default.borders.hairline})`,
                          borderStyle: 'solid',
                          borderWidth: '1px',
                          color: isSelected
                            ? PALETTE.primary
                            : `var(--text-sub, ${THEME.default.text.secondary})`,
                        }}
                      >
                        {fmt}
                      </button>
                    );
                  })}
                </div>
                <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                  Queued posts matching any of these formats can fill this slot.
                </span>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
                <button
                  type="button"
                  data-testid="cancel-add-slot-btn"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    padding: `${SPACING.xs} ${SPACING.md}`,
                    borderRadius: RADII.sm,
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.medium,
                    backgroundColor: 'transparent',
                    color: `var(--text-sub, ${THEME.default.text.secondary})`,
                    border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="submit-add-slot-btn"
                  disabled={isSubmitting}
                  style={{
                    ...COMPONENT_STYLES.primaryButton,
                    padding: `${SPACING.xs} ${SPACING.lg}`,
                    fontSize: '0.875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Add Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Slot Confirmation Dialog */}
      {slotToDelete && (
        <div
          data-testid="delete-slot-backdrop"
          style={MODAL_BACKDROP_STYLE}
        >
          <div
            data-testid="delete-slot-dialog"
            style={{
              ...MODAL_CONTAINER_STYLE,
              maxWidth: '440px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Delete Publishing Slot
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.5,
              }}
            >
              Are you sure you want to delete the daily slot at {slotToDelete.slotTime} ({slotToDelete.timezone})? Future automated posts will not be scheduled for this window.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
              <button
                type="button"
                data-testid="cancel-delete-slot-btn"
                onClick={() => setSlotToDelete(null)}
                style={{
                  padding: `${SPACING.xs} ${SPACING.md}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  backgroundColor: 'transparent',
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  cursor: 'pointer',
                }}
              >
                Keep Slot
              </button>
              <button
                type="button"
                data-testid="confirm-delete-slot-btn"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  backgroundColor: PALETTE.accent3,
                  color: '#ffffff',
                  border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete Slot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
