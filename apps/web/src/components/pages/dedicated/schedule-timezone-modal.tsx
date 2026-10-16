'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  COMPONENT_STYLES,
  PALETTE,
  RADII,
  SPACING,
  STATUS_SIGNALS,
  THEME,
  TYPOGRAPHY,
} from '@/lib/theme';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import {
  findTimezoneEntry,
  getTimezoneCurrentTime,
  getTimezoneUtcOffset,
  REGION_LABELS,
  REGION_ORDER,
  searchAndGroupTimezones,
} from '@/lib/timezones';

export interface ScheduleTimezoneModalProps {
  isOpen: boolean;
  activeTimezone: string;
  slotsCount: number;
  pendingQueueCount: number;
  onClose: () => void;
  onConfirmTimezone: (newTimezone: string) => Promise<void>;
}

interface Step1Props {
  activeTimezone: string;
  selectedTimezone: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectTimezone: (iana: string) => void;
  onCancel: () => void;
  onProceed: () => void;
}

export function Step1TimezoneSelector({
  activeTimezone,
  selectedTimezone,
  searchQuery,
  onSearchChange,
  onSelectTimezone,
  onCancel,
  onProceed,
}: Readonly<Step1Props>) {
  const grouped = useMemo(() => {
    return searchAndGroupTimezones(searchQuery);
  }, [searchQuery]);

  const activeEntry = useMemo(() => {
    return findTimezoneEntry(activeTimezone);
  }, [activeTimezone]);

  const activeOffset = useMemo(() => {
    return getTimezoneUtcOffset(activeTimezone);
  }, [activeTimezone]);

  const activeLocalTime = useMemo(() => {
    return getTimezoneCurrentTime(activeTimezone);
  }, [activeTimezone]);

  const hasMatches = useMemo(() => {
    return REGION_ORDER.some((region) => grouped[region].length > 0);
  }, [grouped]);

  const isSameAsActive = selectedTimezone === activeTimezone;

  return (
    <div>
      {/* Header text */}
      <div style={{ marginBottom: SPACING.md }}>
        <h3
          id="timezone-modal-title"
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Select Schedule Timezone
        </h3>
        <p
          style={{
            margin: `${SPACING.xs} 0 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Choose the primary geographic timezone for this page&apos;s publishing schedule.
        </p>
      </div>

      {/* Active Timezone Current Status Card */}
      <div
        data-testid="current-timezone-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACING.sm} ${SPACING.md}`,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          marginBottom: SPACING.md,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: STATUS_SIGNALS.operational.dot,
              boxShadow: STATUS_SIGNALS.operational.halo,
            }}
          />
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: `var(--text-muted, ${THEME.default.text.muted})`,
                fontWeight: TYPOGRAPHY.weights.semibold,
              }}
            >
              Current Active Timezone
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              {activeEntry.city} · {activeEntry.country} ({activeOffset})
            </div>
          </div>
        </div>
        {activeLocalTime && (
          <div
            style={{
              fontSize: '0.8125rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {activeLocalTime}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div style={{ marginBottom: SPACING.md, position: 'relative' }}>
        <input
          type="text"
          data-testid="timezone-search-input"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by city, country, or region..."
          aria-label="Search Timezones"
          style={{
            ...COMPONENT_STYLES.input,
            width: '100%',
            height: '38px',
            paddingLeft: '34px',
            fontSize: '0.8125rem',
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            boxSizing: 'border-box',
          }}
        />
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '11px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Timezone List Container */}
      <div
        data-testid="timezone-list-container"
        style={{
          maxHeight: '300px',
          overflowY: 'auto',
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
          padding: SPACING.xs,
          marginBottom: SPACING.lg,
        }}
      >
        {!hasMatches ? (
          <div
            data-testid="timezone-no-matches"
            style={{
              padding: SPACING.xl,
              textAlign: 'center',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              fontSize: '0.8125rem',
            }}
          >
            No timezones matching &ldquo;{searchQuery}&rdquo;.
          </div>
        ) : (
          REGION_ORDER.map((region) => {
            const entries = grouped[region];
            if (entries.length === 0) return null;

            return (
              <div key={region} style={{ marginBottom: SPACING.sm }}>
                <div
                  style={{
                    padding: `${SPACING.xs} ${SPACING.sm}`,
                    fontSize: '0.6875rem',
                    fontWeight: TYPOGRAPHY.weights.semibold,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: `var(--text-muted, ${THEME.default.text.muted})`,
                  }}
                >
                  {REGION_LABELS[region]}
                </div>
                {entries.map((entry) => {
                  const isSelected = selectedTimezone === entry.iana;
                  const isCurrent = activeTimezone === entry.iana;

                  return (
                    <button
                      key={entry.iana}
                      type="button"
                      data-testid={`timezone-option-${entry.iana}`}
                      onClick={() => onSelectTimezone(entry.iana)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: `${SPACING.xs} ${SPACING.sm}`,
                        marginBottom: '2px',
                        borderRadius: RADII.sm,
                        border: isSelected
                          ? `1px solid ${PALETTE.primary}`
                          : '1px solid transparent',
                        backgroundColor: isSelected
                          ? 'rgba(235, 235, 245, 0.08)'
                          : 'transparent',
                        color: `var(--text-main, ${THEME.default.text.primary})`,
                        cursor: 'pointer',
                        textAlign: 'left',
                        outline: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                        <div
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            border: isSelected
                              ? `4px solid ${PALETTE.primary}`
                              : `1.5px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                            backgroundColor: isSelected ? '#ffffff' : 'transparent',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: isSelected
                                ? TYPOGRAPHY.weights.semibold
                                : TYPOGRAPHY.weights.medium,
                            }}
                          >
                            {entry.city}
                            {isCurrent && (
                              <span
                                style={{
                                  marginLeft: SPACING.xs,
                                  fontSize: '0.6875rem',
                                  color: PALETTE.primary,
                                  fontWeight: TYPOGRAPHY.weights.regular,
                                }}
                              >
                                (Current)
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.6875rem',
                              color: `var(--text-sub, ${THEME.default.text.secondary})`,
                            }}
                          >
                            {entry.country} · {entry.iana}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: TYPOGRAPHY.weights.medium,
                            color: `var(--text-main, ${THEME.default.text.primary})`,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {entry.offset}
                        </div>
                        {entry.currentTime && (
                          <div
                            style={{
                              fontSize: '0.6875rem',
                              color: `var(--text-sub, ${THEME.default.text.secondary})`,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {entry.currentTime}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: SPACING.sm,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            ...COMPONENT_STYLES.secondaryButton(),
            height: '36px',
            padding: `0 ${SPACING.md}`,
            fontSize: '0.8125rem',
          }}
        >
          Cancel
        </button>

        <button
          type="button"
          data-testid="proceed-to-step2-button"
          disabled={isSameAsActive}
          onClick={onProceed}
          style={{
            height: '36px',
            padding: `0 ${SPACING.lg}`,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            borderRadius: RADII.sm,
            backgroundColor: isSameAsActive ? 'rgba(255, 255, 255, 0.1)' : PALETTE.primary,
            color: isSameAsActive ? 'rgba(255, 255, 255, 0.4)' : '#000000',
            border: 'none',
            cursor: isSameAsActive ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.15s ease',
          }}
        >
          Next: Review Shift
        </button>
      </div>
    </div>
  );
}

interface Step2Props {
  activeTimezone: string;
  selectedTimezone: string;
  slotsCount: number;
  pendingQueueCount: number;
  isSubmitting: boolean;
  errorMessage: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

export function Step2ReviewImpact({
  activeTimezone,
  selectedTimezone,
  slotsCount,
  pendingQueueCount,
  isSubmitting,
  errorMessage,
  onBack,
  onConfirm,
}: Readonly<Step2Props>) {
  const currentEntry = useMemo(() => findTimezoneEntry(activeTimezone), [activeTimezone]);
  const newEntry = useMemo(() => findTimezoneEntry(selectedTimezone), [selectedTimezone]);

  const currentOffset = useMemo(() => getTimezoneUtcOffset(activeTimezone), [activeTimezone]);
  const newOffset = useMemo(() => getTimezoneUtcOffset(selectedTimezone), [selectedTimezone]);

  return (
    <div>
      {/* Header text */}
      <div style={{ marginBottom: SPACING.md }}>
        <div
          style={{
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: PALETTE.primary,
            fontWeight: TYPOGRAPHY.weights.semibold,
            marginBottom: '2px',
          }}
        >
          Step 2 of 2: Impact Review
        </div>
        <h3
          id="timezone-modal-title"
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Review Schedule Timezone Shift
        </h3>
        <p
          style={{
            margin: `${SPACING.xs} 0 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Verify how this change affects your recurring posting times and pending posts.
        </p>
      </div>

      {/* Transition Preview Card */}
      <div
        data-testid="timezone-transition-card"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: SPACING.sm,
          padding: SPACING.md,
          backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          marginBottom: SPACING.md,
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: `var(--text-muted, ${THEME.default.text.muted})`,
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            Current Timezone
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {currentEntry.city}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {currentOffset} · {activeTimezone}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: PALETTE.primary,
          }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>

        <div>
          <div
            style={{
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              color: PALETTE.primary,
              fontWeight: TYPOGRAPHY.weights.semibold,
            }}
          >
            New Timezone
          </div>
          <div
            style={{
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {newEntry.city}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {newOffset} · {selectedTimezone}
          </div>
        </div>
      </div>

      {/* Impact Explanation Box */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          padding: SPACING.md,
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          marginBottom: SPACING.md,
          fontSize: '0.8125rem',
          lineHeight: '1.45',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACING.sm }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: PALETTE.primary, flexShrink: 0, marginTop: '2px' }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <strong style={{ color: `var(--text-main, ${THEME.default.text.primary})` }}>
              Clock times are preserved:
            </strong>{' '}
            Your posting slots will publish at their exact clock times in the new timezone. For example, a 10:00 AM slot will now publish at 10:00 AM {newEntry.city} time.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: SPACING.sm }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ color: PALETTE.primary, flexShrink: 0, marginTop: '2px' }}
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <strong style={{ color: `var(--text-main, ${THEME.default.text.primary})` }}>
              Automatic queue realignment:
            </strong>{' '}
            Pending queued items linked to slots will automatically shift forward to avoid publishing in the past.
          </div>
        </div>
      </div>

      {/* Impact Numbers Card */}
      <div
        data-testid="timezone-impact-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: SPACING.sm,
          marginBottom: SPACING.lg,
        }}
      >
        <div
          style={{
            padding: SPACING.sm,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              color: `var(--text-muted, ${THEME.default.text.muted})`,
              fontWeight: TYPOGRAPHY.weights.semibold,
              textTransform: 'uppercase',
            }}
          >
            Recurring Slots
          </div>
          <div
            style={{
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              marginTop: '2px',
            }}
          >
            {slotsCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Active publishing times
          </div>
        </div>

        <div
          style={{
            padding: SPACING.sm,
            backgroundColor: `var(--bg-subtle, ${THEME.default.surfaces.subtle})`,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderRadius: RADII.sm,
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              color: `var(--text-muted, ${THEME.default.text.muted})`,
              fontWeight: TYPOGRAPHY.weights.semibold,
              textTransform: 'uppercase',
            }}
          >
            Pending Queue Items
          </div>
          <div
            style={{
              fontSize: '1.125rem',
              fontWeight: TYPOGRAPHY.weights.bold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
              marginTop: '2px',
            }}
          >
            {pendingQueueCount}
          </div>
          <div style={{ fontSize: '0.6875rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
            Posts realigned automatically
          </div>
        </div>
      </div>

      {/* Error alert banner if any */}
      {errorMessage && (
        <div
          data-testid="timezone-update-error"
          style={{
            padding: SPACING.sm,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: RADII.sm,
            color: '#f87171',
            fontSize: '0.8125rem',
            marginBottom: SPACING.md,
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Action Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: SPACING.sm,
        }}
      >
        <button
          type="button"
          data-testid="back-to-step1-button"
          disabled={isSubmitting}
          onClick={onBack}
          style={{
            ...COMPONENT_STYLES.secondaryButton(),
            height: '36px',
            padding: `0 ${SPACING.md}`,
            fontSize: '0.8125rem',
          }}
        >
          Back
        </button>

        <button
          type="button"
          data-testid="confirm-timezone-update-button"
          disabled={isSubmitting}
          onClick={onConfirm}
          style={{
            height: '36px',
            padding: `0 ${SPACING.lg}`,
            fontSize: '0.8125rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            borderRadius: RADII.sm,
            backgroundColor: PALETTE.primary,
            color: '#000000',
            border: 'none',
            cursor: isSubmitting ? 'wait' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1,
            transition: 'opacity 0.15s ease',
          }}
        >
          {isSubmitting ? 'Updating Timezone...' : 'Update Schedule Timezone'}
        </button>
      </div>
    </div>
  );
}

export function ScheduleTimezoneModal({
  isOpen,
  activeTimezone,
  slotsCount,
  pendingQueueCount,
  onClose,
  onConfirmTimezone,
}: Readonly<ScheduleTimezoneModalProps>) {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimezone, setSelectedTimezone] = useState(activeTimezone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSearchQuery('');
      setSelectedTimezone(activeTimezone);
      setIsSubmitting(false);
      setErrorMessage(null);
    }
  }, [isOpen, activeTimezone]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await onConfirmTimezone(selectedTimezone);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update schedule timezone. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timezone-modal-title"
      data-testid="schedule-timezone-modal"
      style={MODAL_BACKDROP_STYLE}
    >
      <div
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: SPACING.lg,
        }}
      >
        {step === 1 ? (
          <Step1TimezoneSelector
            activeTimezone={activeTimezone}
            selectedTimezone={selectedTimezone}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectTimezone={setSelectedTimezone}
            onCancel={onClose}
            onProceed={() => setStep(2)}
          />
        ) : (
          <Step2ReviewImpact
            activeTimezone={activeTimezone}
            selectedTimezone={selectedTimezone}
            slotsCount={slotsCount}
            pendingQueueCount={pendingQueueCount}
            isSubmitting={isSubmitting}
            errorMessage={errorMessage}
            onBack={() => setStep(1)}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
}
