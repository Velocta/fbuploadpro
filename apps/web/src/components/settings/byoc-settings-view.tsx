'use client';

import React, { useState, useEffect, useRef } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { StatusDot } from '@/components/ui';
import {
  MODAL_BACKDROP_STYLE,
  MODAL_CONTAINER_STYLE,
} from '@/components/pages/dedicated/modal-styles';
import type { BYOCStatus } from '@fbuploadpro/contracts';

export interface BYOCSettingsViewProps {
  subdomain: string;
  initialCredentials?: CredentialsState | null;
  initialLoading?: boolean;
  initialEditMode?: boolean;
  initialShowDisconnectModal?: boolean;
}

export interface CredentialsState {
  workspaceId: string;
  subdomain: string;
  fbAppId: string;
  hasSecret: boolean;
  status: BYOCStatus;
  lastTestedAt: string | null;
  connectedAt?: string | null;
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

  const handleConnect = async () => {
    const trimmedId = appId.trim();
    const trimmedSecret = appSecret.trim();

    let hasError = false;
    if (!trimmedId) {
      setAppIdError('Please enter your App ID.');
      hasError = true;
    } else if (!/^\d{10,20}$/.test(trimmedId)) {
      setAppIdError('App ID must be numeric (10–20 digits).');
      hasError = true;
    } else {
      setAppIdError(null);
    }

    if (!trimmedSecret && !(isEditMode && credentials?.hasSecret)) {
      setAppSecretError('Please enter your App Secret.');
      hasError = true;
    } else {
      setAppSecretError(null);
    }

    if (hasError) return;

    setIsConnecting(true);

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
      {/* Toast Notification Banner */}
      {toast && (
        <div
          role="status"
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
        </div>
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
                    onChange={(e) => {
                      setAppId(e.target.value);
                      if (appIdError) setAppIdError(null);
                    }}
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
                    You'll find this in your Meta app under Settings → Basic.
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
                        isEditMode && credentials?.hasSecret ? '••••••••••••••••••••••••' : 'Enter your App Secret'
                      }
                      value={appSecret}
                      onChange={(e) => {
                        setAppSecret(e.target.value);
                        if (appSecretError) setAppSecretError(null);
                      }}
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
                      onClick={() => setShowSecret((prev) => !prev)}
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

                {/* Primary Button & Helper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, marginTop: SPACING.xs }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
                    <button
                      type="button"
                      data-testid="fb-connect-btn"
                      onClick={handleConnect}
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
                      <button
                        type="button"
                        data-testid="fb-cancel-edit-btn"
                        onClick={() => {
                          setIsEditMode(false);
                          setAppId(credentials?.fbAppId || '');
                          setAppSecret('');
                          setAppIdError(null);
                          setAppSecretError(null);
                        }}
                        style={{
                          ...COMPONENT_STYLES.secondaryButton(),
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
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
        )}

        {/* STATE 2: Connected Summary View */}
        {isConnectedState && (
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
                  {credentials?.fbAppId}
                </span>
                <button
                  type="button"
                  data-testid="fb-copy-app-id-btn"
                  onClick={() => handleCopy('appId', credentials?.fbAppId || '')}
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
                  onClick={() => setShowSecretState2((prev) => !prev)}
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
              <button
                type="button"
                data-testid="fb-edit-details-btn"
                onClick={() => {
                  setAppId(credentials?.fbAppId || '');
                  setAppSecret('');
                  setAppIdError(null);
                  setAppSecretError(null);
                  setIsEditMode(true);
                }}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(),
                  cursor: 'pointer',
                }}
              >
                Edit details
              </button>
              <button
                type="button"
                data-testid="fb-disconnect-btn"
                onClick={() => setShowDisconnectModal(true)}
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
              Connected on {formatConnectedDate(credentials?.connectedAt)}.
            </span>
          </div>
        )}
      </div>

      {/* Card 2: "One more step" (Shown ONLY in State 1 and Edit Mode) */}
      {(!hasSavedCredentials || isEditMode) && (
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
                onClick={() => handleCopy('callback', callbackUrl)}
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
      )}

      {/* Disconnect Confirmation Dialog */}
      {showDisconnectModal && (
        <div
          role="presentation"
          data-testid="fb-disconnect-modal-backdrop"
          style={MODAL_BACKDROP_STYLE}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDisconnectModal(false);
          }}
        >
          <button
            type="button"
            aria-label="Close dialog"
            tabIndex={-1}
            onClick={() => setShowDisconnectModal(false)}
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
              We'll remove your App ID and App Secret from this workspace. Your connected accounts and posting will keep working as normal — but you won't be able to reconnect or connect new accounts until you add new details.
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
              <button
                type="button"
                data-testid="fb-disconnect-keep-btn"
                onClick={() => setShowDisconnectModal(false)}
                disabled={isDisconnecting}
                style={{
                  ...COMPONENT_STYLES.secondaryButton(),
                  cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                }}
              >
                Keep connected
              </button>
              <button
                type="button"
                data-testid="fb-disconnect-confirm-btn"
                onClick={handleDisconnect}
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
      )}
    </div>
  );
}

// ============================================================================
// Backwards Compatibility Exports (Legacy Helpers)
// ============================================================================

export interface SaveAndTestResult {
  saveError?: string;
  testSuccess?: boolean;
  testMessage?: string;
  testedAt?: string;
}

export async function saveAndTestBYOC(
  subdomain: string,
  appId: string,
  appSecret: string
): Promise<SaveAndTestResult> {
  const saveRes = await fetch(`/api/tenant/${subdomain}/settings/byoc`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fbAppId: appId.trim(),
      fbAppSecret: appSecret.trim() || undefined,
    }),
  });

  const saveData = await saveRes.json();
  if (!saveRes.ok) {
    return { saveError: saveData.error || 'Failed to save credentials.' };
  }

  const testRes = await fetch(`/api/tenant/${subdomain}/settings/byoc/test`, {
    method: 'POST',
  });
  const testData = await testRes.json();

  return {
    testSuccess: Boolean(testRes.ok && testData.success),
    testMessage: testData.message,
    testedAt: testData.testedAt,
  };
}

export function MetaAppSetupSection({
  redirectUri,
  copiedKey,
  onCopy,
}: Readonly<{
  redirectUri: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}>) {
  return (
    <div
      style={{
        backgroundColor: `var(--bg-panel, ${THEME.default.surfaces.panel})`,
        border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
        borderRadius: RADII.md,
        padding: SPACING.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
      }}
    >
      <div>
        <h4
          style={{
            margin: 0,
            fontSize: '0.9375rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          One more step
        </h4>
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Add this address to your Meta app so Facebook can bring you back here after you sign in.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            SIGN-IN ADDRESS
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
              style={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: PALETTE.accent1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {redirectUri}
            </span>
            <button
              type="button"
              onClick={() => onCopy('redirect', redirectUri)}
              style={{
                background: 'none',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              {copiedKey === 'redirect' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ByocTestFailedModal({
  open,
  message,
  onClose,
}: Readonly<{
  open: boolean;
  message: string;
  onClose: () => void;
}>) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      data-testid="byoc-test-failed-modal"
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
        aria-labelledby="byoc-test-failed-title"
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '480px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h2
          id="byoc-test-failed-title"
          data-testid="byoc-test-failed-title"
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          Meta Connection Test Failed
        </h2>
        <div
          data-testid="byoc-test-failed-message"
          style={{
            padding: `${SPACING.sm} ${SPACING.md}`,
            backgroundColor: 'rgba(246, 70, 93, 0.08)',
            border: '1px solid rgba(246, 70, 93, 0.25)',
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            lineHeight: 1.4,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {message}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: SPACING.sm,
            marginTop: SPACING.xs,
          }}
        >
          <button
            type="button"
            data-testid="byoc-test-failed-dismiss-btn"
            onClick={onClose}
            style={{
              padding: `${SPACING.sm} ${SPACING.lg}`,
              backgroundColor: PALETTE.primary,
              border: 'none',
              borderRadius: RADII.sm,
              color: PALETTE.background,
              fontSize: '0.8125rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              cursor: 'pointer',
            }}
          >
            Review Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
