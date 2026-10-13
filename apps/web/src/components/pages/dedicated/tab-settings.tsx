'use client';

import React, { useState } from 'react';
import {
  THEME,
  PALETTE,
  RADII,
  SPACING,
  TYPOGRAPHY,
  STATUS_SIGNALS,
} from '@/lib/theme';
import type { FacebookPageItem } from '../page-card';

export interface PageTabSettingsProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onDisconnectPage: () => Promise<void>;
}

export function PageTabSettings({
  page,
  subdomain: _subdomain,
  onStatusToggle,
  onDisconnectPage,
}: Readonly<PageTabSettingsProps>) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const isPaused = page.status === 'paused';
  const isNeedsAttention =
    page.status === 'invalid_token' ||
    page.status === 'page_checkpoint' ||
    page.status === 'fb_rate_limited';

  const statusSignal = isNeedsAttention
    ? STATUS_SIGNALS.critical
    : isPaused
    ? STATUS_SIGNALS.queued
    : STATUS_SIGNALS.operational;

  const statusLabel = isNeedsAttention
    ? 'Re-Authentication Required'
    : isPaused
    ? 'Automation Paused'
    : 'Active & Operational';

  const handleToggleAutomation = async () => {
    setIsUpdatingStatus(true);
    try {
      await onStatusToggle(isPaused ? 'active' : 'paused');
    } finally {
      setIsUpdatingStatus(false);
    }
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
            Automation Master Switch
          </h4>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            When automation is active, the dispatcher will automatically distribute queued posts into scheduled time slots. Pausing automation suspends publishing without deleting your queue.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.md }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
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
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: statusSignal.color,
              }}
            >
              {isPaused ? 'Paused' : 'Active'}
            </span>
          </div>

          <button
            type="button"
            data-testid="toggle-automation-btn"
            disabled={isUpdatingStatus}
            onClick={handleToggleAutomation}
            style={{
              padding: `${SPACING.xs} ${SPACING.lg}`,
              borderRadius: RADII.sm,
              fontSize: '0.875rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              backgroundColor: isPaused ? PALETTE.primary : `var(--bg-active, ${THEME.default.surfaces.active})`,
              color: isPaused ? '#000000' : `var(--text-main, ${THEME.default.text.primary})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
              opacity: isUpdatingStatus ? 0.7 : 1,
            }}
          >
            {isUpdatingStatus ? 'Updating...' : isPaused ? 'Resume Automation' : 'Pause Automation'}
          </button>
        </div>
      </div>

      {/* 2. Page & Token Health Details */}
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
            Facebook Page Credentials & Health
          </h4>
          <p
            style={{
              margin: `${SPACING.xs} 0 0 0`,
              fontSize: '0.875rem',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            Metadata and authentication status securely linked to Facebook Graph API v26.0.
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
                fontFamily: 'monospace',
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
              Authentication Status
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
            The access token for this Facebook Page has expired or requires renewal. Please visit the Facebook Accounts section to refresh the connection.
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
            Detaching this page halts automated scheduling, removes encrypted credentials, and cancels any queued posts waiting to be published.
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

      {/* Disconnect Confirmation Dialog */}
      {isDisconnectDialogOpen && (
        <div
          data-testid="disconnect-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: SPACING.md,
            boxSizing: 'border-box',
          }}
        >
          <div
            data-testid="disconnect-modal"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              borderRadius: RADII.md,
              boxShadow: `var(--shadow-modal, ${THEME.default.shadows.modal})`,
              padding: SPACING.xl,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.md,
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
              Disconnect {page.pageName}?
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.5,
              }}
            >
              This will detach the Facebook Page from your workspace. Queued publications will be cancelled and access tokens will be securely removed.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm }}>
              <button
                type="button"
                data-testid="cancel-disconnect-btn"
                onClick={() => setIsDisconnectDialogOpen(false)}
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
                onClick={handleConfirmDisconnect}
                style={{
                  padding: `${SPACING.xs} ${SPACING.lg}`,
                  borderRadius: RADII.sm,
                  fontSize: '0.875rem',
                  fontWeight: TYPOGRAPHY.weights.semibold,
                  backgroundColor: PALETTE.accent3,
                  color: '#ffffff',
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
      )}
    </div>
  );
}
