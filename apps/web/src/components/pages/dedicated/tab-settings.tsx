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
import { MODAL_BACKDROP_STYLE, MODAL_CONTAINER_STYLE } from './modal-styles';
import type { FacebookPageItem } from '../page-card';

export interface PageTabSettingsProps {
  page: FacebookPageItem;
  subdomain: string;
  onStatusToggle: (nextStatus: 'active' | 'paused') => Promise<void>;
  onDisconnectPage: () => Promise<void>;
}

function getSettingsStatusDetails(status: string) {
  const isPaused = status === 'paused';
  const isNeedsAttention =
    status === 'invalid_token' ||
    status === 'page_checkpoint' ||
    status === 'fb_rate_limited';

  let signal: (typeof STATUS_SIGNALS)[keyof typeof STATUS_SIGNALS] = STATUS_SIGNALS.operational;
  let label = 'Active & Operational';

  if (isNeedsAttention) {
    signal = STATUS_SIGNALS.critical;
    label = 'Re-Authentication Required';
  } else if (isPaused) {
    signal = STATUS_SIGNALS.queued;
    label = 'Automation Paused';
  }

  return { isPaused, isNeedsAttention, statusSignal: signal, statusLabel: label };
}

function getAutomationButtonLabel(isUpdating: boolean, isPaused: boolean): string {
  if (isUpdating) return 'Updating...';
  return isPaused ? 'Resume Automation' : 'Pause Automation';
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

  const { isPaused, isNeedsAttention, statusSignal, statusLabel } = getSettingsStatusDetails(page.status);

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
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <div style={{ fontWeight: TYPOGRAPHY.weights.semibold, fontSize: '0.875rem' }}>
                Facebook Checkpoint Verification Required
              </div>
              <div style={{ fontSize: '0.8125rem', color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
                Facebook requires identity verification in the mobile app or browser before automated publishing can proceed.
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
              padding: `${SPACING.xs} ${SPACING.md}`,
              borderRadius: RADII.sm,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              backgroundColor: PALETTE.primary,
              color: '#000000',
              border: 'none',
              cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isUpdatingStatus ? 'Reactivating...' : 'Mark Verified & Reactivate Page'}
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
            {getAutomationButtonLabel(isUpdatingStatus, isPaused)}
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

      <DisconnectConfirmationDialog
        isOpen={isDisconnectDialogOpen}
        pageName={page.pageName}
        isDisconnecting={isDisconnecting}
        onCancel={() => setIsDisconnectDialogOpen(false)}
        onConfirm={handleConfirmDisconnect}
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
          This will detach the Facebook Page from your workspace. Queued publications will be cancelled and access tokens will be securely removed.
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
  );
}
