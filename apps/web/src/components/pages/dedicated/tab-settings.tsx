'use client';

import React, { useState } from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  STATUS_SIGNALS,
  COMPONENT_STYLES,
} from '@/lib/theme';
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import { ScheduleTimezoneModal } from './schedule-timezone-modal';
import type { FacebookPageItem } from '../page-card';

export interface PageTabSettingsProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onDisconnectPage: () => Promise<void>;
  onUpdateTimezone?: (newTimezone: string) => Promise<void>;
}

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// TODO(102): consolidate with components/accounts/account-health.ts after #629 merges.
// Mirrors the single account-health model: Connected / Expired / Error.
function getSettingsStatusDetails(status: string) {
  const isPaused = status === 'paused';
  const isExpired = status === 'invalid_token';
  const isError =
    status === 'page_checkpoint' ||
    status === 'fb_rate_limited';
  const isNeedsAttention = isExpired || isError;

  let signal: (typeof STATUS_SIGNALS)[keyof typeof STATUS_SIGNALS] = STATUS_SIGNALS.operational;
  let label = 'Connected';

  if (isExpired) {
    signal = STATUS_SIGNALS.critical;
    label = 'Expired';
  } else if (isError) {
    signal = STATUS_SIGNALS.critical;
    label = 'Error';
  }

  return { isPaused, isNeedsAttention, statusSignal: signal, statusLabel: label };
}

export function PageTabSettings({
  page,
  subdomain: _subdomain,
  onStatusToggle,
  onDisconnectPage,
  onUpdateTimezone,
}: Readonly<PageTabSettingsProps>) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);
  const [timezoneSlotsCount, setTimezoneSlotsCount] = useState(0);
  const [timezonePendingCount, setTimezonePendingCount] = useState(0);
  const [timezoneOverride, setTimezoneOverride] = useState<string | null>(null);

  const { isPaused, isNeedsAttention, statusSignal, statusLabel } = getSettingsStatusDetails(page.status);
  const displayedTimezone = timezoneOverride || page.timezone || detectBrowserTimezone();

  let automationStateLabel = isPaused ? 'Off' : 'On';
  if (isUpdatingStatus) {
    automationStateLabel = 'Updating…';
  }

  const handleToggleAutomation = async () => {
    setIsUpdatingStatus(true);
    try {
      await onStatusToggle(isPaused ? 'active' : 'paused');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleOpenTimezoneModal = async () => {
    setIsTimezoneModalOpen(true);
    // Load real counts for the impact-review step; non-blocking on failure.
    try {
      const slotsRes = await fetch(`/api/tenant/${_subdomain}/pages/${page.id}/slots`);
      if (slotsRes.ok) {
        const slotsData = await slotsRes.json().catch(() => ({}));
        setTimezoneSlotsCount(Array.isArray(slotsData.slots) ? slotsData.slots.length : 0);
      }
    } catch {
      // Keep defaults
    }
    try {
      const queueRes = await fetch(`/api/tenant/${_subdomain}/publishing/queue?pageId=${page.id}`);
      if (queueRes.ok) {
        const queueData = await queueRes.json().catch(() => ({}));
        const items = Array.isArray(queueData.items) ? queueData.items : [];
        setTimezonePendingCount(
          items.filter((item: { status?: string }) => item.status === 'queued' || item.status === 'publishing').length
        );
      }
    } catch {
      // Keep defaults
    }
  };

  const handleConfirmTimezone = async (newTimezone: string) => {
    if (onUpdateTimezone) {
      await onUpdateTimezone(newTimezone);
    } else {
      const res = await fetch(`/api/tenant/${_subdomain}/pages/${page.id}/slots`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: newTimezone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Couldn't update the schedule timezone. Please try again.");
      }
    }
    setTimezoneOverride(newTimezone);
  };

  const handleConfirmDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await onDisconnectPage();
      setIsDisconnectDialogOpen(false);
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div data-testid="page-tab-settings" style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {/* Timezone line */}
      <div
        data-testid="settings-timezone-line"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.8125rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
        }}
      >
        <span>Times shown in</span>
        <span
          style={{
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {displayedTimezone}
        </span>
        <span aria-hidden="true">—</span>
        <button
          type="button"
          data-testid="settings-change-timezone-btn"
          onClick={() => void handleOpenTimezoneModal()}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            fontSize: '0.8125rem',
            color: PALETTE.primary,
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          Change
        </button>
      </div>

      {/* Checkpoint Reactivation Banner */}
      {(page.status === 'page_checkpoint' || (page.status as string) === 'checkpoint_required') && (
        <div
          data-testid="checkpoint-reactivation-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.md,
            padding: SPACING.md,
            borderRadius: RADII.sm,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: `var(--text-main, ${THEME.default.text.primary})`,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flex: '1 1 300px' }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.primary}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <div style={{ fontWeight: TYPOGRAPHY.weights.semibold, fontSize: '0.875rem' }}>
                Facebook checkpoint verification required
              </div>
              <div style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Finish Facebook&apos;s identity check in the Facebook app or browser before automatic posting can continue.
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="reactivate-page-btn"
            disabled={isUpdatingStatus}
            onClick={async () => {
              setIsUpdatingStatus(true);
              try {
                const res = await fetch(`/api/tenant/${_subdomain}/pages/${page.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'active' }),
                });
                if (res.ok) {
                  await onStatusToggle('active');
                }
              } catch {
                await onStatusToggle('active');
              } finally {
                setIsUpdatingStatus(false);
              }
            }}
            style={{
              ...COMPONENT_STYLES.primaryButton,
              padding: `${SPACING.xs} ${SPACING.md}`,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: PALETTE.background,
              cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isUpdatingStatus ? 'Reactivating...' : 'Mark verified and reactivate page'}
          </button>
        </div>
      )}

      {/* 1. Automation State Section */}
      <div
        data-testid="settings-automation-card"
        style={{
          padding: SPACING.xl,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.md,
        }}
      >
        <div style={{ maxWidth: '580px' }}>
          <h4
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Automation
          </h4>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            When automation is on, queued posts publish at your posting times. Pausing stops publishing without deleting your queue.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <button
            type="button"
            role="switch"
            aria-checked={!isPaused}
            aria-label="Automation"
            data-testid="toggle-automation-btn"
            disabled={isUpdatingStatus}
            onClick={handleToggleAutomation}
            style={{
              width: '36px',
              height: '20px',
              borderRadius: RADII.full,
              backgroundColor: !isPaused
                ? PALETTE.primary
                : `var(--bg-active, ${THEME.default.surfaces.active})`,
              border: `1px solid ${
                !isPaused
                  ? PALETTE.primary
                  : `var(--border-subtle, ${THEME.default.borders.hairline})`
              }`,
              position: 'relative',
              cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
              padding: 0,
              transition: 'background-color 0.15s ease, border-color 0.15s ease',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '2px',
                left: !isPaused ? '18px' : '2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: !isPaused
                  ? PALETTE.background
                  : `var(--text-sub, ${THEME.default.text.secondary})`,
                transition: 'left 0.15s ease, background-color 0.15s ease',
              }}
            />
          </button>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {automationStateLabel}
          </span>
        </div>
      </div>

      {/* 2. Page Connection Details */}
      <div
        data-testid="settings-token-card"
        style={{
          padding: SPACING.xl,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        }}
      >
        <div style={{ marginBottom: SPACING.md }}>
          <h4
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Facebook page connection
          </h4>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Your page details and connection status.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: SPACING.md,
            marginTop: SPACING.md,
          }}
        >
          <div
            style={{
              padding: SPACING.md,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              borderRadius: RADII.sm,
            }}
          >
            <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
              Facebook Page ID
            </span>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                marginTop: '4px',
                fontFamily: TYPOGRAPHY.mono,
              }}
            >
              {page.fbPageId}
            </div>
          </div>

          <div
            style={{
              padding: SPACING.md,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              borderRadius: RADII.sm,
            }}
          >
            <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
              Linked Facebook Account
            </span>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                marginTop: '4px',
              }}
            >
              {page.accountDisplayName || 'Primary Administrator'}
            </div>
          </div>

          <div
            style={{
              padding: SPACING.md,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              borderRadius: RADII.sm,
            }}
          >
            <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
              Category
            </span>
            <div
              style={{
                fontSize: '0.9375rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                marginTop: '4px',
              }}
            >
              {page.category || 'General Page'}
            </div>
          </div>

          <div
            style={{
              padding: SPACING.md,
              backgroundColor: `var(--bg-active, ${THEME.default.surfaces.active})`,
              borderRadius: RADII.sm,
            }}
          >
            <span style={{ fontSize: '0.75rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
              Connection status
            </span>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '4px',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: statusSignal.dot,
                  boxShadow: statusSignal.halo,
                }}
              />
              <span
                style={{
                  fontSize: '0.9375rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: statusSignal.color,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {isNeedsAttention && (
          <div
            data-testid="token-alert-banner"
            style={{
              marginTop: SPACING.md,
              padding: SPACING.md,
              borderRadius: RADII.sm,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: PALETTE.accent3,
              fontSize: '0.875rem',
              lineHeight: 1.4,
            }}
          >
            Your Facebook connection expired or needs attention. Reconnect it in the Facebook Accounts section to resume publishing.
          </div>
        )}
      </div>

      {/* 3. Danger Zone: Disconnect Page */}
      <div
        data-testid="settings-danger-zone"
        style={{
          padding: SPACING.xl,
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: SPACING.md,
        }}
      >
        <div style={{ maxWidth: '580px' }}>
          <h4
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: PALETTE.accent3,
            }}
          >
            Disconnect Facebook Page
          </h4>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Disconnecting this page stops automatic posting and cancels any queued posts.
          </p>
        </div>

        <button
          type="button"
          data-testid="disconnect-page-btn"
          onClick={() => setIsDisconnectDialogOpen(true)}
          style={{
            padding: `${SPACING.xs} ${SPACING.lg}`,
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            backgroundColor: 'transparent',
            color: PALETTE.accent3,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            cursor: 'pointer',
          }}
        >
          Disconnect Page
        </button>
      </div>

      <DisconnectConfirmationDialog
        isOpen={isDisconnectDialogOpen}
        pageName={page.pageName}
        isDisconnecting={isDisconnecting}
        onCancel={() => setIsDisconnectDialogOpen(false)}
        onConfirm={handleConfirmDisconnect}
      />

      <ScheduleTimezoneModal
        isOpen={isTimezoneModalOpen}
        activeTimezone={displayedTimezone}
        slotsCount={timezoneSlotsCount}
        pendingQueueCount={timezonePendingCount}
        onClose={() => setIsTimezoneModalOpen(false)}
        onConfirmTimezone={handleConfirmTimezone}
      />
    </div>
  );
}

interface DisconnectConfirmationDialogProps {
  isOpen: boolean;
  pageName: string;
  isDisconnecting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DisconnectConfirmationDialog({
  isOpen,
  pageName,
  isDisconnecting,
  onCancel,
  onConfirm,
}: Readonly<DisconnectConfirmationDialogProps>) {
  if (!isOpen) return null;

  return (
    <div
      data-testid="disconnect-modal-backdrop"
      style={MODAL_BACKDROP_STYLE}
    >
      <div
        data-testid="disconnect-modal"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '460px',
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
          Disconnect {pageName}?
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.5,
          }}
        >
          This will disconnect the Facebook Page from your workspace. Any queued posts will be cancelled.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
          <button
            type="button"
            data-testid="cancel-disconnect-btn"
            onClick={onCancel}
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
            type="button"
            data-testid="confirm-disconnect-btn"
            disabled={isDisconnecting}
            onClick={onConfirm}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              opacity: isDisconnecting ? 0.7 : 1,
            }}
          >
            {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect Page'}
          </button>
        </div>
      </div>
    </div>
  );
}
