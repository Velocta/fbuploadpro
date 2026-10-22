'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, COMPONENT_STYLES } from '@/lib/theme';
import { StatusDot, Button } from '@/components/ui';
import {
  MODAL_BACKDROP_STYLE,
  MODAL_CONTAINER_STYLE,
} from '@/components/pages/dedicated/modal-styles';

/** How long the "copied" feedback stays visible on a copy button. */
const COPY_FEEDBACK_DURATION_MS = 2000;

export type PlatformCredentialStatus = 'unverified' | 'valid' | 'invalid';

export interface PlatformCredentialsState {
  appId: string;
  appSecret?: string | null | undefined;
  hasSecret: boolean;
  status: PlatformCredentialStatus;
  lastTestedAt: string | null;
  connectedAt?: string | null | undefined;
}

export interface PlatformCredentialsConfig {
  /** Platform slug used in the settings address, e.g. "instagram". */
  platform: string;
  /** Platform name shown to the user, e.g. "Instagram". */
  displayName: string;
  /** Label for the ID field, in the platform's own terms, e.g. "Instagram App ID". */
  appIdLabel: string;
  /** Label for the secret field, e.g. "Instagram App Secret". */
  appSecretLabel: string;
  /** Prefix for data-testid values, e.g. "instagram". */
  testIdPrefix: string;
  /** Helper text under the ID field saying where the user finds it. */
  appIdHelper: string;
  /** Number shown on the "Add them here" step, after the guide steps. */
  formStepNumber: number;
}

export interface PlatformCredentialsViewProps {
  subdomain: string;
  config: PlatformCredentialsConfig;
  initialCredentials?: PlatformCredentialsState | null | undefined;
  initialLoading?: boolean | undefined;
  initialEditMode?: boolean | undefined;
  initialShowDisconnectModal?: boolean | undefined;
  /** The platform's setup guide, shown above the form in the not-connected state. */
  children?: React.ReactNode;
  /** Extra card shown under the main card in the form and edit states. */
  setupCard?: React.ReactNode;
}

export function buildPlatformCredentialsUrl(subdomain: string, platform: string): string {
  return `/api/tenant/${subdomain}/settings/platform-credentials/${platform}`;
}

type FetchFn = typeof fetch;

export async function fetchPlatformCredentials(
  subdomain: string,
  platform: string,
  fetchFn: FetchFn = fetch
): Promise<PlatformCredentialsState> {
  const res = await fetchFn(buildPlatformCredentialsUrl(subdomain, platform));
  if (!res.ok) {
    throw new Error(`Could not load ${platform} app details.`);
  }
  const data = (await res.json()) as {
    appId?: string;
    appSecret?: string;
    hasSecret?: boolean;
    status?: PlatformCredentialStatus;
    lastTestedAt?: string | null;
    connectedAt?: string | null;
  };
  return {
    appId: data.appId || '',
    appSecret: data.appSecret || '',
    hasSecret: Boolean(data.hasSecret),
    status: data.status || 'unverified',
    lastTestedAt: data.lastTestedAt ?? null,
    connectedAt: data.connectedAt ?? null,
  };
}

export async function savePlatformCredentials(
  subdomain: string,
  platform: string,
  values: { appId: string; appSecret?: string | undefined },
  fetchFn: FetchFn = fetch
): Promise<{ success: true; hasSecret: boolean; status: PlatformCredentialStatus; connectedAt: string | null }> {
  const payload: { appId: string; appSecret?: string } = { appId: values.appId };
  if (values.appSecret) {
    payload.appSecret = values.appSecret;
  }
  const res = await fetchFn(buildPlatformCredentialsUrl(subdomain, platform), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    hasSecret?: boolean;
    status?: PlatformCredentialStatus;
    connectedAt?: string | null;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Could not save your app details. Please try again.');
  }
  return {
    success: true,
    hasSecret: Boolean(data.hasSecret ?? true),
    status: data.status || 'unverified',
    connectedAt: data.connectedAt ?? null,
  };
}

export async function deletePlatformCredentials(
  subdomain: string,
  platform: string,
  fetchFn: FetchFn = fetch
): Promise<{ success: true; disconnected: boolean }> {
  const res = await fetchFn(buildPlatformCredentialsUrl(subdomain, platform), {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Could not disconnect. Please try again.');
  }
  return { success: true, disconnected: true };
}

export interface PlatformCredentialsValidation {
  valid: boolean;
  appIdError: string | null;
  appSecretError: string | null;
}

export function validatePlatformCredentialsInput(
  appId: string,
  appSecret: string,
  options: { isEditMode: boolean; hasExistingSecret: boolean; appIdLabel: string; appSecretLabel: string }
): PlatformCredentialsValidation {
  const trimmedId = appId.trim();
  const trimmedSecret = appSecret.trim();

  let appIdError: string | null = null;
  if (!trimmedId) {
    appIdError = `Please enter your ${options.appIdLabel}.`;
  } else if (!/^\d{10,20}$/.test(trimmedId)) {
    appIdError = `${options.appIdLabel} must be numeric (10–20 digits).`;
  }

  let appSecretError: string | null = null;
  if (!trimmedSecret && !(options.isEditMode && options.hasExistingSecret)) {
    appSecretError = `Please enter your ${options.appSecretLabel}.`;
  }

  return { valid: !appIdError && !appSecretError, appIdError, appSecretError };
}

export function formatPlatformConnectedDate(dateStr?: string | null): string {
  const fallback = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return fallback;
  }
}

// ============================================================================
// Shared guide building blocks (used by the per-platform setup guides)
// ============================================================================

export function SettingsGuideStep({
  number,
  title,
  children,
}: Readonly<{ number: number; title: string; children: React.ReactNode }>) {
  return (
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
          {number}
        </div>
        <h4
          style={{
            margin: 0,
            fontSize: '0.9375rem',
            fontWeight: TYPOGRAPHY.weights.semibold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {title}
        </h4>
      </div>
      <div
        style={{
          margin: 0,
          paddingLeft: '32px',
          fontSize: '0.875rem',
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          lineHeight: 1.5,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function GuideDivider() {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: `var(--border-subtle, ${THEME.default.borders.hairline})`,
        width: '100%',
      }}
    />
  );
}

export interface SetupAddress {
  key: string;
  label: string;
  url: string;
  helper?: string | undefined;
}

/**
 * The "One more step" card: shows the address (or addresses) the user must
 * paste into the platform's own settings, each with a Copy button.
 */
export function PlatformSetupCard({
  testIdPrefix,
  description,
  addresses,
}: Readonly<{ testIdPrefix: string; description: string; addresses: SetupAddress[] }>) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), COPY_FEEDBACK_DURATION_MS);
    } catch {
      // Clipboard unavailable; the address stays visible for manual copying.
    }
  };

  return (
    <div
      data-testid={`${testIdPrefix}-one-more-step-card`}
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
          {description}
        </p>
      </div>

      {addresses.map((address) => (
        <div key={address.key} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: TYPOGRAPHY.weights.semibold,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: `var(--text-sub, ${THEME.default.text.secondary})`,
            }}
          >
            {address.label}
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACING.sm} 0`,
              borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            }}
          >
            <span
              data-testid={`${testIdPrefix}-setup-address-${address.key}`}
              style={{
                fontFamily: TYPOGRAPHY.mono,
                fontSize: '0.8125rem',
                color: PALETTE.accent1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {address.url}
            </span>
            <button
              type="button"
              data-testid={`${testIdPrefix}-copy-${address.key}-btn`}
              onClick={() => void handleCopy(address.key, address.url)}
              style={{
                background: 'none',
                border: 'none',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                flexShrink: 0,
                marginLeft: SPACING.sm,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
              }}
            >
              {copiedKey === address.key ? 'Copied' : 'Copy'}
            </button>
          </div>
          {address.helper && (
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              {address.helper}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main view (subcomponents mirror the Facebook view's structure)
// ============================================================================

/** Link to the Meta App Dashboard, styled like the Facebook guide's link. */
export function MetaDashboardLink({ testIdPrefix }: Readonly<{ testIdPrefix: string }>) {
  return (
    <a
      href="https://developers.facebook.com"
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`${testIdPrefix}-meta-dashboard-link`}
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
    </a>
  );
}

// ============================================================================
// Subcomponent: Not-connected form (guide slot + "Add them here" step)
// ============================================================================

interface PlatformCredentialsFormProps {
  config: PlatformCredentialsConfig;
  appId: string;
  appSecret: string;
  showSecret: boolean;
  appIdError: string | null;
  appSecretError: string | null;
  isConnecting: boolean;
  isEditMode: boolean;
  onAppIdChange: (value: string) => void;
  onAppSecretChange: (value: string) => void;
  onToggleSecret: () => void;
  onConnect: () => void;
  onCancelEdit: () => void;
  children?: React.ReactNode;
}

function PlatformCredentialsForm({
  config,
  appId,
  appSecret,
  showSecret,
  appIdError,
  appSecretError,
  isConnecting,
  isEditMode,
  onAppIdChange,
  onAppSecretChange,
  onToggleSecret,
  onConnect,
  onCancelEdit,
  children,
}: Readonly<PlatformCredentialsFormProps>) {
  const { displayName, appIdLabel, appSecretLabel, testIdPrefix, appIdHelper, formStepNumber } =
    config;

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: TYPOGRAPHY.weights.semibold,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: `var(--text-sub, ${THEME.default.text.secondary})`,
  };
  const helperStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: `var(--text-dim, ${THEME.default.text.muted})`,
  };
  const hoverTextHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl }}>
      {children}
      {children && <GuideDivider />}

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
            {formStepNumber}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label htmlFor={`${testIdPrefix}-app-id-input`} style={labelStyle}>
              {appIdLabel}
            </label>
            <input
              id={`${testIdPrefix}-app-id-input`}
              data-testid={`${testIdPrefix}-app-id-input`}
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
                data-testid={`${testIdPrefix}-app-id-error`}
                role="alert"
                style={{ fontSize: '0.75rem', color: PALETTE.accent3, marginTop: '2px' }}
              >
                {appIdError}
              </span>
            )}
            <span style={helperStyle}>{appIdHelper}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label htmlFor={`${testIdPrefix}-app-secret-input`} style={labelStyle}>
              {appSecretLabel}
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
                id={`${testIdPrefix}-app-secret-input`}
                data-testid={`${testIdPrefix}-app-secret-input`}
                type={showSecret ? 'text' : 'password'}
                placeholder={`Enter your ${appSecretLabel}`}
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
                data-testid={`${testIdPrefix}-app-secret-toggle`}
                onClick={onToggleSecret}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: `0 ${SPACING.md}`,
                  color: `var(--text-sub, ${THEME.default.text.secondary})`,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  transition: 'color 0.15s ease',
                }}
                {...hoverTextHandlers}
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            {appSecretError && (
              <span
                data-testid={`${testIdPrefix}-app-secret-error`}
                role="alert"
                style={{ fontSize: '0.75rem', color: PALETTE.accent3, marginTop: '2px' }}
              >
                {appSecretError}
              </span>
            )}
            <span style={helperStyle}>
              Only you can see this — it stays hidden until you choose to show it.
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs, marginTop: SPACING.xs }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
              <button
                type="button"
                data-testid={`${testIdPrefix}-connect-btn`}
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
                {isConnecting ? 'Connecting...' : `Connect ${displayName}`}
              </button>
              {isEditMode && (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid={`${testIdPrefix}-cancel-edit-btn`}
                  onClick={onCancelEdit}
                >
                  Cancel
                </Button>
              )}
            </div>
            <span style={helperStyle}>We check everything works the moment you connect.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Subcomponent: Connected details
// ============================================================================

interface PlatformConnectedViewProps {
  config: PlatformCredentialsConfig;
  credentials: PlatformCredentialsState;
  copiedKey: string | null;
  showSecretState2: boolean;
  onCopyAppId: () => void;
  onToggleSecret: () => void;
  onEditDetails: () => void;
  onDisconnectClick: () => void;
}

function PlatformConnectedView({
  config,
  credentials,
  copiedKey,
  showSecretState2,
  onCopyAppId,
  onToggleSecret,
  onEditDetails,
  onDisconnectClick,
}: Readonly<PlatformConnectedViewProps>) {
  const { appIdLabel, appSecretLabel, testIdPrefix } = config;
  const [isDisconnectHovered, setIsDisconnectHovered] = useState(false);

  const labelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: TYPOGRAPHY.weights.semibold,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: `var(--text-sub, ${THEME.default.text.secondary})`,
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${SPACING.sm} 0`,
    borderTop: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
  };
  const smallButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: `var(--text-sub, ${THEME.default.text.secondary})`,
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: TYPOGRAPHY.weights.medium,
    transition: 'color 0.15s ease',
  };
  const hoverTextHandlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.lg }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
        <span style={labelStyle}>{appIdLabel}</span>
        <div style={rowStyle}>
          <span
            data-testid={`${testIdPrefix}-saved-app-id`}
            style={{
              fontFamily: TYPOGRAPHY.mono,
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
            }}
          >
            {credentials.appId}
          </span>
          <button
            type="button"
            data-testid={`${testIdPrefix}-copy-app-id-btn`}
            onClick={onCopyAppId}
            style={smallButtonStyle}
            {...hoverTextHandlers}
          >
            {copiedKey === 'appId' ? 'App ID copied' : 'Copy App ID'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
        <span style={labelStyle}>{appSecretLabel}</span>
        <div style={rowStyle}>
          <span
            data-testid={`${testIdPrefix}-saved-app-secret`}
            style={{
              fontFamily: TYPOGRAPHY.mono,
              fontSize: '0.875rem',
              color: `var(--text-main, ${THEME.default.text.primary})`,
              letterSpacing: showSecretState2 ? 'normal' : '0.15em',
            }}
          >
            {showSecretState2
              ? (credentials.appSecret || '••••••••••••••••••••••••')
              : '••••••••••••••••••••••••'}
          </span>
          <button
            type="button"
            data-testid={`${testIdPrefix}-state2-secret-toggle`}
            onClick={onToggleSecret}
            style={smallButtonStyle}
            {...hoverTextHandlers}
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
          Only you can see this — it stays hidden until you choose to show it.
        </span>
      </div>

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
          data-testid={`${testIdPrefix}-edit-details-btn`}
          onClick={onEditDetails}
        >
          Edit details
        </Button>
        <button
          type="button"
          data-testid={`${testIdPrefix}-disconnect-btn`}
          onClick={onDisconnectClick}
          style={{
            height: '38px',
            padding: `0 ${SPACING.md}`,
            backgroundColor: isDisconnectHovered ? 'rgba(246, 70, 93, 0.08)' : 'transparent',
            color: PALETTE.accent3,
            border: `1px solid ${isDisconnectHovered ? PALETTE.accent3 : 'rgba(246, 70, 93, 0.45)'}`,
            borderRadius: RADII.sm,
            fontWeight: TYPOGRAPHY.weights.semibold,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={() => setIsDisconnectHovered(true)}
          onMouseLeave={() => setIsDisconnectHovered(false)}
        >
          Disconnect
        </button>
      </div>

      <span
        data-testid={`${testIdPrefix}-connected-date`}
        style={{
          fontSize: '0.8125rem',
          color: `var(--text-dim, ${THEME.default.text.muted})`,
        }}
      >
        {`Connected on ${formatPlatformConnectedDate(credentials.connectedAt)}.`}
      </span>
    </div>
  );
}

// ============================================================================
// Subcomponent: Disconnect confirmation modal
// ============================================================================

interface PlatformDisconnectModalProps {
  config: PlatformCredentialsConfig;
  isDisconnecting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function PlatformDisconnectModal({
  config,
  isDisconnecting,
  onClose,
  onConfirm,
}: Readonly<PlatformDisconnectModalProps>) {
  const { displayName, appIdLabel, appSecretLabel, testIdPrefix } = config;
  return (
    <div
      aria-hidden="true"
      data-testid={`${testIdPrefix}-disconnect-modal-backdrop`}
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
        aria-labelledby={`${testIdPrefix}-disconnect-title`}
        data-testid={`${testIdPrefix}-disconnect-modal`}
        style={{
          ...MODAL_CONTAINER_STYLE,
          maxWidth: '480px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <h2
          id={`${testIdPrefix}-disconnect-title`}
          data-testid={`${testIdPrefix}-disconnect-title`}
          style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: TYPOGRAPHY.weights.bold,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          {`Disconnect ${displayName}?`}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          {`We'll remove your ${appIdLabel} and ${appSecretLabel} from this workspace. Your connected accounts and posting will keep working as normal — but you won't be able to reconnect or connect new accounts until you add new details.`}
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
            data-testid={`${testIdPrefix}-disconnect-keep-btn`}
            onClick={onClose}
            disabled={isDisconnecting}
          >
            Keep connected
          </Button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-disconnect-confirm-btn`}
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
// Main view: PlatformCredentialsView
// ============================================================================

export function PlatformCredentialsView({
  subdomain,
  config,
  initialCredentials,
  initialLoading,
  initialEditMode = false,
  initialShowDisconnectModal = false,
  children,
  setupCard,
}: Readonly<PlatformCredentialsViewProps>) {
  const { platform, displayName, appIdLabel, appSecretLabel, testIdPrefix } = config;

  const [credentials, setCredentials] = useState<PlatformCredentialsState | null>(
    initialCredentials ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(
    initialLoading ?? (initialCredentials === undefined)
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(initialEditMode);
  const [showDisconnectModal, setShowDisconnectModal] = useState(initialShowDisconnectModal);

  const [appId, setAppId] = useState(initialCredentials?.appId || '');
  const [appSecret, setAppSecret] = useState(initialCredentials?.appSecret || '');
  const [showSecret, setShowSecret] = useState(false);
  const [showSecretState2, setShowSecretState2] = useState(false);
  const [appIdError, setAppIdError] = useState<string | null>(null);
  const [appSecretError, setAppSecretError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
        const data = await fetchPlatformCredentials(subdomain, platform);
        if (isMounted) {
          setCredentials(data);
          if (data.appId) {
            setAppId(data.appId);
          }
          if (data.appSecret) {
            setAppSecret(data.appSecret);
          }
        }
      } catch {
        // Keep the form usable when saved details cannot be loaded.
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void fetchCredentials();
    return () => {
      isMounted = false;
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [subdomain, platform]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), COPY_FEEDBACK_DURATION_MS);
    } catch {
      // Clipboard unavailable; the value stays visible for manual copying.
    }
  };

  const handleConnect = async () => {
    const validation = validatePlatformCredentialsInput(appId, appSecret, {
      isEditMode,
      hasExistingSecret: Boolean(credentials?.hasSecret),
      appIdLabel,
      appSecretLabel,
    });
    setAppIdError(validation.appIdError);
    setAppSecretError(validation.appSecretError);
    if (!validation.valid) return;

    setIsConnecting(true);
    const trimmedId = appId.trim();
    const trimmedSecret = appSecret.trim();

    try {
      const data = await savePlatformCredentials(subdomain, platform, {
        appId: trimmedId,
        appSecret: trimmedSecret || undefined,
      });

      setCredentials((prev) => ({
        appId: trimmedId,
        appSecret: trimmedSecret || prev?.appSecret || '',
        hasSecret: true,
        status: data.status || 'unverified',
        lastTestedAt: prev?.lastTestedAt ?? null,
        connectedAt: data.connectedAt || prev?.connectedAt || new Date().toISOString(),
      }));

      setAppSecret(trimmedSecret || '');
      setIsEditMode(false);
      showToast(`Your ${displayName} app is connected.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : `Couldn't save your ${displayName} app details. Please try again.`,
        'error'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await deletePlatformCredentials(subdomain, platform);
      setCredentials(null);
      setAppId('');
      setAppSecret('');
      setIsEditMode(false);
      setShowDisconnectModal(false);
      showToast(`Your ${displayName} app has been disconnected.`, 'success');
    } catch {
      showToast(`Couldn't disconnect ${displayName}. Please try again.`, 'error');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const hasSavedCredentials = Boolean(credentials?.appId && credentials?.hasSecret);
  const isConnectedState = hasSavedCredentials && !isEditMode;

  const searchParams = useSearchParams();
  const showReconnectNotice = searchParams.get('notice') === 'reconnect';

  if (isLoading) {
    return (
      <div
        data-testid={`${testIdPrefix}-loading`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          padding: SPACING.xl,
          color: `var(--text-sub, ${THEME.default.text.secondary})`,
          fontSize: '0.875rem',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '16px',
            height: '16px',
            borderRadius: RADII.full,
            border: `2px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
            borderTopColor: PALETTE.primary,
            animation: 'spin 0.8s linear infinite',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span>{`Loading your ${displayName} app details…`}</span>
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
      {toast && (
        <output
          data-testid={`${testIdPrefix}-toast`}
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

      {showReconnectNotice && (
        <div
          data-testid={`${testIdPrefix}-reconnect-notice`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            padding: `${SPACING.sm} ${SPACING.md}`,
            backgroundColor: 'rgba(250, 215, 52, 0.08)',
            border: '1px solid rgba(250, 215, 52, 0.25)',
            borderRadius: RADII.sm,
            fontSize: '0.875rem',
            lineHeight: 1.5,
            color: `var(--text-main, ${THEME.default.text.primary})`,
          }}
        >
          <span>
            {`${displayName} requires an app to reconnect accounts. Add your ${appIdLabel} and ${appSecretLabel} below, then reconnect.`}
          </span>
        </div>
      )}

      <div
        data-testid={`${testIdPrefix}-settings-card`}
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
              {`Connect ${displayName}`}
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
                ? `Your ${displayName} app is linked and publishing is ready to go.`
                : `Link your ${displayName} app to start publishing from this workspace.`}
            </p>
          </div>

          <div data-testid={`${testIdPrefix}-status-badge`} style={{ flexShrink: 0 }}>
            <StatusDot
              status={isConnectedState ? 'operational' : 'queued'}
              label={isConnectedState ? 'Connected' : 'Not connected'}
            />
          </div>
        </div>

        {!isConnectedState && (
          <PlatformCredentialsForm
            config={config}
            appId={appId}
            appSecret={appSecret}
            showSecret={showSecret}
            appIdError={appIdError}
            appSecretError={appSecretError}
            isConnecting={isConnecting}
            isEditMode={isEditMode}
            onAppIdChange={(val) => {
              setAppId(val);
              if (appIdError) setAppIdError(null);
            }}
            onAppSecretChange={(val) => {
              setAppSecret(val);
              if (appSecretError) setAppSecretError(null);
            }}
            onToggleSecret={() => setShowSecret((prev) => !prev)}
            onConnect={() => void handleConnect()}
            onCancelEdit={() => {
              setIsEditMode(false);
              setAppId(credentials?.appId || '');
              setAppSecret(credentials?.appSecret || '');
              setAppIdError(null);
              setAppSecretError(null);
            }}
          >
            {children}
          </PlatformCredentialsForm>
        )}

        {isConnectedState && credentials && (
          <PlatformConnectedView
            config={config}
            credentials={credentials}
            copiedKey={copiedKey}
            showSecretState2={showSecretState2}
            onCopyAppId={() => void handleCopy('appId', credentials.appId || '')}
            onToggleSecret={() => setShowSecretState2((prev) => !prev)}
            onEditDetails={() => {
              setAppId(credentials.appId || '');
              setAppSecret(credentials.appSecret || '');
              setAppIdError(null);
              setAppSecretError(null);
              setIsEditMode(true);
            }}
            onDisconnectClick={() => setShowDisconnectModal(true)}
          />
        )}
      </div>

      {(!hasSavedCredentials || isEditMode) && setupCard}

      {showDisconnectModal && (
        <PlatformDisconnectModal
          config={config}
          isDisconnecting={isDisconnecting}
          onClose={() => setShowDisconnectModal(false)}
          onConfirm={() => void handleDisconnect()}
        />
      )}
    </div>
  );
}
