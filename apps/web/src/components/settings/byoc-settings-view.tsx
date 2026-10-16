'use client';

import React, { useState, useEffect, useRef } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { StatusDot, Button } from '@/components/ui';
import {
  MODAL_BACKDROP_STYLE,
  MODAL_CONTAINER_STYLE,
} from '@/components/pages/dedicated/modal-styles';
import type { BYOCStatus } from '@fbuploadpro/contracts';

export interface BYOCSettingsViewProps {
  subdomain: string;
  initialCredentials?: CredentialsState | null | undefined;
  initialLoading?: boolean | undefined;
  initialEditMode?: boolean | undefined;
  initialShowDisconnectModal?: boolean | undefined;
}

export interface CredentialsState {
  workspaceId: string;
  subdomain: string;
  fbAppId: string;
  hasSecret: boolean;
  status: BYOCStatus;
  lastTestedAt: string | null;
  connectedAt?: string | null | undefined;
}

function formatConnectedDate(dateStr?: string | null): string {
  if (!dateStr) return 'Oct 16, 2026';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Oct 16, 2026';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Oct 16, 2026';
  }
}

// ============================================================================
// Subcomponent: State 1 Form (Numbered Steps)
// ============================================================================

interface FacebookNotConnectedFormProps {
  appId: string;
  appSecret: string;
  showSecret: boolean;
  appIdError: string | null;
  appSecretError: string | null;
  isConnecting: boolean;
  isEditMode: boolean;
  hasExistingSecret: boolean;
  onAppIdChange: (value: string) => void;
  onAppSecretChange: (value: string) => void;
  onToggleSecret: () => void;
  onConnect: () => void;
  onCancelEdit: () => void;
}

function FacebookNotConnectedForm({
  appId,
  appSecret,
  showSecret,
  appIdError,
  appSecretError,
  isConnecting,
  isEditMode,
  hasExistingSecret,
  onAppIdChange,
  onAppSecretChange,
  onToggleSecret,
  onConnect,
  onCancelEdit,
}: Readonly<FacebookNotConnectedFormProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {/* Step 1 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <div
            aria-hidden="true"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: RADII.full,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              flexShrink: 0,
            }}
          >
            1
          </div>
          <h4
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Get your app details
          </h4>
        </div>
        <p
          style={{
            margin: 0,
            paddingLeft: '32px',
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.5,
          }}
        >
          Open your{' '}
          <a
            href="https://developers.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="fb-meta-dashboard-link"
            style={{
              color: PALETTE.accent1,
              fontWeight: TYPOGRAPHY.weights.semibold,
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            Meta App Dashboard →
          </a>{' '}
          and copy your App ID and App Secret from Settings → Basic.
        </p>
      </div>

      {/* Hairline Divider */}
      <div
        style={{
          height: '1px',
          backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
          width: '100%',
        }}
      />

      {/* Step 2 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <div
            aria-hidden="true"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: RADII.full,
              border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
              backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              flexShrink: 0,
            }}
          >
            2
          </div>
          <h4
            style={{
              margin: 0,
              fontSize: '0.9375rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            Add them here
          </h4>
        </div>

        <div style={{ paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
          {/* APP ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="fb-app-id-input"
              style={{
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              APP ID
            </label>
            <input
              id="fb-app-id-input"
              data-testid="fb-app-id-input"
              type="text"
              placeholder="e.g. 123456789012345"
              value={appId}
              onChange={(e) => onAppIdChange(e.target.value)}
              disabled={isConnecting}
              style={{
                height: '38px',
                width: '100%',
                padding: `0 ${SPACING.md}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: `1px solid ${
                  appIdError ? PALETTE.accent3 : `var(--border-subtle, ${THEME.default.borders.hairline})`
                }`,
                borderRadius: RADII.sm,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
            />
            {appIdError && (
              <span
                data-testid="fb-app-id-error"
                role="alert"
                style={{ fontSize: '0.75rem', color: PALETTE.accent3, marginTop: '2px' }}
              >
                {appIdError}
              </span>
            )}
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              You&apos;ll find this in your Meta app under Settings → Basic.
            </span>
          </div>

          {/* APP SECRET */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="fb-app-secret-input"
              style={{
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              APP SECRET
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: `1px solid ${
                  appSecretError ? PALETTE.accent3 : `var(--border-subtle, ${THEME.default.borders.hairline})`
                }`,
                borderRadius: RADII.sm,
                overflow: 'hidden',
                transition: 'border-color 0.15s ease',
              }}
            >
              <input
                id="fb-app-secret-input"
                data-testid="fb-app-secret-input"
                type={showSecret ? 'text' : 'password'}
                placeholder={
                  isEditMode && hasExistingSecret ? '••••••••••••••••••••••••' : 'Enter your App Secret'
                }
                value={appSecret}
                onChange={(e) => onAppSecretChange(e.target.value)}
                disabled={isConnecting}
                style={{
                  flex: 1,
                  height: '38px',
                  padding: `0 ${SPACING.md}`,
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                  fontSize: '0.875rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                data-testid="fb-app-secret-toggle"
                onClick={onToggleSecret}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: `0 ${SPACING.md}`,
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                }}
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            {appSecretError && (
              <span
                data-testid="fb-app-secret-error"
                role="alert"
                style={{ fontSize: '0.75rem', color: PALETTE.accent3, marginTop: '2px' }}
              >
                {appSecretError}
              </span>
            )}
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              Only you can see this — we keep it safe and never show it again.
            </span>
          </div>

          {/* Primary Action Button & Sub-button Helper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, marginTop: SPACING.xs }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <button
                type="button"
                data-testid="fb-connect-btn"
                onClick={onConnect}
                disabled={isConnecting}
                style={{
                  ...COMPONENT_STYLES.primaryButton,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: `0 ${SPACING.xl}`,
                  cursor: isConnecting ? 'not-allowed' : 'pointer',
                  opacity: isConnecting ? 0.7 : 1,
                }}
              >
                {isConnecting ? 'Connecting...' : 'Connect Facebook'}
              </button>
              {isEditMode && (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="fb-cancel-edit-btn"
                  onClick={onCancelEdit}
                >
                  Cancel
                </Button>
              )}
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              We check everything works the moment you connect.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponent: State 2 Connected Details
// ============================================================================

interface FacebookConnectedViewProps {
  fbAppId: string;
  connectedAt?: string | null | undefined;
  copiedKey: string | null;
  showSecretState2: boolean;
  onCopyAppId: () => void;
  onToggleSecret: () => void;
  onEditDetails: () => void;
  onDisconnectClick: () => void;
}

function FacebookConnectedView({
  fbAppId,
  connectedAt,
  copiedKey,
  showSecretState2,
  onCopyAppId,
  onToggleSecret,
  onEditDetails,
  onDisconnectClick,
}: Readonly<FacebookConnectedViewProps>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
      {/* APP ID */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          APP ID
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            borderRadius: RADII.sm,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          }}
        >
          <span
            data-testid="fb-saved-app-id"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {fbAppId}
          </span>
          <button
            type="button"
            data-testid="fb-copy-app-id-btn"
            onClick={onCopyAppId}
            style={{
              background: 'none',
              border: 'none',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.medium,
            }}
          >
            {copiedKey === 'appId' ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* APP SECRET */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          APP SECRET
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            borderRadius: RADII.sm,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          }}
        >
          <span
            data-testid="fb-saved-app-secret"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              letterSpacing: '0.15em',
            }}
          >
            ••••••••••••••••••••••••
          </span>
          <button
            type="button"
            data-testid="fb-state2-secret-toggle"
            onClick={onToggleSecret}
            style={{
              background: 'none',
              border: 'none',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.medium,
            }}
          >
            {showSecretState2 ? 'Hide' : 'Show'}
          </button>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
          }}
        >
          Only you can see this — we keep it safe and never show it again.
        </span>
      </div>

      {/* Action Buttons: Edit details & Disconnect */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          marginTop: SPACING.xs,
          flexWrap: 'wrap',
        }}
      >
        <Button
          type="button"
          variant="secondary"
          data-testid="fb-edit-details-btn"
          onClick={onEditDetails}
        >
          Edit details
        </Button>
        <button
          type="button"
          data-testid="fb-disconnect-btn"
          onClick={onDisconnectClick}
          style={{
            height: '38px',
            padding: `0 ${SPACING.md}`,
            backgroundColor: 'transparent',
            color: PALETTE.accent3,
            border: '1px solid rgba(246, 70, 93, 0.45)',
            borderRadius: RADII.sm,
            fontWeight: TYPOGRAPHY.weights.semibold,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(246, 70, 93, 0.08)';
            e.currentTarget.style.borderColor = PALETTE.accent3;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(246, 70, 93, 0.45)';
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Connection Timestamp Line */}
      <span
        data-testid="fb-connected-date"
        style={{
          fontSize: '0.8125rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        Connected on {formatConnectedDate(connectedAt)}.
      </span>
    </div>
  );
}

// ============================================================================
// Subcomponent: Second Card ("One more step")
// ============================================================================

interface FacebookSetupCardProps {
  callbackUrl: string;
  copiedKey: string | null;
  onCopyCallback: () => void;
}

function FacebookSetupCard({
  callbackUrl,
  copiedKey,
  onCopyCallback,
}: Readonly<FacebookSetupCardProps>) {
  return (
    <div
      data-testid="fb-one-more-step-card"
      style={{
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
        padding: SPACING.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
            letterSpacing: TYPOGRAPHY.tracking.h3,
          }}
        >
          One more step
        </h3>
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.875rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
            lineHeight: 1.5,
          }}
        >
          Add this address to your Meta app so Facebook can bring you back here after you sign in.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
        <label
          htmlFor="fb-callback-url-display"
          style={{
            fontSize: '0.75rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          SIGN-IN ADDRESS
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACING.sm} ${SPACING.md}`,
            backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
            borderRadius: RADII.sm,
            border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          }}
        >
          <span
            id="fb-callback-url-display"
            data-testid="fb-signin-address"
            style={{
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              color: PALETTE.accent1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {callbackUrl}
          </span>
          <button
            type="button"
            data-testid="fb-copy-callback-btn"
            onClick={onCopyCallback}
            style={{
              background: 'none',
              border: 'none',
              color: `var(--text-dim, ${THEME.default.text.muted})`,
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.medium,
              flexShrink: 0,
              marginLeft: SPACING.sm,
            }}
          >
            {copiedKey === 'callback' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            color: `var(--text-dim, ${THEME.default.text.muted})`,
          }}
        >
          Paste this into the &quot;Valid OAuth Redirect URIs&quot; field in your Meta app.
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponent: Disconnect Confirmation Modal
// ============================================================================

interface FacebookDisconnectModalProps {
  isDisconnecting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function FacebookDisconnectModal({
  isDisconnecting,
  onClose,
  onConfirm,
}: Readonly<FacebookDisconnectModalProps>) {
  return (
    <div
      aria-hidden="true"
      data-testid="fb-disconnect-modal-backdrop"
      style={MODAL_BACKDROP_STYLE}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'default',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fb-disconnect-title"
        data-testid="fb-disconnect-modal"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '480px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h2
          id="fb-disconnect-title"
          data-testid="fb-disconnect-title"
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Disconnect Facebook?
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          We&apos;ll remove your App ID and App Secret from this workspace. Your connected accounts and posting will keep working as normal — but you won&apos;t be able to reconnect or connect new accounts until you add new details.
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: SPACING.sm,
            marginTop: SPACING.sm,
          }}
        >
          <Button
            type="button"
            variant="secondary"
            data-testid="fb-disconnect-keep-btn"
            onClick={onClose}
            disabled={isDisconnecting}
          >
            Keep connected
          </Button>
          <button
            type="button"
            data-testid="fb-disconnect-confirm-btn"
            onClick={onConfirm}
            disabled={isDisconnecting}
            style={{
              height: '38px',
              padding: `0 ${SPACING.md}`,
              backgroundColor: PALETTE.accent3,
              color: PALETTE.text,
              border: 'none',
              borderRadius: RADII.sm,
              fontWeight: TYPOGRAPHY.weights.semibold,
              fontSize: '0.875rem',
              cursor: isDisconnecting ? 'not-allowed' : 'pointer',
              opacity: isDisconnecting ? 0.7 : 1,
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.25)',
            }}
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main View: BYOCSettingsView
// ============================================================================

export function BYOCSettingsView({
  subdomain,
  initialCredentials,
  initialLoading,
  initialEditMode = false,
  initialShowDisconnectModal = false,
}: Readonly<BYOCSettingsViewProps>) {
  const [credentials, setCredentials] = useState<CredentialsState | null>(initialCredentials ?? null);
  const [isLoading, setIsLoading] = useState<boolean>(
    initialLoading ?? (initialCredentials === undefined)
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [showDisconnectModal, setShowDisconnectModal] = useState(initialShowDisconnectModal);

  // Form field state
  const [appId, setAppId] = useState(initialCredentials?.fbAppId || '');
  const [appSecret, setAppSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showSecretState2, setShowSecretState2] = useState(false);
  const [appIdError, setAppIdError] = useState<string | null>(null);
  const [appSecretError, setAppSecretError] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clipboard state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://fbuploadpro.com';

  const callbackUrl = `${origin}/api/auth/facebook/callback`;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    let isMounted = true;
    async function fetchCredentials() {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/settings/byoc`);
        if (res.ok) {
          const data: CredentialsState = await res.json();
          if (isMounted) {
            setCredentials(data);
            if (data.fbAppId) {
              setAppId(data.fbAppId);
            }
          }
        }
      } catch {
        // Ignore fetch errors
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void fetchCredentials();
    return () => {
      isMounted = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [subdomain]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const validateInputs = (): boolean => {
    const trimmedId = appId.trim();
    const trimmedSecret = appSecret.trim();

    let valid = true;
    if (!trimmedId) {
      setAppIdError('Please enter your App ID.');
      valid = false;
    } else if (!/^\d{10,20}$/.test(trimmedId)) {
      setAppIdError('App ID must be numeric (10–20 digits).');
      valid = false;
    } else {
      setAppIdError(null);
    }

    if (!trimmedSecret && !(isEditMode && credentials?.hasSecret)) {
      setAppSecretError('Please enter your App Secret.');
      valid = false;
    } else {
      setAppSecretError(null);
    }

    return valid;
  };

  const handleConnect = async () => {
    if (!validateInputs()) return;

    setIsConnecting(true);
    const trimmedId = appId.trim();
    const trimmedSecret = appSecret.trim();

    try {
      const payload: { fbAppId: string; fbAppSecret?: string } = {
        fbAppId: trimmedId,
      };
      if (trimmedSecret) {
        payload.fbAppSecret = trimmedSecret;
      }

      const res = await fetch(`/api/tenant/${subdomain}/settings/byoc`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to save credentials.', 'error');
        return;
      }

      setCredentials((prev) => ({
        workspaceId: prev?.workspaceId || '',
        subdomain,
        fbAppId: trimmedId,
        hasSecret: true,
        status: data.status || 'unverified',
        lastTestedAt: data.lastTestedAt || null,
        connectedAt: data.connectedAt || prev?.connectedAt || new Date().toISOString(),
      }));

      setAppSecret('');
      setIsEditMode(false);
      showToast('Facebook connected.', 'success');
    } catch {
      showToast('Network error while connecting Facebook.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      const res = await fetch(`/api/tenant/${subdomain}/settings/byoc`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setCredentials(null);
        setAppId('');
        setAppSecret('');
        setIsEditMode(false);
        setShowDisconnectModal(false);
        showToast('Facebook disconnected.', 'success');
      } else {
        showToast('Failed to disconnect Facebook.', 'error');
      }
    } catch {
      showToast('Network error while disconnecting Facebook.', 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const hasSavedCredentials = Boolean(credentials?.fbAppId && credentials?.hasSecret);
  const isConnectedState = hasSavedCredentials && !isEditMode;

  if (isLoading) {
    return (
      <div style={{ padding: SPACING.xl, color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
        Loading credentials configuration...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        maxWidth: '780px',
        width: '100%',
      }}
    >
      {/* Toast Notification Banner using <output> */}
      {toast && (
        <output
          data-testid="facebook-toast"
          style={{
            padding: `${SPACING.sm} ${SPACING.md}`,
            backgroundColor:
              toast.type === 'success' ? 'rgba(46, 189, 133, 0.15)' : 'rgba(246, 70, 93, 0.15)',
            border: `1px solid ${toast.type === 'success' ? PALETTE.accent4 : PALETTE.accent3}`,
            borderRadius: RADII.sm,
            color: toast.type === 'success' ? PALETTE.accent4 : PALETTE.accent3,
            fontSize: '0.875rem',
            fontWeight: TYPOGRAPHY.weights.medium,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACING.sm,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            aria-label="Close notification"
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 0,
              fontSize: '1rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </output>
      )}

      {/* Card 1: Connect Facebook */}
      <div
        data-testid="facebook-settings-card"
        style={{
          backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
          border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
          borderRadius: RADII.md,
          boxShadow: `var(--shadow-card, ${THEME.default.shadows.card})`,
          padding: SPACING.xl,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.xl,
        }}
      >
        {/* Header with Title, Subtext, and Status Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
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
                letterSpacing: TYPOGRAPHY.tracking.h3,
              }}
            >
              Connect Facebook
            </h3>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.875rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.5,
              }}
            >
              {isConnectedState
                ? 'Your Facebook app is linked and publishing is ready to go.'
                : 'Link your Facebook app to start publishing from this workspace.'}
            </p>
          </div>

          <div data-testid="facebook-status-badge" style={{ flexShrink: 0 }}>
            <StatusDot
              status={isConnectedState ? 'operational' : 'queued'}
              label={isConnectedState ? 'Connected' : 'Not connected'}
            />
          </div>
        </div>

        {/* STATE 1: Setup Form (Numbered Steps) */}
        {!isConnectedState && (
          <FacebookNotConnectedForm
            appId={appId}
            appSecret={appSecret}
            showSecret={showSecret}
            appIdError={appIdError}
            appSecretError={appSecretError}
            isConnecting={isConnecting}
            isEditMode={isEditMode}
            hasExistingSecret={Boolean(credentials?.hasSecret)}
            onAppIdChange={(val) => {
              setAppId(val);
              if (appIdError) setAppIdError(null);
            }}
            onAppSecretChange={(val) => {
              setAppSecret(val);
              if (appSecretError) setAppSecretError(null);
            }}
            onToggleSecret={() => setShowSecret((prev) => !prev)}
            onConnect={handleConnect}
            onCancelEdit={() => {
              setIsEditMode(false);
              setAppId(credentials?.fbAppId || '');
              setAppSecret('');
              setAppIdError(null);
              setAppSecretError(null);
            }}
          />
        )}

        {/* STATE 2: Connected Summary View */}
        {isConnectedState && (
          <FacebookConnectedView
            fbAppId={credentials?.fbAppId || ''}
            connectedAt={credentials?.connectedAt ?? null}
            copiedKey={copiedKey}
            showSecretState2={showSecretState2}
            onCopyAppId={() => handleCopy('appId', credentials?.fbAppId || '')}
            onToggleSecret={() => setShowSecretState2((prev) => !prev)}
            onEditDetails={() => {
              setAppId(credentials?.fbAppId || '');
              setAppSecret('');
              setAppIdError(null);
              setAppSecretError(null);
              setIsEditMode(true);
            }}
            onDisconnectClick={() => setShowDisconnectModal(true)}
          />
        )}
      </div>

      {/* Card 2: "One more step" (Shown ONLY in State 1 and Edit Mode) */}
      {(!hasSavedCredentials || isEditMode) && (
        <FacebookSetupCard
          callbackUrl={callbackUrl}
          copiedKey={copiedKey}
          onCopyCallback={() => handleCopy('callback', callbackUrl)}
        />
      )}

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectModal && (
        <FacebookDisconnectModal
          isDisconnecting={isDisconnecting}
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={handleDisconnect}
        />
      )}
    </div>
  );
}

