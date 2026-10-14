'use client';

import React, { useState, useEffect } from 'react';
import { THEME, PALETTE, RADII, SPACING, TYPOGRAPHY, STATUS_SIGNALS } from '@/lib/theme';
import { StatusDot } from '@/components/ui';
import {
  MODAL_BACKDROP_STYLE,
  MODAL_CONTAINER_STYLE,
} from '@/components/pages/dedicated/modal-styles';
import type { BYOCStatus } from '@fbuploadpro/contracts';

export interface BYOCSettingsViewProps {
  subdomain: string;
}

interface CredentialsState {
  workspaceId: string;
  subdomain: string;
  fbAppId: string;
  hasSecret: boolean;
  status: BYOCStatus;
  lastTestedAt: string | null;
}

function getStatusDetails(status: BYOCStatus) {
  if (status === 'valid') {
    return {
      label: 'Verified & Connected',
      statusType: 'operational' as const,
      signal: STATUS_SIGNALS.operational,
    };
  }
  if (status === 'invalid') {
    return {
      label: 'Verification Failed',
      statusType: 'critical' as const,
      signal: STATUS_SIGNALS.critical,
    };
  }
  return {
    label: 'Unverified Credentials',
    statusType: 'queued' as const,
    signal: STATUS_SIGNALS.queued,
  };
}

interface MetaAppSetupSectionProps {
  redirectUri: string;
  webhookUrl: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}

function MetaAppSetupSection({
  redirectUri,
  webhookUrl,
  copiedKey,
  onCopy,
}: Readonly<MetaAppSetupSectionProps>) {
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
          Meta Developer App Setup
        </h4>
        <p
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: '0.8125rem',
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Copy these configuration parameters into your Meta Developer App Dashboard (`developers.facebook.com`).
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
        {/* Valid OAuth Redirect URI */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            Valid OAuth Redirect URI
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
                color: `var(--text-main, ${THEME.default.text.primary})`,
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

        {/* Webhook Callback URL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
          <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            Webhook Callback URL
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
                color: `var(--text-main, ${THEME.default.text.primary})`,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {webhookUrl}
            </span>
            <button
              type="button"
              onClick={() => onCopy('webhook', webhookUrl)}
              style={{
                background: 'none',
                border: 'none',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              {copiedKey === 'webhook' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Required Permissions Checklist */}
        <div style={{ marginTop: SPACING.xs }}>
          <span style={{ fontSize: '0.75rem', color: `var(--text-dim, ${THEME.default.text.muted})` }}>
            Required Meta App Permissions
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs }}>
            {['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'business_management'].map((perm) => (
              <span
                key={perm}
                style={{
                  padding: `2px ${SPACING.sm}`,
                  borderRadius: RADII.xs,
                  backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                  border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                  fontFamily: 'monospace',
                  fontSize: '0.6875rem',
                  color: PALETTE.primary,
                }}
              >
                {perm}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ByocTestFailedModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export function ByocTestFailedModal({
  open,
  message,
  onClose,
}: Readonly<ByocTestFailedModalProps>) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: RADII.sm,
              backgroundColor: 'rgba(246, 70, 93, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={PALETTE.accent3}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
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
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
              }}
            >
              Meta Graph API rejected your credentials
            </p>
          </div>
        </div>

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

        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            color: `var(--text-sub, ${THEME.default.text.secondary})`,
          }}
        >
          Your credentials were saved, but account connections and publishing will remain blocked until Meta credentials are verified. Please check your App ID and App Secret in your Meta Developer portal.
        </p>

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

export function BYOCSettingsView({ subdomain }: Readonly<BYOCSettingsViewProps>) {
  const [credentials, setCredentials] = useState<CredentialsState | null>(null);
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testFailurePrompt, setTestFailurePrompt] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: '' });

  const rootDomain =
    typeof window !== 'undefined' && window.location.host
      ? window.location.host
      : 'fbuploadpro.com';

  const redirectUri = `https://${rootDomain}/api/auth/facebook/callback`;
  const webhookUrl = `https://${rootDomain}/api/webhooks/facebook`;

  useEffect(() => {
    let isMounted = true;
    async function fetchCredentials() {
      try {
        const res = await fetch(`/api/tenant/${subdomain}/settings/byoc`);
        if (res.ok) {
          const data: CredentialsState = await res.json();
          if (isMounted) {
            setCredentials(data);
            setAppId(data.fbAppId || '');
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
    };
  }, [subdomain]);

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Ignore copy error
    }
  };

  const handleSave = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!appId.trim()) {
      setMessage({ text: 'Please enter a valid Facebook App ID.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const outcome = await saveAndTestBYOC(subdomain, appId, appSecret);

      if (outcome.saveError) {
        setMessage({ text: outcome.saveError, type: 'error' });
        setIsSaving(false);
        return;
      }

      setCredentials((prev) =>
        prev
          ? {
              ...prev,
              fbAppId: appId.trim(),
              hasSecret: prev.hasSecret || Boolean(appSecret.trim()),
              status: outcome.testSuccess ? 'valid' : 'invalid',
              lastTestedAt: outcome.testedAt || prev.lastTestedAt,
            }
          : null
      );
      setAppSecret('');

      if (outcome.testSuccess) {
        setMessage({ text: 'Credentials saved and verified with Meta Graph API.', type: 'success' });
      } else {
        const failMsg =
          outcome.testMessage ||
          'Meta Graph API rejected your credentials. Please verify your App ID and Secret.';
        setMessage({ text: failMsg, type: 'error' });
        setTestFailurePrompt({
          open: true,
          message: failMsg,
        });
      }
    } catch {
      setMessage({ text: 'Network request failed. Please try again.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/tenant/${subdomain}/settings/byoc/test`, {
        method: 'POST',
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage({ text: data.message || 'Connection test succeeded.', type: 'success' });
        setCredentials((prev) => (prev ? { ...prev, status: 'valid', lastTestedAt: data.testedAt } : null));
      } else {
        setMessage({ text: data.message || 'Meta Graph API test failed.', type: 'error' });
        setCredentials((prev) => (prev ? { ...prev, status: 'invalid', lastTestedAt: data.testedAt } : null));
      }
    } catch {
      setMessage({ text: 'Connection test request timed out or failed.', type: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const statusInfo = getStatusDetails(credentials?.status || 'unverified');

  if (isLoading) {
    return (
      <div style={{ padding: SPACING.xl, color: `var(--text-sub, ${THEME.default.text.secondary})` }}>
        Loading credentials configuration...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl, maxWidth: '780px' }}>
      {/* Header & Status Indicator */}
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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md }}>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.0625rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Facebook BYOC
            </h3>
            <p
              style={{
                margin: `${SPACING.xs} 0 0 0`,
                fontSize: '0.8125rem',
                color: `var(--text-sub, ${THEME.default.text.secondary})`,
                lineHeight: 1.4,
              }}
            >
              Configure your dedicated Facebook App ID and App Secret. All connected accounts and publishing workflows in this workspace will execute under your credentials.
            </p>
          </div>

          <div data-testid="byoc-status-indicator" style={{ flexShrink: 0 }}>
            <StatusDot
              status={statusInfo.statusType}
              label={statusInfo.label}
            />
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {message && (
          <div
            role="alert"
            style={{
              padding: `${SPACING.sm} ${SPACING.md}`,
              backgroundColor:
                message.type === 'success' ? 'rgba(46, 189, 133, 0.1)' : 'rgba(246, 70, 93, 0.1)',
              border: `1px solid ${message.type === 'success' ? PALETTE.accent4 : PALETTE.accent3}`,
              borderRadius: RADII.sm,
              color: message.type === 'success' ? PALETTE.accent4 : PALETTE.accent3,
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              gap: SPACING.sm,
            }}
          >
            <span>{message.text}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
          {/* Facebook App ID */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <label
              htmlFor="byoc-app-id"
              style={{
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                color: `var(--text-main, ${THEME.default.text.primary})`,
              }}
            >
              Facebook App ID
            </label>
            <input
              id="byoc-app-id"
              type="text"
              data-testid="byoc-app-id-input"
              placeholder="e.g. 123456789012345"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              disabled={isSaving}
              required
              style={{
                width: '100%',
                padding: `${SPACING.sm} ${SPACING.md}`,
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Facebook App Secret */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xs }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label
                htmlFor="byoc-app-secret"
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: TYPOGRAPHY.weights.medium,
                  color: `var(--text-main, ${THEME.default.text.primary})`,
                }}
              >
                Facebook App Secret
              </label>
              {credentials?.hasSecret && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: PALETTE.accent4,
                  }}
                >
                  Secret configured & encrypted
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: `var(--bg-canvas, ${THEME.default.surfaces.canvas})`,
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                overflow: 'hidden',
              }}
            >
              <input
                id="byoc-app-secret"
                type={showSecret ? 'text' : 'password'}
                data-testid="byoc-app-secret-input"
                placeholder={credentials?.hasSecret ? '••••••••••••••••••••••••' : 'Enter Facebook App Secret'}
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                disabled={isSaving}
                style={{
                  flex: 1,
                  padding: `${SPACING.sm} ${SPACING.md}`,
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
                onClick={() => setShowSecret((prev) => !prev)}
                data-testid="byoc-toggle-secret"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: `0 ${SPACING.md}`,
                  color: `var(--text-dim, ${THEME.default.text.muted})`,
                  cursor: 'pointer',
                  fontSize: '0.8125rem',
                }}
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                color: `var(--text-dim, ${THEME.default.text.muted})`,
              }}
            >
              Encrypted at rest using AES-256-GCM. Never transmitted back in cleartext.
            </span>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: SPACING.sm, marginTop: SPACING.xs }}>
            <button
              type="submit"
              disabled={isSaving || isTesting}
              data-testid="byoc-save-btn"
              style={{
                padding: `${SPACING.sm} ${SPACING.lg}`,
                backgroundColor: PALETTE.primary,
                border: 'none',
                borderRadius: RADII.sm,
                color: PALETTE.background,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.semibold,
                cursor: isSaving || isTesting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSaving ? 'Saving & Verifying...' : 'Save Credentials'}
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isSaving || isTesting || (!credentials?.hasSecret && !appSecret)}
              data-testid="byoc-test-btn"
              style={{
                padding: `${SPACING.sm} ${SPACING.lg}`,
                backgroundColor: 'transparent',
                border: `1px solid var(--border-subtle, ${THEME.default.borders.hairline})`,
                borderRadius: RADII.sm,
                color: `var(--text-main, ${THEME.default.text.primary})`,
                fontSize: '0.8125rem',
                fontWeight: TYPOGRAPHY.weights.medium,
                cursor: isSaving || isTesting || (!credentials?.hasSecret && !appSecret) ? 'not-allowed' : 'pointer',
              }}
            >
              {isTesting ? 'Testing Connection...' : 'Test App Connection'}
            </button>
          </div>
        </form>
      </div>

      {/* Meta Developer Configuration Helpers */}
      <MetaAppSetupSection
        redirectUri={redirectUri}
        webhookUrl={webhookUrl}
        copiedKey={copiedKey}
        onCopy={handleCopy}
      />

      {/* Meta Connection Test Failure Prompt Modal */}
      <ByocTestFailedModal
        open={testFailurePrompt.open}
        message={testFailurePrompt.message}
        onClose={() => setTestFailurePrompt({ open: false, message: '' })}
      />
    </div>
  );
}
