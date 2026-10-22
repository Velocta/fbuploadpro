'use client';

import React, { useState } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY } from '@/lib/theme';

export const COPY_FEEDBACK_DURATION_MS = 2000;

/** Shared hover behaviour for the small text buttons in these views. */
export const HOVER_TEXT_HANDLERS = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = `var(--text-main, ${THEME.default.text.primary})`;
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = `var(--text-sub, ${THEME.default.text.secondary})`;
  },
};

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
    } catch (err) {
      // Clipboard unavailable; the address stays visible for manual copying.
      console.error('[PlatformSetupCard] Failed to copy the setup address:', err);
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
              {...HOVER_TEXT_HANDLERS}
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
